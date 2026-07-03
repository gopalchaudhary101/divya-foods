"""
Subscriptions router — recurring product deliveries.

GET    /subscriptions        → list user's subscriptions
POST   /subscriptions        → create subscription
PUT    /subscriptions/{id}   → update frequency / quantity / status (pause/resume)
DELETE /subscriptions/{id}   → cancel
"""
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo.database import Database

from app.dependencies import get_db, get_current_user

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])

FREQUENCY_DAYS = {"weekly": 7, "biweekly": 14, "monthly": 30}
DISCOUNT_PCT   = 10  # 10% off for subscribing


def _next_delivery(frequency: str) -> datetime:
    days = FREQUENCY_DAYS.get(frequency, 30)
    return datetime.now(timezone.utc) + timedelta(days=days)


def _sub_to_dict(doc: dict) -> dict:
    return {
        "id":           str(doc["_id"]),
        "productId":    doc.get("product_id", ""),
        "productName":  doc.get("product_name", ""),
        "productImage": doc.get("product_image"),
        "productPrice": doc.get("product_price", 0),
        "quantity":     doc.get("quantity", 1),
        "frequency":    doc.get("frequency", "monthly"),
        "status":       doc.get("status", "active"),
        "discountPct":  doc.get("discount_pct", DISCOUNT_PCT),
        "nextDelivery": doc["next_delivery"].isoformat() if doc.get("next_delivery") else None,
        "createdAt":    doc["created_at"].isoformat() if doc.get("created_at") else "",
    }


@router.get("")
def list_subscriptions(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    docs = list(
        db.subscriptions.find(
            {"user_id": str(current_user["_id"]), "status": {"$ne": "cancelled"}}
        ).sort("created_at", -1)
    )
    return {"success": True, "data": [_sub_to_dict(d) for d in docs]}


class CreateSubscriptionRequest(BaseModel):
    productId:    str
    productName:  str
    productImage: Optional[str] = None
    productPrice: float
    quantity:     int = 1
    frequency:    Literal["weekly", "biweekly", "monthly"] = "monthly"


@router.post("", status_code=201)
def create_subscription(
    body: CreateSubscriptionRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])

    existing = db.subscriptions.find_one(
        {"user_id": user_id, "product_id": body.productId, "status": "active"}
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active subscription for this product.")

    doc = {
        "user_id":       user_id,
        "product_id":    body.productId,
        "product_name":  body.productName,
        "product_image": body.productImage,
        "product_price": body.productPrice,
        "quantity":      max(1, body.quantity),
        "frequency":     body.frequency,
        "discount_pct":  DISCOUNT_PCT,
        "status":        "active",
        "next_delivery": _next_delivery(body.frequency),
        "created_at":    datetime.now(timezone.utc),
        "updated_at":    datetime.now(timezone.utc),
    }
    result = db.subscriptions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"success": True, "data": _sub_to_dict(doc)}


class UpdateSubscriptionRequest(BaseModel):
    quantity:  Optional[int] = None
    frequency: Optional[Literal["weekly", "biweekly", "monthly"]] = None
    status:    Optional[Literal["active", "paused"]] = None


@router.put("/{sub_id}")
def update_subscription(
    sub_id: str,
    body: UpdateSubscriptionRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        oid = ObjectId(sub_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid subscription ID.")

    sub = db.subscriptions.find_one({"_id": oid, "user_id": str(current_user["_id"])})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")

    update: dict = {"updated_at": datetime.now(timezone.utc)}
    if body.quantity is not None:
        update["quantity"] = max(1, body.quantity)
    if body.frequency is not None:
        update["frequency"] = body.frequency
        update["next_delivery"] = _next_delivery(body.frequency)
    if body.status is not None:
        update["status"] = body.status

    db.subscriptions.update_one({"_id": oid}, {"$set": update})
    updated = db.subscriptions.find_one({"_id": oid})
    return {"success": True, "data": _sub_to_dict(updated)}


@router.delete("/{sub_id}", status_code=204)
def cancel_subscription(
    sub_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        oid = ObjectId(sub_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid subscription ID.")

    result = db.subscriptions.update_one(
        {"_id": oid, "user_id": str(current_user["_id"])},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found.")
