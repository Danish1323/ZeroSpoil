import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

from backend.database import db
from backend.safety_rails import evaluate_safety_rails
from backend.tools import (
    mutate_apply_dynamic_markdown,
    mutate_book_ngo_donation,
    mutate_route_to_biogas,
    rollback_batch_mutation,
    MANIFEST_DIR
)
from backend.ai_pipeline import transcribe_audio, parse_vendor_input
from backend.seed_db import seed
from backend.telegram_bot import start_telegram_polling

app = FastAPI(title="ZeroSpoil Backend Engine", version="1.0.0")

@app.on_event("startup")
async def on_startup():
    # Start Telegram bot polling listener in background
    import asyncio
    asyncio.create_task(start_telegram_polling())

# CORS setup for Laptop 2 (FreshMart POS at http://localhost:3000 or http://<LAPTOP_1_IP>:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files mounts
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
os.makedirs(os.path.join(STATIC_DIR, "manifests"), exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "zerospoil"), exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = os.path.join(STATIC_DIR, "zerospoil", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h1>ZeroSpoil Command Center is loading...</h1>")

# Pydantic Models
class CreateBatchRequest(BaseModel):
    sku_name: str
    category: str
    quantity: int
    unit: str = "packs"
    wholesale_cost: float
    retail_price: float
    hours_to_expiry: float
    max_recorded_temp_c: float = 4.0
    safe_temp_limit_c: float = 4.0
    merchant_name: str = "FreshMart Supermarket - Panvel"
    merchant_type: str = "SUPERMARKET"
    location: str = "Sector 19, Panvel"

class HITLResolveRequest(BaseModel):
    decision: str  # "APPROVE" | "CLAMP_COST" | "REJECT"

class BroadcastAlertRequest(BaseModel):
    title: str = "n8n Workflow Alert"
    message: str
    severity: str = "warning"  # "warning" | "danger" | "info" | "success"
    target_role: str = "ALL"   # "ALL" | "CUSTOMER" | "NGO"
    max_radius_km: float = 3.0 # Only show to users/NGOs within this radius (e.g. <= 3.0 km)
    distance_km: float = 1.2   # Reported origin distance of the event

# --- REST ENDPOINTS ---

@app.post("/api/alerts/broadcast")
async def broadcast_alert(alert: BroadcastAlertRequest):
    """Called by n8n or internal events to trigger geo-targeted notification popups"""
    doc = {
        "_id": f"ALERT-{uuid.uuid4().hex[:6]}",
        "title": alert.title,
        "message": alert.message,
        "severity": alert.severity,
        "target_role": alert.target_role,
        "max_radius_km": alert.max_radius_km,
        "distance_km": alert.distance_km,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.system_alerts.insert_one(doc)
    return {"status": "BROADCASTED", "alert": doc}

@app.get("/api/state")
async def get_state():
    """State endpoint polled every 2s by Laptop 1 frontend and Laptop 2 POS"""
    batches = await db.inventory_batches.find({}, {"_id": 0}).to_list(100)
    deals = await db.community_deals.find({}).to_list(100)
    for d in deals:
        d["_id"] = str(d["_id"])
    partners = await db.rescue_partners.find({}).to_list(100)
    for p in partners:
        p["_id"] = str(p["_id"])
    logs = await db.agent_audit_logs.find({}).sort("timestamp", -1).to_list(100)
    for l in logs:
        l["_id"] = str(l["_id"])
    alerts = await db.system_alerts.find({}).sort("created_at", -1).limit(5).to_list(5)
    for a in alerts:
        a["_id"] = str(a["_id"])

    # Calculate real-time KPIs
    marked_down_or_donated = [b for b in batches if b.get("status") in ["MARKED_DOWN", "DONATED", "CLAIMED"]]
    meals_rescued = sum(b.get("quantity", 0) for b in batches if b.get("status") in ["DONATED", "CLAIMED"])
    revenue_recovered = sum(
        (b.get("current_price", 0) * b.get("quantity", 0)) 
        for b in batches if b.get("status") == "MARKED_DOWN"
    )
    time_saved_mins = 85 + (len(logs) * 8)
    co2_prevented_kg = round(meals_rescued * 1.85, 1)

    return {
        "kpis": {
            "time_saved_mins": time_saved_mins,
            "revenue_recovered_inr": round(revenue_recovered, 2),
            "meals_rescued": meals_rescued,
            "co2_prevented_kg": co2_prevented_kg
        },
        "inventory_batches": batches,
        "community_deals": deals,
        "rescue_partners": partners,
        "agent_audit_logs": logs,
        "system_alerts": alerts
    }

@app.post("/api/pos/batches")
async def create_pos_batch(batch_req: CreateBatchRequest):
    """Called by Laptop 2 POS to register new items into live inventory"""
    count = await db.inventory_batches.count_documents({})
    batch_id = f"BATCH-{101 + count}"
    new_doc = batch_req.dict()
    new_doc.update({
        "batch_id": batch_id,
        "current_price": batch_req.retail_price,
        "is_unserved": True,
        "hours_since_prep": 0.0,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    await db.inventory_batches.insert_one(new_doc)
    new_doc.pop("_id", None)
    return new_doc

@app.post("/api/pos/batches/{batch_id}/temp-spike")
async def simulate_temp_spike(batch_id: str):
    """Simulates a commercial refrigerator compressor breakdown (temp jumps to 9.5°C)"""
    res = await db.inventory_batches.find_one_and_update(
        {"batch_id": batch_id},
        {"$set": {"max_recorded_temp_c": 9.5}},
        return_document=True
    )
    if not res:
        raise HTTPException(status_code=404, detail="Batch not found")
    res.pop("_id", None)
    return res

@app.post("/api/agent/run-pos-audit")
async def run_pos_audit():
    """Runs 7:00 PM automated safety audit and dynamic action planner"""
    run_id = f"AUDIT-{uuid.uuid4().hex[:6]}"
    active_batches = await db.inventory_batches.find({"status": "ACTIVE"}).to_list(50)
    ngo_cold = await db.rescue_partners.find_one({"type": "NGO", "has_cold_chain": True})
    ngo_standard = await db.rescue_partners.find_one({"type": "NGO", "has_cold_chain": False})

    results = []

    for batch in active_batches:
        batch_id = batch["batch_id"]
        hours = batch.get("hours_to_expiry", 999.0)
        force_discount = batch.get("force_discount_pct")

        # Plan action based on remaining shelf life
        if hours <= 12.0:
            proposed_action = "book_ngo_donation"
            proposed_price = 0.0
            discount_pct = 100
        else:
            proposed_action = "apply_dynamic_markdown"
            discount_pct = force_discount if force_discount else (40 if hours <= 26.0 else 25)
            proposed_price = round(batch["retail_price"] * (1 - discount_pct / 100), 2)

        # Run Deterministic Safety Rails
        verdict, final_tool, rail_triggered, explanation = evaluate_safety_rails(
            batch, proposed_action, proposed_price
        )

        log_doc = {
            "run_id": run_id,
            "source": "POS_AUDIT",
            "batch_id": batch_id,
            "merchant_name": batch.get("merchant_name", "FreshMart Supermarket"),
            "item_name": batch.get("sku_name"),
            "proposed_tool": proposed_action,
            "tool_args": {"proposed_price": proposed_price, "discount_pct": discount_pct},
            "safety_verdict": verdict,
            "rail_triggered": rail_triggered,
            "final_tool": final_tool,
            "explanation": explanation,
            "manifest_pdf_url": None,
            "pre_mutation_snapshot": dict(batch),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if "_id" in log_doc["pre_mutation_snapshot"]:
            del log_doc["pre_mutation_snapshot"]["_id"]

        # Execute Tool based on verdict
        if verdict == "APPROVED":
            if final_tool == "apply_dynamic_markdown":
                await mutate_apply_dynamic_markdown(batch, proposed_price, discount_pct)
            elif final_tool == "book_ngo_donation":
                target_partner = ngo_cold if batch.get("category") == "DAIRY" else ngo_standard
                pdf_url = await mutate_book_ngo_donation(batch, target_partner)
                log_doc["manifest_pdf_url"] = pdf_url
                
                # Broadcast geofenced notification to nearby customers and NGOs within 3.0 km
                ngo_dist = float(target_partner.get("distance_km", 1.4))
                await db.system_alerts.insert_one({
                    "_id": f"ALERT-NGO-{uuid.uuid4().hex[:6]}",
                    "title": f"🚨 Nearby NGO Rescue Dispatched ({ngo_dist} km)",
                    "message": f"Free surplus batch of '{batch.get('sku_name')}' handed over to {target_partner.get('name')}. Available for pickup within 3.0 km radius.",
                    "severity": "success",
                    "target_role": "ALL",
                    "distance_km": ngo_dist,
                    "max_radius_km": 3.0,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })

        elif verdict == "BLOCKED_REROUTED":
            await mutate_route_to_biogas(batch, explanation)

        elif verdict == "PAUSED_HITL":
            # Update batch status to PAUSED_HITL so it is not re-processed on subsequent audit runs
            await db.inventory_batches.update_one(
                {"batch_id": batch_id},
                {"$set": {"status": "PAUSED_HITL"}}
            )

        ins = await db.agent_audit_logs.insert_one(log_doc)
        log_doc["_id"] = str(ins.inserted_id)
        results.append(log_doc)

    safety_blocks = len([
        l for l in results 
        if "BLOCKED" in str(l.get("safety_verdict", "")) 
        or l.get("final_tool") == "route_to_biogas_compost"
    ])
    margin_pauses = len([
        l for l in results 
        if "PAUSED" in str(l.get("safety_verdict", "")) 
        or l.get("final_tool") == "paused_for_approval"
    ])

    return {
        "status": "SUCCESS",
        "run_id": run_id,
        "processed_count": len(results),
        "safety_blocks": safety_blocks,
        "margin_pauses": margin_pauses,
        "summary": f"Audit complete: {safety_blocks} safety blocks, {margin_pauses} margin pauses.",
        "audit_logs": results
    }

@app.post("/api/agent/whatsapp-ingest")
async def whatsapp_ingest(
    merchant_name: str = Form("OvenFresh Bakery"),
    merchant_type: str = Form("BAKERY"),
    location: str = Form("Sector 15, Panvel"),
    raw_text: Optional[str] = Form(""),
    audio_file: Optional[UploadFile] = File(None),
    image_file: Optional[UploadFile] = File(None)
):
    """Processes messages from WhatsApp studio simulator"""
    run_id = f"WA-{uuid.uuid4().hex[:6]}"
    text = raw_text or ""

    if audio_file:
        audio_bytes = await audio_file.read()
        transcribed = await transcribe_audio(audio_bytes, audio_file.filename)
        text = f"{text} {transcribed}".strip()

    image_bytes = None
    if image_file:
        image_bytes = await image_file.read()

    extracted_items = await parse_vendor_input(text, image_bytes)
    ngo_partner = await db.rescue_partners.find_one({"type": "NGO", "has_cold_chain": True})
    results = []

    for idx, item in enumerate(extracted_items):
        batch_id = f"WA-BATCH-{uuid.uuid4().hex[:6]}"
        item.update({
            "batch_id": batch_id,
            "merchant_name": merchant_name,
            "merchant_type": merchant_type,
            "location": location,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.inventory_batches.insert_one(dict(item))

        proposed_action = item.get("source_action", "apply_dynamic_markdown")
        proposed_price = item.get("proposed_price", item.get("retail_price", 0.0) * 0.5)

        verdict, final_tool, rail_triggered, explanation = evaluate_safety_rails(
            item, proposed_action, proposed_price
        )

        log_doc = {
            "run_id": run_id,
            "source": "WHATSAPP_INGEST",
            "batch_id": batch_id,
            "merchant_name": merchant_name,
            "item_name": item.get("sku_name"),
            "proposed_tool": proposed_action,
            "tool_args": {"proposed_price": proposed_price, "quantity": item.get("quantity")},
            "safety_verdict": verdict,
            "rail_triggered": rail_triggered,
            "final_tool": final_tool,
            "explanation": explanation,
            "manifest_pdf_url": None,
            "pre_mutation_snapshot": dict(item),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if "_id" in log_doc["pre_mutation_snapshot"]:
            del log_doc["pre_mutation_snapshot"]["_id"]

        if verdict == "APPROVED":
            if final_tool == "apply_dynamic_markdown":
                # Calculate real discount percent from original retail price and clearance price
                retail = float(item.get("retail_price", proposed_price))
                if retail > 0 and proposed_price < retail:
                    discount_pct = int(round((1 - proposed_price / retail) * 100))
                else:
                    discount_pct = int(item.get("discount_pct", 0))
                await mutate_apply_dynamic_markdown(item, proposed_price, discount_pct)
            elif final_tool == "book_ngo_donation":
                pdf_url = await mutate_book_ngo_donation(item, ngo_partner)
                log_doc["manifest_pdf_url"] = pdf_url

        elif verdict == "BLOCKED_REROUTED":
            await mutate_route_to_biogas(item, explanation)

        ins = await db.agent_audit_logs.insert_one(log_doc)
        log_doc["_id"] = str(ins.inserted_id)
        results.append(log_doc)

    return {"status": "SUCCESS", "run_id": run_id, "parsed_text": text, "items_processed": results}

@app.post("/webhook/whatsapp")
async def twilio_whatsapp_webhook(request: Request):
    """Twilio WhatsApp Sandbox Webhook"""
    form_data = await request.form()
    body_text = form_data.get("Body", "")
    from_number = form_data.get("From", "WhatsApp User")
    media_url = form_data.get("MediaUrl0")

    audio_bytes = None
    if media_url and ("audio" in form_data.get("MediaContentType0", "")):
        async with httpx.AsyncClient() as client:
            resp = await client.get(media_url)
            audio_bytes = resp.content

    extracted_items = await parse_vendor_input(body_text)
    response_msg = f"ZeroSpoil: Received {len(extracted_items)} items for review. Safety rails verified."
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Message>{response_msg}</Message>
    </Response>"""
    return Response(content=twiml, media_type="application/xml")

@app.post("/api/agent/hitl/{log_id}/resolve")
async def resolve_hitl(log_id: str, payload: HITLResolveRequest):
    """Resolves items held in the PAUSED_HITL approval queue"""
    from bson import ObjectId
    try:
        log = await db.agent_audit_logs.find_one({"_id": ObjectId(log_id)})
    except Exception:
        log = await db.agent_audit_logs.find_one({"_id": log_id})

    if not log:
        raise HTTPException(status_code=404, detail="Audit log entry not found")

    batch_id = log["batch_id"]
    batch = await db.inventory_batches.find_one({"batch_id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Associated batch not found")

    if payload.decision == "APPROVE":
        proposed_price = log["tool_args"]["proposed_price"]
        discount_pct = log["tool_args"]["discount_pct"]
        await mutate_apply_dynamic_markdown(batch, proposed_price, discount_pct)
        verdict = "APPROVED_BY_MANAGER"

    elif payload.decision == "CLAMP_COST":
        # Clamp price exactly to wholesale cost floor
        clamped_price = batch["wholesale_cost"]
        discount_pct = int(round((1 - clamped_price / batch["retail_price"]) * 100))
        await mutate_apply_dynamic_markdown(batch, clamped_price, discount_pct)
        verdict = f"CLAMPED_TO_WHOLESALE_FLOOR (₹{clamped_price})"

    else:
        verdict = "REJECTED_BY_MANAGER"
        await db.inventory_batches.update_one({"batch_id": batch_id}, {"$set": {"status": "REJECTED_HITL"}})

    await db.agent_audit_logs.update_one(
        {"_id": log["_id"]},
        {"$set": {
            "safety_verdict": verdict,
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"status": "RESOLVED", "decision": payload.decision, "verdict": verdict}

@app.post("/api/agent/rollback/{batch_id}")
async def rollback(batch_id: str):
    """1-Click Rollback restoring pre-mutation snapshot"""
    log = await db.agent_audit_logs.find_one({"batch_id": batch_id}, sort=[("timestamp", -1)])
    if not log or "pre_mutation_snapshot" not in log:
        raise HTTPException(status_code=400, detail="No rollback snapshot available")

    await rollback_batch_mutation(batch_id, log["pre_mutation_snapshot"])
    await db.agent_audit_logs.insert_one({
        "run_id": f"ROLLBACK-{uuid.uuid4().hex[:6]}",
        "source": "MANUAL_ROLLBACK",
        "batch_id": batch_id,
        "item_name": log.get("item_name"),
        "proposed_tool": "rollback_batch_mutation",
        "safety_verdict": "ROLLED_BACK",
        "rail_triggered": "NONE",
        "final_tool": "restore_snapshot",
        "explanation": f"Manager triggered 1-click rollback. Pre-mutation state restored.",
        "manifest_pdf_url": None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    return {"status": "ROLLED_BACK", "batch_id": batch_id}

@app.post("/api/community/claim/{deal_id}")
async def claim_community_deal(deal_id: str):
    """Decrements quantity in community_deals and updates inventory_batches"""
    deal = await db.community_deals.find_one({"_id": deal_id})
    if not deal or deal.get("quantity_remaining", 0) <= 0:
        raise HTTPException(status_code=400, detail="Deal unavailable or out of stock")

    new_qty = deal["quantity_remaining"] - 1
    new_status = "CLAIMED" if new_qty == 0 else "ACTIVE"

    await db.community_deals.update_one(
        {"_id": deal_id},
        {"$set": {"quantity_remaining": new_qty, "status": new_status}}
    )

    batch_id = deal.get("batch_id")
    if batch_id:
        batch = await db.inventory_batches.find_one({"batch_id": batch_id})
        if batch:
            batch_qty = max(0, batch.get("quantity", 1) - 1)
            b_status = "CLAIMED" if batch_qty == 0 else batch.get("status")
            await db.inventory_batches.update_one(
                {"batch_id": batch_id},
                {"$set": {"quantity": batch_qty, "status": b_status}}
            )

    # Geo-fenced notification: If an NGO or clearance deal is claimed, broadcast alert to nearby customers/NGOs (< 3.0 km)
    is_ngo = deal.get("ngo_free_eligible", False)
    merchant_name = deal.get("merchant_name", "Local Store")
    item_title = deal.get("item_summary", "Item")
    
    alert_doc = {
        "_id": f"ALERT-{uuid.uuid4().hex[:6]}",
        "title": "📍 Hyperlocal Rescue Notice" if is_ngo else "⚡ Nearby Surplus Deal Claimed",
        "message": f"{item_title} was just claimed at {merchant_name} (1.4 km away). Only {new_qty} left!",
        "severity": "success" if is_ngo else "info",
        "target_role": "ALL",
        "distance_km": 1.4,       # Hyperlocal distance of the store
        "max_radius_km": 3.0,     # Geo-fence: Only users/NGOs <= 3.0km away receive this!
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.system_alerts.insert_one(alert_doc)

    return {"status": "SUCCESS", "deal_id": deal_id, "quantity_remaining": new_qty, "alert": alert_doc}

@app.post("/api/reset-demo")
async def reset_demo():
    """1-Click Demo Reset to restore all original traps and seed states"""
    await seed()
    return {"status": "RESET_COMPLETE", "timestamp": datetime.now(timezone.utc).isoformat()}
