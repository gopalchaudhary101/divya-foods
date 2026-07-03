"""
Loyalty points router.

Points are calculated on-the-fly from delivered paid orders (floor(total) = points earned).
Redeemed points are stored on the user document so no separate ledger is needed.

GET  /loyalty/balance  → earned / redeemed / available points + recent order history
POST /loyalty/redeem   → redeem N points at checkout → returns discount amount (₹1 per 100 pts)
"""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo.database import Database

from app.dependencies import get_db, get_current_user

router = APIRouter(prefix="/loyalty", tags=["Loyalty"])

POINTS_PER_RUPEE  = 1        # ₹1 spent = 1 point
RUPEES_PER_POINT  = 0.10     # 100 points = ₹10 discount
MIN_REDEEM        = 100      # minimum points to redeem


def _earned(db: Database, user_id: str) -> int:
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
    user_id = str(current_user["_id"])
    earned   = _earned(db, user_id)
    redeemed = int(current_user.get("points_redeemed", 0))
    available = max(0, earned - redeemed)

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
            "redeemed":  redeemed,
            "available": available,
            "discountPerPoint": RUPEES_PER_POINT,
            "minRedeem":        MIN_REDEEM,
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

    user_id  = str(current_user["_id"])
    earned   = _earned(db, user_id)
    redeemed = int(current_user.get("points_redeemed", 0))
    available = max(0, earned - redeemed)

    if body.points > available:
        raise HTTPException(status_code=400, detail=f"You only have {available} points available.")

    discount = round(body.points * RUPEES_PER_POINT, 2)
    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"points_redeemed": body.points}},
    )
    return {"success": True, "data": {"pointsUsed": body.points, "discount": discount}}
