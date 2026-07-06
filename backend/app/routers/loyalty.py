"""
Loyalty points router.

Points are calculated on-the-fly from delivered paid orders (floor(total) = points earned).
Redeemed points are stored on the user document so no separate ledger is needed.

GET  /loyalty/balance  → earned / redeemed / available points + recent order history
POST /loyalty/redeem   → redeem N points at checkout → returns discount amount (₹1 per 100 pts)
"""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo.database import Database

from app.dependencies import get_db, get_current_user
from app.services import membership_service

router = APIRouter(prefix="/loyalty", tags=["Loyalty"])

POINTS_PER_RUPEE  = 1        # ₹1 spent = 1 point
RUPEES_PER_POINT  = 0.10     # 100 points = ₹10 discount
MIN_REDEEM        = 100      # minimum points to redeem
BIRTHDAY_BONUS_POINTS = 500  # granted once per calendar year, on the user's birthday


def _maybe_grant_birthday_bonus(db: Database, user: dict) -> bool:
    """If today is this user's birthday and they haven't already been rewarded
    this calendar year, grants a one-off bonus. Checked opportunistically here
    (whenever a customer views their loyalty balance) since there's no scheduler
    in this project to run a daily birthday sweep."""
    dob = user.get("date_of_birth")
    if not dob:
        return False
    try:
        month, day = int(dob[5:7]), int(dob[8:10])
    except (ValueError, IndexError, TypeError):
        return False

    today = datetime.now(timezone.utc)
    if (today.month, today.day) != (month, day):
        return False
    if user.get("last_birthday_reward_year") == today.year:
        return False

    db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"bonus_points": BIRTHDAY_BONUS_POINTS}, "$set": {"last_birthday_reward_year": today.year}},
    )
    return True


def _earned(db: Database, user_id: ObjectId) -> int:
    pipeline = [
        {"$match": {"user_id": user_id, "status": "delivered", "payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]
    result = list(db.orders.aggregate(pipeline))
    return int(result[0]["total"] * POINTS_PER_RUPEE) if result else 0


@router.get("/balance")
def get_balance(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["_id"]
    birthday_bonus_granted = _maybe_grant_birthday_bonus(db, current_user)
    user_doc = db.users.find_one({"_id": user_id}) if birthday_bonus_granted else current_user

    earned       = _earned(db, user_id)
    bonus_points = int(user_doc.get("bonus_points", 0))
    redeemed     = int(user_doc.get("points_redeemed", 0))
    available    = max(0, earned + bonus_points - redeemed)

    recent = list(
        db.orders.find(
            {"user_id": user_id, "status": "delivered", "payment_status": "paid"},
            {"order_number": 1, "total": 1, "created_at": 1},
        )
        .sort("created_at", -1)
        .limit(5)
    )

    return {
        "success": True,
        "data": {
            "earned":    earned,
            "bonusPoints": bonus_points,
            "redeemed":  redeemed,
            "available": available,
            "discountPerPoint": RUPEES_PER_POINT,
            "minRedeem":        MIN_REDEEM,
            "birthdayBonusGranted": birthday_bonus_granted,
            "birthdayBonusPoints":  BIRTHDAY_BONUS_POINTS,
            "recentOrders": [
                {
                    "orderNumber": o.get("order_number", ""),
                    "total":       o.get("total", 0),
                    "points":      int(o.get("total", 0) * POINTS_PER_RUPEE),
                    "date":        o["created_at"].isoformat() if o.get("created_at") else "",
                }
                for o in recent
            ],
        },
    }


@router.get("/membership")
def get_membership(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return {"success": True, "data": membership_service.get_membership(db, current_user["_id"])}


class RedeemRequest(BaseModel):
    points: int


@router.post("/redeem")
def redeem_points(
    body: RedeemRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if body.points < MIN_REDEEM:
        raise HTTPException(status_code=400, detail=f"Minimum redemption is {MIN_REDEEM} points.")
    if body.points % 100 != 0:
        raise HTTPException(status_code=400, detail="Points must be redeemed in multiples of 100.")

    user_id      = current_user["_id"]
    earned       = _earned(db, user_id)
    bonus_points = int(current_user.get("bonus_points", 0))
    redeemed     = int(current_user.get("points_redeemed", 0))
    available    = max(0, earned + bonus_points - redeemed)

    if body.points > available:
        raise HTTPException(status_code=400, detail=f"You only have {available} points available.")

    discount = round(body.points * RUPEES_PER_POINT, 2)
    db.users.update_one(
        {"_id": user_id},
        {"$inc": {"points_redeemed": body.points}},
    )
    return {"success": True, "data": {"pointsUsed": body.points, "discount": discount}}
