from datetime import datetime, timezone
from typing import Dict, Any, Tuple

def evaluate_safety_rails(item: Dict[str, Any], proposed_action: str, proposed_price: float = None) -> Tuple[str, str, str, str]:
    """
    Pure Python deterministic FSSAI & cold-chain policy engine (zero LLM dependency).
    Returns: (verdict, final_tool, rail_triggered, explanation)
    
    Verdicts:
      - APPROVED: Passes all safety rules and margin constraints
      - BLOCKED_REROUTED: Critical safety breach -> routed to biogas/compost
      - PAUSED_HITL: Margin or operational violation needing human intervention
    """
    category = item.get("category", "").upper()
    merchant_type = item.get("merchant_type", "SUPERMARKET").upper()
    max_temp = float(item.get("max_recorded_temp_c", 0.0))
    
    # Safe temperature threshold defaults: Produce/Bakery can stay ambient (up to 30°C), while Dairy/Chilled must stay <= 4.0°C
    default_safe_temp = 4.0 if category in ["DAIRY", "MEAT", "CHILLED"] else 30.0
    safe_temp = float(item.get("safe_temp_limit_c", default_safe_temp))
    
    # If produce/dry bakery was passed with 4.0°C by mistake, adjust to ambient 30.0°C
    if category in ["PRODUCE", "BAKERY", "GROCERY"] and safe_temp <= 10.0:
        safe_temp = 30.0
    # Default shelf life: If the AI returns 0 or None for fresh ambient food, default to 48.0h remaining
    hours_to_exp = float(item.get("hours_to_expiry") if item.get("hours_to_expiry") is not None else 48.0)
    if hours_to_exp == 0 and category in ["PRODUCE", "BAKERY", "GROCERY"]:
        hours_to_exp = 48.0 # Fresh produce or bakery item entered without explicit expiry timestamp
    is_unserved = item.get("is_unserved", True)
    hours_since_prep = float(item.get("hours_since_prep", 0.0))
    wholesale_cost = float(item.get("wholesale_cost", 0.0))

    # RULE 1: Cold Chain & Expiry Hard-Lock
    # If temperature exceeded threshold or item has already expired
    if max_temp > safe_temp:
        return (
            "BLOCKED_REROUTED",
            "route_to_biogas_compost",
            "COLD_CHAIN_FOOD_SAFETY_LOCK",
            f"Cold-chain breach: recorded {max_temp}°C exceeds safe threshold of {safe_temp}°C. Human consumption blocked per food safety protocol."
        )

    if hours_to_exp < 0:
        return (
            "BLOCKED_REROUTED",
            "route_to_biogas_compost",
            "EXPIRED_PRODUCT_LOCK",
            f"Item has expired (hours_to_expiry = {hours_to_exp}h). Human consumption strictly prohibited."
        )

    # RULE 2: FSSAI Cooked Food 2-Hour Danger Zone Lock
    # Cooked food or cream-based dairy from restaurants/bakeries left out > 2 hours or served buffet trays
    if merchant_type in ["RESTAURANT", "BAKERY"] and (
        category in ["COOKED_MEAL", "CREAM_DAIRY", "GRAVY", "BUFFET"] or "GRAVY" in item.get("sku_name", "").upper()
    ):
        if not is_unserved or hours_since_prep > 2.0:
            return (
                "BLOCKED_REROUTED",
                "route_to_biogas_compost",
                "FSSAI_COOKED_FOOD_DANGER_ZONE_LOCK",
                f"FSSAI Danger Zone violation: Cooked food sitting unchilled for {hours_since_prep}h (limit 2.0h) or served tray. Rerouted to biogas/compost."
            )

    # RULE 3: Wholesale Margin Floor HITL Gate
    if proposed_price is not None and proposed_action == "apply_dynamic_markdown":
        if proposed_price < wholesale_cost:
            return (
                "PAUSED_HITL",
                "paused_for_approval",
                "WHOLESALE_MARGIN_FLOOR_GATE",
                f"Negative margin detected: Proposed price ₹{proposed_price:.2f} is below wholesale cost ₹{wholesale_cost:.2f}. Awaiting manager sign-off."
            )

    # Default approval
    return ("APPROVED", proposed_action, "NONE", "Safety and margin policies validated successfully.")
