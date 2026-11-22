import os
import asyncio
import uuid
from datetime import datetime, timezone
import httpx
from dotenv import load_dotenv

from backend.database import db
from backend.ai_pipeline import parse_vendor_input, transcribe_audio
from backend.safety_rails import evaluate_safety_rails
from backend.tools import mutate_apply_dynamic_markdown, mutate_book_ngo_donation, mutate_route_to_biogas

load_dotenv()
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

async def get_telegram_file_bytes(file_id: str) -> bytes:
    """Downloads voice or photo file from Telegram's servers"""
    base_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.get(f"{base_url}/getFile", params={"file_id": file_id})
        if res.status_code == 200:
            file_path = res.json()["result"]["file_path"]
            download_url = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{file_path}"
            file_res = await client.get(download_url)
            return file_res.content
    return None

async def send_telegram_message(chat_id: int, text: str):
    """Sends reply back to the user on Telegram"""
    base_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            await client.post(base_url, json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"})
        except Exception as e:
            print(f"Error sending Telegram message: {e}")

async def process_telegram_update(update: dict):
    """Parses text, voice, or photo sent to Telegram bot"""
    msg = update.get("message")
    if not msg:
        return

    chat_id = msg["chat"]["id"]
    sender_name = msg["from"].get("first_name", "Vendor")
    text = msg.get("text", "")
    caption = msg.get("caption", "")
    combined_text = f"{text} {caption}".strip()

    # Handle /start
    if combined_text.lower() == "/start":
        welcome_msg = (
            f"👋 *Namaste {sender_name}!*\n\n"
            "Welcome to *ZeroSpoil Food Rescue Bot*.\n\n"
            "You can send:\n"
            "1. 🎤 *Voice Note* (Hindi/English) with your surplus stock\n"
            "2. 📷 *Photo* of extra food with discount info\n"
            "3. 💬 *Text Message* (e.g., '15 sourdough bread and 20 puffs at 50% discount')\n\n"
            "Our AI will analyze your surplus, apply food safety checks, and list it live on the Hyperlocal Rescue Feed!"
        )
        await send_telegram_message(chat_id, welcome_msg)
        return

    await send_telegram_message(chat_id, "⏳ *ZeroSpoil Engine:* Analyzing food safety, items, and clearance discounts...")

    audio_bytes = None
    image_bytes = None

    # Check for Voice Note / Audio
    if "voice" in msg:
        file_id = msg["voice"]["file_id"]
        audio_bytes = await get_telegram_file_bytes(file_id)
        if audio_bytes:
            transcribed = await transcribe_audio(audio_bytes, "voice.ogg")
            combined_text = f"{combined_text} {transcribed}".strip()

    elif "audio" in msg:
        file_id = msg["audio"]["file_id"]
        audio_bytes = await get_telegram_file_bytes(file_id)
        if audio_bytes:
            transcribed = await transcribe_audio(audio_bytes, "audio.mp3")
            combined_text = f"{combined_text} {transcribed}".strip()

    # Check for Photo
    if "photo" in msg:
        # Highest resolution photo is last in the list
        file_id = msg["photo"][-1]["file_id"]
        image_bytes = await get_telegram_file_bytes(file_id)

    # Process through Multimodal AI Pipeline
    extracted_items = await parse_vendor_input(combined_text, image_bytes)
    ngo_partner = await db.rescue_partners.find_one({"type": "NGO", "has_cold_chain": True})

    run_id = f"TG-{uuid.uuid4().hex[:6]}"
    summary_replies = []

    for item in extracted_items:
        batch_id = f"TG-BATCH-{uuid.uuid4().hex[:6]}"
        merchant_name = f"{sender_name}'s Store"
        item.update({
            "batch_id": batch_id,
            "merchant_name": merchant_name,
            "merchant_type": item.get("merchant_type", "VENDOR"),
            "location": "Panvel Local Region",
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
            "source": "TELEGRAM_BOT",
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
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        if verdict == "APPROVED":
            if final_tool == "apply_dynamic_markdown":
                retail = float(item.get("retail_price", proposed_price))
                discount_pct = int(round((1 - proposed_price / retail) * 100)) if retail > proposed_price else int(item.get("discount_pct", 50))
                await mutate_apply_dynamic_markdown(item, proposed_price, discount_pct)
                summary_replies.append(f"✅ *{item.get('sku_name')}* ({item.get('quantity')} {item.get('unit')}): Published to Community Feed at ₹{proposed_price} ({discount_pct}% off)!")
            elif final_tool == "book_ngo_donation":
                pdf_url = await mutate_book_ngo_donation(item, ngo_partner)
                log_doc["manifest_pdf_url"] = pdf_url
                summary_replies.append(f"🤝 *{item.get('sku_name')}*: Dispatched to NGO *{ngo_partner.get('name')}* with FSSAI Certificate!")

        elif verdict == "BLOCKED_REROUTED":
            await mutate_route_to_biogas(item, explanation)
            summary_replies.append(f"⛔ *{item.get('sku_name')}*: *BLOCKED* by Safety Rail ({rail_triggered}). Rerouted to Biogas/Gaushala for human safety.")

        elif verdict == "PAUSED_HITL":
            summary_replies.append(f"⚠️ *{item.get('sku_name')}*: Held in Manager HITL Queue (Negative margin below wholesale cost).")

        await db.agent_audit_logs.insert_one(log_doc)

    reply_text = "\n\n".join(summary_replies) if summary_replies else "✅ Stock recorded."
    await send_telegram_message(chat_id, reply_text)

async def start_telegram_polling():
    """Long-polling listener for Telegram updates"""
    if not TELEGRAM_BOT_TOKEN:
        print("[Telegram] No TELEGRAM_BOT_TOKEN configured, skipping bot polling.")
        return

    print(f"[Telegram] Bot polling active with token ending in ...{TELEGRAM_BOT_TOKEN[-6:]}")
    offset = 0
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"

    async with httpx.AsyncClient(timeout=35.0) as client:
        while True:
            try:
                res = await client.get(url, params={"offset": offset, "timeout": 20})
                if res.status_code == 200:
                    data = res.json()
                    for update in data.get("result", []):
                        offset = update["update_id"] + 1
                        asyncio.create_task(process_telegram_update(update))
                else:
                    await asyncio.sleep(3)
            except Exception as e:
                # Catch connection drops / timeouts gracefully
                await asyncio.sleep(2)
