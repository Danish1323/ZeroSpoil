PROMPT 1: For Laptop 1 (You) — FastAPI Backend, MongoDB, Deterministic Safety Rails & Main ZeroSpoil Web App
Copy and paste everything inside this block into Antigravity on Laptop 1:

Markdown

# BUILD PROMPT — LAPTOP 1: ZEROSPOIL BACKEND ENGINE & MAIN COMMAND CENTER WEB APP

## ROLE & SCOPE BOUNDARY (READ CAREFULLY)

You are building **ONLY** the **ZeroSpoil Backend Engine (FastAPI + MongoDB)** and the **Main ZeroSpoil Web Application** (`static/zerospoil/`), which runs on **Laptop 1** (`0.0.0.0:8000`).

- **DO NOT** build the separate Supermarket Inventory Management POS frontend—a second teammate is building that standalone POS app on **Laptop 2** (`http://localhost:3000`).
- **TWO-DEVICE ARCHITECTURE CONTEXT:** During our live hackathon demo, Laptop 2 runs a standalone **FreshMart Supermarket POS** web app connected over our local Wi-Fi/hotspot to **this FastAPI backend on Laptop 1** (`http://<LAPTOP_1_IP>:8000`). Therefore:
  1. You **MUST** configure `CORSMiddleware` in FastAPI (`allow_origins=["*"]`, `allow_methods=["*"]`, `allow_headers=["*"]`) so Laptop 2's POS frontend can call all `/api/*` endpoints from a different origin/IP without CORS blocks.
  2. You **MUST** expose clean REST endpoints (`GET /api/state`, `POST /api/pos/batches`, `POST /api/pos/batches/{batch_id}/temp-spike`, `POST /api/agent/run-pos-audit`) so Laptop 2's POS app can create stock, simulate chiller faults, trigger the 7:00 PM audit, and poll live price/status updates every 2 seconds.

---

## TECH STACK & BUDGET CONSTRAINTS

- **Backend:** Python 3.12+ (`uv`), **FastAPI**, `uvicorn[standard]`, `motor` (async MongoDB), `pymongo`, `httpx`, `fpdf2`, `python-dotenv`, `python-multipart`.
- **Database:** Local **MongoDB** (`mongodb://localhost:27017`, database: `zerospoil_db`) so every BSON document mutation can be inspected live in **MongoDB Compass**.
- **AI Inference (Budget-Safe < $0.15 total):**
  - **OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`) using `qwen/qwen3.6-35b-a3b` (fallback: `nvidia/nemotron-3-nano-30b-a3b:free`) for image-to-JSON food extraction and structured tool planning.
  - **OpenAI Audio API** (`https://api.openai.com/v1/audio/transcriptions`, model `whisper-1`) for transcribing Hindi/English WhatsApp voice notes.
  - **Mandatory Offline/Fallback Resilience:** If `OPENROUTER_API_KEY` or `OPENAI_API_KEY` is missing, rate-limited, or offline, automatically fall back to a deterministic keyword/heuristic parser so the live stage demo NEVER fails.
- **Free Notifications & PDFs ($0.00):**
  - **FSSAI Schedule-I Surplus Handover PDF:** Generated via `fpdf2` into `static/manifests/MANIFEST-<id>.pdf`.
  - **Email Alerts:** Python `smtplib` with Gmail SMTP (`SMTP_EMAIL`, `SMTP_APP_PASSWORD` in `.env`, graceful skip if unset).
  - **WhatsApp Integration:** Real Twilio WhatsApp Sandbox webhook (`POST /webhook/whatsapp` handling form fields `Body`, `MediaUrl0`, `MediaContentType0`, `From`) **PLUS** a built-in Web WhatsApp Simulator in the ZeroSpoil UI.
- **Frontend (Zero Build Step):** Pure HTML5, CSS3, Vanilla JS (`static/zerospoil/index.html`, `app.css`, `app.js`) served directly at `GET /`.

---

## DIRECTORY STRUCTURE TO CREATE

```text
zerospoil-core/
├── .env.example
├── pyproject.toml
├── backend/
│   ├── __init__.py
│   ├── database.py          # Async Motor connection to mongodb://localhost:27017 (zerospoil_db)
│   ├── seed_db.py           # Idempotent seeder with realistic Indian retail/bakery/vendor traps
│   ├── safety_rails.py      # Pure-Python deterministic FSSAI & cold-chain policy engine
│   ├── ai_pipeline.py       # OpenAI Whisper + OpenRouter Qwen3.6 multimodal parser & planner
│   ├── tools.py             # Real DB mutations, PDF manifest generator, SMTP email, rollback
│   └── main.py              # FastAPI server with CORS, REST APIs, Twilio webhook & static mount
└── static/
    ├── manifests/           # Auto-generated FSSAI PDF certificates
    └── zerospoil/           # Main ZeroSpoil Command Center & Hyperlocal Community App
        ├── index.html
        ├── app.css
        └── app.js
MONGODB SCHEMA & SEED DATA (backend/seed_db.py)
Create 4 collections in zerospoil_db:

inventory_batches (Shared with Laptop 2's Supermarket POS):
Seed 6 realistic SKUs for "FreshMart Supermarket — Panvel":

BATCH-101: Amul Taaza Homogenized Milk (1L) | DAIRY | qty: 30 packs | wholesale: 48, retail: 56, current_price: 56 | hours_to_expiry: 14 | max_recorded_temp_c: 8.6, safe_temp_limit_c: 4.0 | is_unserved: true, hours_since_prep: 0 | status: "ACTIVE" (TRAP 1: Cold-Chain Breach — Safety Rail MUST block sale/donation and reroute to Biogas/Gaushala).

BATCH-102: Artisanal Multigrain Sourdough Loaves | BAKERY | qty: 22 loaves | wholesale: 85, retail: 160, current_price: 160 | hours_to_expiry: 26 | max_recorded_temp_c: 24.0, safe_temp_limit_c: 28.0 | is_unserved: true, hours_since_prep: 0 | status: "ACTIVE" (HAPPY PATH 1: Auto 40% Markdown to ₹96 + live Community Feed card).

BATCH-103: Gowardhan Fresh Malai Paneer (200g) | DAIRY | qty: 25 packs | wholesale: 65, retail: 95, current_price: 95 | hours_to_expiry: 8 | max_recorded_temp_c: 3.1, safe_temp_limit_c: 4.0 | is_unserved: true, hours_since_prep: 0 | status: "ACTIVE" (HAPPY PATH 2: Cold-Chain NGO Rescue + FSSAI PDF Manifest + Email).

BATCH-104: Epigamia Greek Yogurt Assorted Pack | DAIRY | qty: 40 tubs | wholesale: 55, retail: 75, current_price: 75 | hours_to_expiry: 20 | max_recorded_temp_c: 3.4, safe_temp_limit_c: 4.0 | force_discount_pct: 60 | status: "ACTIVE" (TRAP 2: Wholesale Margin Floor HITL Gate — 60% off = ₹30 < ₹55 wholesale -> pauses in HITL Approval Queue).

BATCH-105: FarmFresh Baby Spinach & Coriander Bunches | PRODUCE | qty: 35 bunches | wholesale: 18, retail: 35, current_price: 35 | hours_to_expiry: 18 | max_recorded_temp_c: 12.0, safe_temp_limit_c: 15.0 | status: "ACTIVE".

BATCH-106: ID Fresh Idli/Dosa Batter (1kg) | DAIRY | qty: 18 packs | wholesale: 52, retail: 80, current_price: 80 | hours_to_expiry: 30 | max_recorded_temp_c: 3.8, safe_temp_limit_c: 4.0 | status: "ACTIVE".

community_deals (Hyperlocal Clearance & NGO Rescue Feed):
Seed 2 initial deals and dynamically insert new deals whenever Supermarket POS marks down stock OR a local vendor/bakery sends a WhatsApp voice/photo message.
Schema: { "_id", "batch_id", "merchant_name", "merchant_type", "location", "item_summary", "original_price", "clearance_price", "discount_pct", "quantity_remaining", "unit", "ngo_free_eligible", "source_channel", "raw_input_preview", "status", "created_at" }.

rescue_partners:

PARTNER-NGO-1: Panvel Community Kitchen & Food Bank (NGO, has_cold_chain: true, distance_km: 1.4)

PARTNER-NGO-2: Robin Hood Army — Navi Mumbai (NGO, has_cold_chain: false, distance_km: 2.1)

PARTNER-BIO-1: GreenCycle Biogas & Gaushala Feed Unit (BIOGAS_COMPOST, has_cold_chain: false, distance_km: 3.5)

agent_audit_logs:
Schema: { "_id", "run_id", "source", "batch_id", "merchant_name", "item_name", "proposed_tool", "tool_args", "safety_verdict", "rail_triggered", "final_tool", "explanation", "manifest_pdf_url", "timestamp" }.

DETERMINISTIC SAFETY RAILS (backend/safety_rails.py)
Pure Python policy gatekeeper (zero LLM involvement in pass/block decisions):

COLD_CHAIN_FOOD_SAFETY_LOCK: If max_recorded_temp_c > safe_temp_limit_c OR hours_to_expiry <= 0 -> Hard-block markdown/donation, override final_tool = "route_to_biogas_compost", verdict = "BLOCKED_REROUTED".

FSSAI_COOKED_FOOD_DANGER_ZONE_LOCK: If merchant_type in ["RESTAURANT", "BAKERY"] AND category in ["COOKED_MEAL", "CREAM_DAIRY"] AND (is_unserved == False OR hours_since_prep > 2.0) -> Hard-block human sale/donation per FSSAI guidelines, override final_tool = "route_to_biogas_compost", verdict = "BLOCKED_REROUTED".

WHOLESALE_MARGIN_FLOOR_GATE: If proposed new_price < wholesale_cost -> Verdict = "PAUSED_HITL", freeze DB mutation, queue for human approval.

REQUIRED API CONTRACT (MUST MATCH LAPTOP 2 POS APP EXACTLY)
GET /api/state -> Returns JSON:

JSON
{
  "kpis": { "time_saved_mins": 85, "revenue_recovered_inr": 0, "meals_rescued": 0, "co2_prevented_kg": 0 },
  "inventory_batches": [...],
  "community_deals": [...],
  "rescue_partners": [...],
  "agent_audit_logs": [...]
}
POST /api/pos/batches -> Accepts JSON { "sku_name", "category", "quantity", "unit", "wholesale_cost", "retail_price", "hours_to_expiry", "max_recorded_temp_c", "safe_temp_limit_c" }, inserts new BATCH-xxx into inventory_batches, and returns the created document.

POST /api/pos/batches/{batch_id}/temp-spike -> Sets max_recorded_temp_c = 9.5 on that batch (called when Laptop 2 clicks "Simulate Chiller Fault") and returns updated batch.

POST /api/agent/run-pos-audit -> Scans all ACTIVE batches in inventory_batches, plans tool calls, runs safety_rails.py, executes tools (apply_dynamic_markdown, book_ngo_donation, route_to_biogas_compost), writes agent_audit_logs, and returns execution summary.

POST /api/agent/whatsapp-ingest -> Accepts multipart/form-data (merchant_name, merchant_type, location, raw_text, audio_file, image_file), extracts items via Whisper/OpenRouter (or fallback parser), runs safety_rails.py, publishes to community_deals and/or dispatches NGO + PDF manifest, and logs to agent_audit_logs.

POST /webhook/whatsapp -> Twilio WhatsApp Sandbox webhook handler (accepts Twilio form data, downloads MediaUrl0 if audio/image, runs the same pipeline, returns TwiML XML confirmation).

POST /api/agent/hitl/{log_id}/resolve -> Body { "decision": "APPROVE" | "CLAMP_COST" | "REJECT" } to resolve PAUSED_HITL items.

POST /api/agent/rollback/{batch_id} -> Restores pre_mutation_snapshot and removes spawned community deal.

POST /api/community/claim/{deal_id} -> Decrements quantity_remaining by 1 (or claims full NGO batch) in community_deals AND decrements corresponding inventory_batches quantity so Laptop 2 sees the sale live!

POST /api/reset-demo -> Re-runs seed_db.py cleanly so we can reset between judge rounds in 1 click.

FRONTEND SPECIFICATION (static/zerospoil/index.html)
Build a high-contrast, modern dashboard with 2-second auto-polling (GET /api/state) and 3 tabs:

Top Persistent KPI Ribbon: Live counters (Manual Minutes Saved, Merchant Cash Recovered ₹, Meals Rescued, CO₂e Diverted kg) + Reset Demo Data button + Run POS Audit Now button.

Tab 1 — Agent Brain & Deterministic Safety Rails:

Left Panel: Safety Rail Interceptions & HITL Approval Queue (Red cards for BLOCKED_REROUTED cold-chain/FSSAI blocks; Amber interactive cards for PAUSED_HITL with Approve / Clamp to Wholesale Cost buttons).

Right Panel: Live Tool Execution Trace showing each batch processed, safety verdict badge, clickable View FSSAI PDF Manifest link, and 1-Click Rollback button.

Tab 2 — Local Bakery, Restaurant & Vendor WhatsApp Studio:

Clean WhatsApp Business Bot simulator where you can upload a food photo, drop an audio file, type a message, OR click 3 Instant Demo Presets:

Bakery Voice Note (Hindi/English): "Bhai OvenFresh Bakery se bol raha hoon, aaj ke 15 sourdough bread aur 20 masala puffs bache hain, 50% off pe community mein daal do."

Fruit Vendor Photo/Note: "Raju Fruit Stall Sector 11: 12 kg ripe Alphonso mangoes & bananas at ₹60/kg clearance before 10 PM."

Restaurant 5-Hr Unchilled Gravy Trap: "SpiceRoute Kitchen: Leftover paneer gravy buffet tray sitting unchilled since 4 PM (5 hours) — donate to NGO." -> Triggers FSSAI 2-Hour Danger-Zone Hard-Lock live!

Tab 3 — Hyperlocal Community & NGO Rescue App (Consumer/NGO View):

Clean card grid displaying all live 50%-Off Deals (both FreshMart Supermarket markdowns and local bakery/vendor deals) and Free NGO Rescue Claims with interactive Claim Deal (50% Off) and Claim NGO Pickup buttons.

Generate complete, runnable, zero-placeholder code for every file plus exact uv commands to run seed_db.py and uvicorn.
```
