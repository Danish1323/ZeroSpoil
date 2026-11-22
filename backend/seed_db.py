import asyncio
from datetime import datetime, timezone
from backend.database import db

async def seed():
    print("Clearing collections in zerospoil_db...")
    await db.inventory_batches.delete_many({})
    await db.community_deals.delete_many({})
    await db.rescue_partners.delete_many({})
    await db.agent_audit_logs.delete_many({})

    # 1. inventory_batches (6 SKUs from FreshMart Supermarket - Panvel)
    batches = [
        {
            "batch_id": "BATCH-101",
            "merchant_name": "FreshMart Supermarket - Panvel",
            "merchant_type": "SUPERMARKET",
            "location": "Sector 19, Panvel",
            "sku_name": "Amul Taaza Homogenized Milk (1L)",
            "category": "DAIRY",
            "quantity": 30,
            "unit": "packs",
            "wholesale_cost": 48.0,
            "retail_price": 56.0,
            "current_price": 56.0,
            "hours_to_expiry": 14.0,
            "max_recorded_temp_c": 8.6,
            "safe_temp_limit_c": 4.0,
            "is_unserved": True,
            "hours_since_prep": 0.0,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "batch_id": "BATCH-102",
            "merchant_name": "FreshMart Supermarket - Panvel",
            "merchant_type": "SUPERMARKET",
            "location": "Sector 19, Panvel",
            "sku_name": "Artisanal Multigrain Sourdough Loaves",
            "category": "BAKERY",
            "quantity": 22,
            "unit": "loaves",
            "wholesale_cost": 85.0,
            "retail_price": 160.0,
            "current_price": 160.0,
            "hours_to_expiry": 26.0,
            "max_recorded_temp_c": 24.0,
            "safe_temp_limit_c": 28.0,
            "is_unserved": True,
            "hours_since_prep": 0.0,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "batch_id": "BATCH-103",
            "merchant_name": "FreshMart Supermarket - Panvel",
            "merchant_type": "SUPERMARKET",
            "location": "Sector 19, Panvel",
            "sku_name": "Gowardhan Fresh Malai Paneer (200g)",
            "category": "DAIRY",
            "quantity": 25,
            "unit": "packs",
            "wholesale_cost": 65.0,
            "retail_price": 95.0,
            "current_price": 95.0,
            "hours_to_expiry": 8.0,
            "max_recorded_temp_c": 3.1,
            "safe_temp_limit_c": 4.0,
            "is_unserved": True,
            "hours_since_prep": 0.0,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "batch_id": "BATCH-104",
            "merchant_name": "FreshMart Supermarket - Panvel",
            "merchant_type": "SUPERMARKET",
            "location": "Sector 19, Panvel",
            "sku_name": "Epigamia Greek Yogurt Assorted Pack",
            "category": "DAIRY",
            "quantity": 40,
            "unit": "tubs",
            "wholesale_cost": 55.0,
            "retail_price": 75.0,
            "current_price": 75.0,
            "hours_to_expiry": 20.0,
            "max_recorded_temp_c": 3.4,
            "safe_temp_limit_c": 4.0,
            "force_discount_pct": 60,
            "is_unserved": True,
            "hours_since_prep": 0.0,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "batch_id": "BATCH-105",
            "merchant_name": "FreshMart Supermarket - Panvel",
            "merchant_type": "SUPERMARKET",
            "location": "Sector 19, Panvel",
            "sku_name": "FarmFresh Baby Spinach & Coriander Bunches",
            "category": "PRODUCE",
            "quantity": 35,
            "unit": "bunches",
            "wholesale_cost": 18.0,
            "retail_price": 35.0,
            "current_price": 35.0,
            "hours_to_expiry": 18.0,
            "max_recorded_temp_c": 12.0,
            "safe_temp_limit_c": 15.0,
            "is_unserved": True,
            "hours_since_prep": 0.0,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "batch_id": "BATCH-106",
            "merchant_name": "FreshMart Supermarket - Panvel",
            "merchant_type": "SUPERMARKET",
            "location": "Sector 19, Panvel",
            "sku_name": "ID Fresh Idli/Dosa Batter (1kg)",
            "category": "DAIRY",
            "quantity": 18,
            "unit": "packs",
            "wholesale_cost": 52.0,
            "retail_price": 80.0,
            "current_price": 80.0,
            "hours_to_expiry": 30.0,
            "max_recorded_temp_c": 3.8,
            "safe_temp_limit_c": 4.0,
            "is_unserved": True,
            "hours_since_prep": 0.0,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.inventory_batches.insert_many(batches)

    # 2. rescue_partners
    partners = [
        {
            "_id": "PARTNER-NGO-1",
            "name": "Panvel Community Kitchen & Food Bank",
            "type": "NGO",
            "has_cold_chain": True,
            "distance_km": 1.4,
            "contact_phone": "+91 98200 11223"
        },
        {
            "_id": "PARTNER-NGO-2",
            "name": "Robin Hood Army - Navi Mumbai",
            "type": "NGO",
            "has_cold_chain": False,
            "distance_km": 2.1,
            "contact_phone": "+91 98199 44556"
        },
        {
            "_id": "PARTNER-BIO-1",
            "name": "GreenCycle Biogas & Gaushala Feed Unit",
            "type": "BIOGAS_COMPOST",
            "has_cold_chain": False,
            "distance_km": 3.5,
            "contact_phone": "+91 98333 77889"
        }
    ]
    await db.rescue_partners.insert_many(partners)

    # 3. community_deals initial seeds
    initial_deals = [
        {
            "_id": "DEAL-INIT-1",
            "batch_id": "PRE-INIT-1",
            "merchant_name": "Golden Crust Bakery",
            "merchant_type": "BAKERY",
            "location": "Sector 15, Panvel",
            "item_summary": "Fresh Cream Pineapple Pastries (Box of 4)",
            "original_price": 280.0,
            "clearance_price": 140.0,
            "discount_pct": 50,
            "quantity_remaining": 6,
            "unit": "boxes",
            "ngo_free_eligible": False,
            "source_channel": "WHATSAPP_VOICE",
            "raw_input_preview": "Voice note from owner: 6 pastry boxes remaining",
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "_id": "DEAL-INIT-2",
            "batch_id": "PRE-INIT-2",
            "merchant_name": "Sahyadri Farmers Cooperative",
            "merchant_type": "VENDOR",
            "location": "Khanda Colony, Panvel",
            "item_summary": "Organic Shimla Apples (Grade A)",
            "original_price": 180.0,
            "clearance_price": 90.0,
            "discount_pct": 50,
            "quantity_remaining": 15,
            "unit": "kg",
            "ngo_free_eligible": False,
            "source_channel": "WHATSAPP_PHOTO",
            "raw_input_preview": "Fresh apple crate photo",
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.community_deals.insert_many(initial_deals)

    print("Database seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed())
