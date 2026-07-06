"""
Membership tiers — Silver (default) / Gold / Platinum, computed from a customer's
lifetime *paid* spend (all paid orders regardless of delivery status — unlike loyalty
points in loyalty.py, which only count *delivered* orders). Thresholds and the
delivery perk each tier unlocks are admin-configurable via settings_service, so
tuning them never requires a code change.
"""

from bson import ObjectId
from pymongo.database import Database

from app.services import settings_service


def get_lifetime_spend(db: Database, user_id: ObjectId) -> float:
    pipeline = [
        {"$match": {"user_id": user_id, "payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]
    result = list(db.orders.aggregate(pipeline))
    return float(result[0]["total"]) if result else 0.0


def _perks_for(tier: str, cfg: dict) -> dict:
    if tier == "Platinum":
        return {"freeDelivery": True, "freeDeliveryAbove": None}
    if tier == "Gold":
        return {"freeDelivery": False, "freeDeliveryAbove": cfg["goldFreeDeliveryAbove"]}
    return {"freeDelivery": False, "freeDeliveryAbove": None}


def get_membership(db: Database, user_id: ObjectId) -> dict:
    cfg = settings_service.get_membership_settings(db)
    spend = get_lifetime_spend(db, user_id)

    if spend >= cfg["platinumThreshold"]:
        tier, next_tier, next_at = "Platinum", None, None
    elif spend >= cfg["goldThreshold"]:
        tier, next_tier, next_at = "Gold", "Platinum", cfg["platinumThreshold"]
    else:
        tier, next_tier, next_at = "Silver", "Gold", cfg["goldThreshold"]

    return {
        "tier":              tier,
        "lifetimeSpend":     round(spend, 2),
        "nextTier":          next_tier,
        "amountToNextTier":  round(max(0.0, next_at - spend), 2) if next_at is not None else None,
        "perks":             _perks_for(tier, cfg),
    }


def get_delivery_charge(
    db: Database, user_id: ObjectId, subtotal: float,
    standard_charge: float, standard_free_above: float,
) -> float:
    """Applies the customer's membership delivery perk on top of the standard
    free-delivery threshold. Silver customers see no change from prior behaviour."""
    if subtotal >= standard_free_above:
        return 0.0

    perks = get_membership(db, user_id)["perks"]
    if perks["freeDelivery"]:
        return 0.0
    if perks["freeDeliveryAbove"] is not None and subtotal >= perks["freeDeliveryAbove"]:
        return 0.0
    return standard_charge
