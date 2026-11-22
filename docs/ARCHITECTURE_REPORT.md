# ZeroSpoil System Architecture & Automation Engineering Report

## Executive Summary
**ZeroSpoil** is an autonomous surplus food rescue, regulatory compliance, and inventory optimization engine. It automates evening grocery markdowns, detects and isolates cold-chain food safety breaches, enforces Indian **FSSAI Schedule-I** food recovery regulations, generates verified handover compliance certificates, and distributes hyper-local surplus to community members and NGOs within walking radius.

The system is engineered as a **distributed two-node architecture** (Laptop 1: Autonomous Safety & API Engine; Laptop 2: Supermarket POS Terminal) backed by real-time IoT and multimodal ingestion pipelines.

---

## 1. High-Level System Architecture

```mermaid
graph TD
    subgraph Client_Layer["1. Ingestion & Client Layer"]
        L2["Laptop 2: Supermarket POS Terminal<br/>(React / POS Staff Console)"]
        TG["Telegram Bot Daemon<br/>(@zerospoil_vendor_bot)"]
        WA["Web WhatsApp Simulator<br/>(Voice, Photo & Text)"]
        ConsumerUI["Laptop 1: Command Center &<br/>Hyperlocal Community Feed"]
    end

    subgraph Automation_Layer["2. Automation & Orchestration"]
        N8N["n8n Scheduled Orchestrator<br/>(Docker Container :5678)"]
        GeoEngine["Haversine Geo-Fencing Engine<br/>(Radius <= 3.0 km)"]
    end

    subgraph Core_Engine["3. FastAPI Core & Policy Gatekeeper (Port 8000)"]
        API["FastAPI REST Router & CORS Layer"]
        AI_Pipe["Multimodal AI Pipeline<br/>(Whisper-1 + Qwen 3.6 Vision)"]
        SafetyRails["Deterministic Safety Rails Gatekeeper<br/>(Pure Python Policy Engine)"]
        ToolExecutor["Tool Mutation & Execution Unit"]
        PDFGen["FSSAI Schedule-I PDF Generator<br/>(fpdf2 Engine)"]
    end

    subgraph Data_Layer["4. Persistence & Compliance Records"]
        MongoDB[(Local MongoDB: zerospoil_db<br/>Port 27017)]
        ManifestStore["PDF Manifest Store<br/>/static/manifests/*.pdf"]
    end

    L2 -->|REST APIs: /api/pos/*| API
    TG -->|Long Polling: getUpdates| AI_Pipe
    WA -->|Multipart Ingest| AI_Pipe
    ConsumerUI -->|2s State Polling: /api/state| API
    ConsumerUI -->|Claims: /api/community/claim/*| API

    N8N -->|Trigger 7:00 PM Audit| API
    N8N -->|Broadcast Alerts| API

    API --> AI_Pipe
    AI_Pipe --> SafetyRails
    API --> SafetyRails

    SafetyRails -->|APPROVED| ToolExecutor
    SafetyRails -->|BLOCKED_REROUTED| ToolExecutor
    SafetyRails -->|PAUSED_HITL| ToolExecutor

    ToolExecutor -->|Mutate Batches & Deals| MongoDB
    ToolExecutor -->|Generate Official Manifest| PDFGen
    PDFGen --> ManifestStore

    ToolExecutor -->|Event Notification| GeoEngine
    GeoEngine -->|Live Toast Broadcast| ConsumerUI
```

---

## 2. Multi-Device Network Architecture (Live Hackathon Setup)

ZeroSpoil is structured across local Wi-Fi / hotspot subnets to support a collaborative live demonstration:

| Node | Responsibility | Port / Protocol | Bound IP |
| :--- | :--- | :--- | :--- |
| **Laptop 1** | FastAPI Core Engine, MongoDB, Telegram Bot, Command Center | `8000` (FastAPI), `27017` (MongoDB), `5678` (n8n), `5173` (React UI) | `0.0.0.0:8000` (`172.30.7.105`) |
| **Laptop 2** | FreshMart Supermarket POS Terminal | `3000` / `5173` | Local LAN pointing to `http://172.30.7.105:8000` |

### Cross-Origin Resource Sharing (CORS) Policy
FastAPI is configured with unrestricted cross-origin middleware to ensure Laptop 2's browser can query the backend without security blocks:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 3. Automation Layer Deep-Dive

### 3.1 Autonomous 7:00 PM Supermarket Audit (n8n + FastAPI)
Every evening at 7:00 PM, supermarkets identify stock nearing expiration. ZeroSpoil replaces manual discounting with an autonomous pipeline:

```mermaid
sequenceDiagram
    autonumber
    participant N8N as n8n Scheduler (Docker)
    participant API as FastAPI (/api/agent/run-pos-audit)
    participant DB as MongoDB (inventory_batches)
    participant Rails as Deterministic Safety Rails
    participant Tools as Tool Execution & PDF Engine
    participant UI as Command Center UI

    N8N->>API: POST /api/agent/run-pos-audit
    API->>DB: Query ACTIVE inventory batches
    DB-->>API: Return [BATCH-101 .. BATCH-106]
    
    loop For Each Batch
        API->>Rails: evaluate_safety_rails(batch, proposed_action, price)
        alt Temperature > Safe Limit OR Expiry <= 0
            Rails-->>API: BLOCKED_REROUTED (COLD_CHAIN_FOOD_SAFETY_LOCK)
            API->>Tools: mutate_route_to_biogas(batch)
            Tools->>DB: Set status = "BIOGAS_COMPOST"
        else Proposed Price < Wholesale Cost
            Rails-->>API: PAUSED_HITL (WHOLESALE_MARGIN_FLOOR_GATE)
            API->>DB: Set status = "PAUSED_HITL" (Hold for Approval)
        else Expiry <= 12h
            Rails-->>API: APPROVED (Donation Tool)
            API->>Tools: mutate_book_ngo_donation(batch, partner)
            Tools->>Tools: Generate FSSAI PDF Manifest
            Tools->>DB: Insert DEAL-NGO with PDF URL
        else Expiry > 12h
            Rails-->>API: APPROVED (Markdown Tool)
            API->>Tools: mutate_apply_dynamic_markdown(batch, price, pct)
            Tools->>DB: Insert DEAL in community_deals
        end
    end

    API-->>N8N: 200 OK {safety_blocks: 1, margin_pauses: 1, processed: 6}
    N8N->>API: POST /api/alerts/broadcast (Trigger Live Toast)
    API-->>UI: Real-time Toast Alert Notification
```

---

## 4. Deterministic Food Safety Rails (Policy Gatekeeper)

Unlike non-deterministic LLM output, ZeroSpoil implements strict regulatory guardrails:

```mermaid
flowchart TD
    Start([Batch Evaluated]) --> TempCheck{Recorded Temp > Safe Limit?}
    TempCheck -- Yes --> BlockBio[BLOCKED_REROUTED<br/>Rail: COLD_CHAIN_FOOD_SAFETY_LOCK<br/>Destination: Biogas / Gaushala]
    TempCheck -- No --> ExpCheck{Hours to Expiry <= 0?}

    ExpCheck -- Yes --> BlockExp[BLOCKED_REROUTED<br/>Rail: EXPIRED_PRODUCT_LOCK<br/>Destination: Biogas / Gaushala]
    ExpCheck -- No --> DangerZone{Restaurant/Bakery Cooked Food<br/>Unchilled > 2.0 Hours?}

    DangerZone -- Yes --> BlockFSSAI[BLOCKED_REROUTED<br/>Rail: FSSAI_COOKED_FOOD_DANGER_ZONE_LOCK<br/>Destination: Biogas / Compost]
    DangerZone -- No --> MarginCheck{Proposed Price < Wholesale Cost?}

    MarginCheck -- Yes --> PauseHITL[PAUSED_HITL<br/>Rail: WHOLESALE_MARGIN_FLOOR_GATE<br/>Queue: Human Manager Approval]
    MarginCheck -- No --> Approve[APPROVED<br/>Action: Dynamic Markdown or NGO Rescue]
```

### Safety Rules Matrix

| Rule Name | Trigger Condition | Deterministic Action | Target Recipient |
| :--- | :--- | :--- | :--- |
| **`COLD_CHAIN_FOOD_SAFETY_LOCK`** | `max_recorded_temp_c > safe_temp_limit_c` | Blocks sale & human donation | GreenCycle Biogas & Gaushala Unit |
| **`EXPIRED_PRODUCT_LOCK`** | `hours_to_expiry < 0` | Blocks human consumption | Biogas Energy Plant |
| **`FSSAI_COOKED_FOOD_DANGER_ZONE_LOCK`** | Cooked meal unchilled $> 2.0\text{h}$ or open buffet tray | Hard-block under FSSAI 2-hr Danger Zone | Biogas / Compost |
| **`WHOLESALE_MARGIN_FLOOR_GATE`** | `clearance_price < wholesale_cost` | Pauses database mutation | Held in Manager HITL Queue |

---

## 5. Multimodal Voice & Vision Ingestion Pipeline

Small bakeries, kirana shops, and fruit vendors often lack barcode scanners. ZeroSpoil allows vendors to register surplus by sending voice notes or snapping food photos:

```mermaid
sequenceDiagram
    autonumber
    actor Vendor as Local Merchant / Vendor
    participant TG as Telegram (@zerospoil_vendor_bot)
    participant Core as Backend Ingestion Router
    participant Whisper as OpenAI Whisper API (whisper-1)
    participant Vision as OpenRouter (Qwen 3.6 Multimodal)
    participant Rails as Deterministic Safety Rails
    participant Feed as Hyperlocal Community Feed

    Vendor->>TG: Sends Audio Note or Food Photo
    TG->>Core: Download audio/image payload via Bot API
    alt Audio Note
        Core->>Whisper: POST /v1/audio/transcriptions
        Whisper-->>Core: Transcribed text (Hindi/English mixing)
    end
    alt Food Photo
        Core->>Vision: Base64 Encoded Image + Extraction Prompt
        Vision-->>Core: Structured JSON: [{sku, qty, price, category, hours_left}]
    end
    Core->>Rails: Evaluate safety threshold for each item
    Rails-->>Core: Verdict (APPROVED / BLOCKED / HITL)
    Core->>Feed: Insert approved deals into community_deals
    Core-->>TG: Send confirmation message to Vendor
```

---

## 6. Hyperlocal Geo-Fencing Engine

To eliminate spam and ensure surplus food is rescued while still fresh, ZeroSpoil implements a **Haversine Distance Engine**:

$$\Delta\sigma = 2 \arcsin \sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}$$

$$d = R \cdot \Delta\sigma \quad (R = 6371 \text{ km})$$

- **Anchor Node**: FreshMart Supermarket — Panvel (`18.9902° N, 73.1168° E`).
- **Geo-Fence Boundary**: $\le 3.0\text{ km}$.
- When a clearance deal or NGO rescue is announced, the client compares the device's real HTML5 GPS coordinates against the event location:
  - **Distance $\le 3.0\text{ km}$**: Displays real-time popup with distance badge (e.g. `1.4 km away`).
  - **Distance $> 3.0\text{ km}$**: Suppressed automatically to protect distant users from irrelevant alerts.

---

## 7. FSSAI Schedule-I Compliance PDF Generator

When perishable surplus is allocated to an NGO, the backend runs a dedicated PDF engine (`backend/tools.py` using `fpdf2`):
- **Certificate ID**: `MANIFEST-BATCH-<id>-<timestamp>.pdf`
- **Embedded Compliance Declarations**:
  1. Formal declaration under Food Safety and Standards (Recovery and Distribution of Surplus Food) Regulations.
  2. Timestamped temperature log and safe shelf-life duration.
  3. Cold-chain transit requirement flags (`has_cold_chain: true`).
  4. Dual signature blocks for Store Dispatch Officer and NGO Receiving Agent.

---

## 8. Database Schema Architecture (`zerospoil_db`)

```mermaid
erDiagram
    INVENTORY_BATCHES ||--o{ COMMUNITY_DEALS : spawns
    INVENTORY_BATCHES ||--o{ AGENT_AUDIT_LOGS : records
    RESCUE_PARTNERS ||--o{ AGENT_AUDIT_LOGS : receives

    INVENTORY_BATCHES {
        string batch_id PK
        string sku_name
        string category
        int quantity
        float wholesale_cost
        float retail_price
        float current_price
        float hours_to_expiry
        float max_recorded_temp_c
        float safe_temp_limit_c
        string status
    }

    COMMUNITY_DEALS {
        string _id PK
        string batch_id FK
        string merchant_name
        string item_summary
        float clearance_price
        int discount_pct
        int quantity_remaining
        boolean ngo_free_eligible
        string status
    }

    RESCUE_PARTNERS {
        string _id PK
        string name
        string type
        boolean has_cold_chain
        float distance_km
    }

    AGENT_AUDIT_LOGS {
        string _id PK
        string run_id
        string batch_id FK
        string proposed_tool
        string safety_verdict
        string rail_triggered
        string final_tool
        string explanation
        string manifest_pdf_url
    }
```

---

## 9. Conclusion
ZeroSpoil integrates autonomous scheduled audits (n8n), multimodal ingestion (Whisper + Vision), and strict regulatory enforcement into a unified food rescue platform. By pairing deterministic safety rails with a reactive microservice architecture, it ensures food is distributed efficiently and safely without manual overhead.
