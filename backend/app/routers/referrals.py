"""
Referrals router.

GET  /referrals/my      → get or auto-generate the logged-in user's referral code + signup count
POST /referrals/redeem  → redeem a referral code: marks user as referred + creates a ₹100 coupon
"""
import secrets
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo.database import Database

from app.dependencies import get_db, get_current_user

router = APIRouter(prefix="/referrals", tags=["Referrals"])


def _get_or_create_code(db: Database, user_id: str) -> str:
    user = db.users.find_one({"_id": ObjectId(user_id)}, {"referral_code": 1})
    if user and user.get("referral_code"):
        return user["referral_code"]
    code = secrets.token_urlsafe(6).upper()[:8]
    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"referral_code": code}})
    return code


@router.get("/my")
def get_my_referral(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    code = _get_or_create_code(db, user_id)
    signups = db.users.count_documents({"referred_by": code})
    return {"success": True, "data": {"code": code, "signups": signups, "creditPerSignup": 100}}


class RedeemRequest(BaseModel):
    code: str


@router.post("/redeem")
def redeem_referral(
    body: RedeemRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    code = body.code.strip().upper()

    if current_user.get("referral_code") == code:
        raise HTTPException(status_code=400, detail="You cannot redeem your own referral code.")

    if current_user.get("referred_by"):
        raise HTTPException(status_code=400, detail="You have already used a referral code.")

    referrer = db.users.find_one({"referral_code": code}, {"_id": 1})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code.")

    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"referred_by": code}})

    coupon_code = f"REF{code}{user_id[-4:].upper()}"
    db.coupons.insert_one({
        "code":            coupon_code,
        "discount_type":   "fixed",
        "discount_value":  100,
        "min_order_value": 0,
        "max_discount":    100,
        "is_active":       True,
        "expires_at":      None,
        "usage_limit":     1,
        "used_count":      0,
        "created_at":      datetime.now(timezone.utc),
        "referral":        True,
    })

    db.notifications.insert_one({
        "user_id":    referrer["_id"],
        "type":       "promotion",
        "title":      "Referral Bonus! 🎉",
        "message":    f"Someone joined using your code {code}. They get ₹100 off their first order!",
        "is_read":    False,
        "data":       {},
        "created_at": datetime.now(timezone.utc),
    })

    return {"success": True, "data": {"coupon": coupon_code, "discount": 100}}
