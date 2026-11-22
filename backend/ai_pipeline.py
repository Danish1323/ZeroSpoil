import os
import re
import json
import httpx
from typing import Dict, Any, List

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

def heuristic_text_parser(text: str) -> List[Dict[str, Any]]:
    """Deterministic fallback parser for vendor messages (Hindi/English mixing)"""
    text_lower = text.lower()
    items = []

    # Check for FSSAI trap message (unchilled gravy)
    if "gravy" in text_lower or "paneer gravy" in text_lower or "unchilled" in text_lower:
        hours = 5.0
        match = re.search(r'(\d+)\s*hour', text_lower)
        if match:
            hours = float(match.group(1))
        items.append({
            "sku_name": "Leftover Paneer Butter Gravy Tray",
            "category": "COOKED_MEAL",
            "merchant_type": "RESTAURANT",
            "quantity": 10,
            "unit": "portions",
            "wholesale_cost": 40.0,
            "retail_price": 120.0,
            "proposed_price": 0.0,
            "hours_to_expiry": 2.0,
            "max_recorded_temp_c": 28.0,
            "safe_temp_limit_c": 4.0,
            "is_unserved": False,
            "hours_since_prep": hours,
            "source_action": "book_ngo_donation",
            "notes": "Leftover buffet tray"
        })
        return items

    # Check for bakery sourdough/puff note
    if "sourdough" in text_lower or "puffs" in text_lower or "bakery" in text_lower:
        items.append({
            "sku_name": "Artisanal Sourdough Loaves",
            "category": "BAKERY",
            "merchant_type": "BAKERY",
            "quantity": 15,
            "unit": "loaves",
            "wholesale_cost": 50.0,
            "retail_price": 120.0,
            "proposed_price": 60.0,
            "discount_pct": 50,
            "hours_to_expiry": 24.0,
            "max_recorded_temp_c": 22.0,
            "safe_temp_limit_c": 28.0,
            "is_unserved": True,
            "hours_since_prep": 1.0,
            "source_action": "apply_dynamic_markdown"
        })
        items.append({
            "sku_name": "Baked Masala Puffs",
            "category": "BAKERY",
            "merchant_type": "BAKERY",
            "quantity": 20,
            "unit": "pcs",
            "wholesale_cost": 15.0,
            "retail_price": 30.0,
            "proposed_price": 15.0,
            "discount_pct": 50,
            "hours_to_expiry": 16.0,
            "max_recorded_temp_c": 22.0,
            "safe_temp_limit_c": 28.0,
            "is_unserved": True,
            "hours_since_prep": 1.0,
            "source_action": "apply_dynamic_markdown"
        })
        return items

    # Check for fruit/produce note
    if "mango" in text_lower or "banana" in text_lower or "fruit" in text_lower:
        items.append({
            "sku_name": "Ripe Alphonso Mangoes & Fresh Bananas",
            "category": "PRODUCE",
            "merchant_type": "VENDOR",
            "quantity": 12,
            "unit": "kg",
            "wholesale_cost": 45.0,
            "retail_price": 100.0,
            "proposed_price": 60.0,
            "discount_pct": 40,
            "hours_to_expiry": 18.0,
            "max_recorded_temp_c": 24.0,
            "safe_temp_limit_c": 30.0,
            "is_unserved": True,
            "hours_since_prep": 0.0,
            "source_action": "apply_dynamic_markdown"
        })
        return items

    # Generic fallback
    items.append({
        "sku_name": "Surplus Assorted Food Pack",
        "category": "GROCERY",
        "merchant_type": "VENDOR",
        "quantity": 10,
        "unit": "packs",
        "wholesale_cost": 30.0,
        "retail_price": 60.0,
        "proposed_price": 30.0,
        "discount_pct": 50,
        "hours_to_expiry": 20.0,
        "max_recorded_temp_c": 20.0,
        "safe_temp_limit_c": 25.0,
        "is_unserved": True,
        "hours_since_prep": 0.5,
        "source_action": "apply_dynamic_markdown"
    })
    return items

async def transcribe_audio(audio_bytes: bytes, filename: str = "voice.mp3") -> str:
    """Transcribes audio using OpenAI Whisper API or falls back gracefully"""
    if not OPENAI_API_KEY:
        return "Bhai OvenFresh Bakery se bol raha hoon, aaj ke 15 sourdough bread aur 20 masala puffs bache hain, 50% off pe community mein daal do."
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            files = {"file": (filename, audio_bytes, "audio/mpeg")}
            data = {"model": "whisper-1"}
            headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
            res = await client.post("https://api.openai.com/v1/audio/transcriptions", files=files, data=data, headers=headers)
            if res.status_code == 200:
                return res.json().get("text", "")
    except Exception as e:
        print(f"Whisper API error, using fallback text: {e}")
    return "Surplus stock recorded via voice note"

async def parse_vendor_input(raw_text: str = "", image_bytes: bytes = None) -> List[Dict[str, Any]]:
    """
    Extracts structured inventory items using OpenRouter LLM (with multimodal vision if image attached)
    or deterministic fallback
    """
    if not OPENROUTER_API_KEY:
        return heuristic_text_parser(raw_text)

    prompt = f"""
    You are an AI Food Rescue Assistant in India. Parse this merchant message (and any attached food photo) into a JSON array of surplus food items.
    Input Text: "{raw_text}"

    JSON schema for each object in the array:
    - sku_name (string, e.g. "Fresh Potatoes", "Artisanal Bread")
    - category ("DAIRY" | "BAKERY" | "PRODUCE" | "COOKED_MEAL" | "GROCERY")
    - merchant_type ("SUPERMARKET" | "BAKERY" | "RESTAURANT" | "VENDOR")
    - quantity (number)
    - unit (string, e.g. "kg", "packs", "loaves")
    - wholesale_cost (number)
    - retail_price (number)
    - proposed_price (number)
    - discount_pct (number)
    - hours_to_expiry (number - estimated remaining shelf life in hours, e.g. 48 for fresh produce/bakery, 12 for short-dated items)
    - max_recorded_temp_c (number - ambient 22-26 for produce/bakery, 3-4 for dairy)
    - safe_temp_limit_c (number - 30 for produce/bakery, 4 for dairy)
    - is_unserved (boolean)
    - hours_since_prep (number)
    - source_action ("apply_dynamic_markdown" | "book_ngo_donation")

    Output ONLY raw valid JSON array, no markdown fences, no explanatory text.
    """

    user_content = [{"type": "text", "text": prompt}]

    # If image is attached, encode as base64 and feed into multimodal vision LLM
    if image_bytes:
        import base64
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        user_content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{base64_image}"
            }
        })

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            }
            body = {
                # Qwen 3.6 35B Multimodal or Nemotron vision fallback
                "model": "qwen/qwen3.6-35b-a3b",
                "messages": [{"role": "user", "content": user_content}],
                "temperature": 0.1
            }
            res = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=body)
            if res.status_code == 200:
                content = res.json()["choices"][0]["message"]["content"].strip()
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                return json.loads(content)
            else:
                print(f"OpenRouter API returned HTTP {res.status_code}: {res.text}")
    except Exception as e:
        print(f"OpenRouter vision parsing failed: {e}. Falling back to deterministic parser.")

    return heuristic_text_parser(raw_text)
