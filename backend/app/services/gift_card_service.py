"""
Gift cards — admin-issued store credit, redeemable at checkout.

Balance is only ever decremented once a purchase is actually committed (payment
confirmed for Razorpay orders, or immediately for COD since there's no separate
verify step) — never at initiate_order — so an abandoned checkout never burns a
gift card's balance. Mirrors the reserve/commit caution order_service already
applies to stock, just without a separate "reserved" counter: since gift card
codes are private (held by one person), the realistic double-spend window is a
single customer double-submitting, not concurrent strangers.
"""

import random
import string
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument
from pymongo.database import Database


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _generate_code() -> str:
    return "GIFT-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _to_dict(doc: dict) -> dict:
    return {
        "id":           str(doc["_id"]),
        "code":         doc["code"],
        "initialValue": doc["initial_value"],
        "balance":      doc["balance"],
        "isActive":     doc.get("is_active", True),
        "issuedToEmail": doc.get("issued_to_email"),
        "notes":        doc.get("notes"),
        "expiresAt":    doc["expires_at"].isoformat() if doc.get("expires_at") else None,
        "createdAt":    doc["created_at"].isoformat(),
        "updatedAt":    doc["updated_at"].isoformat(),
    }


def admin_issue(db: Database, payload: dict) -> dict:
    value = float(payload["value"])
    if value <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gift card value must be greater than 0.")

    code = (payload.get("code") or "").strip().upper() or _generate_code()
    if db.gift_cards.find_one({"code": code}):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Gift card code '{code}' already exists.")

    now = _utcnow()
    doc = {
        "code":           code,
        "initial_value":  value,
        "balance":        value,
        "is_active":      True,
        "issued_to_email": (payload.get("issued_to_email") or "").strip().lower() or None,
        "notes":          (payload.get("notes") or "").strip() or None,
        "expires_at":     payload.get("expires_at"),
        "created_at":     now,
        "updated_at":     now,
    }
    result = db.gift_cards.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"success": True, "data": _to_dict(doc)}


def admin_list(db: Database, page: int = 1, limit: int = 20) -> dict:
    total = db.gift_cards.count_documents({})
    docs = list(
        db.gift_cards.find({}).sort([("created_at", -1)]).skip((page - 1) * limit).limit(limit)
    )
    return {"success": True, "data": [_to_dict(d) for d in docs], "total": total, "page": page, "limit": limit}


def _get_oid(gift_card_id: str) -> ObjectId:
    try:
        return ObjectId(gift_card_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid gift card ID.")


def admin_update(db: Database, gift_card_id: str, payload: dict) -> dict:
    oid = _get_oid(gift_card_id)
    update: dict = {"updated_at": _utcnow()}
    if "is_active" in payload:
        update["is_active"] = bool(payload["is_active"])
    if "notes" in payload:
        update["notes"] = payload["notes"]
    if "expires_at" in payload:
        update["expires_at"] = payload["expires_at"]

    result = db.gift_cards.find_one_and_update(
        {"_id": oid}, {"$set": update}, return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift card not found.")
    return {"success": True, "data": _to_dict(result)}


# ─── Checkout integration (used by order_service) ────────────────────────────

def find_redeemable(db: Database, code: str) -> dict:
    """Validates a gift card code for use at checkout. Raises 400 if unusable."""
    doc = db.gift_cards.find_one({"code": code.strip().upper()})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid gift card code.")
    if not doc.get("is_active", True):
        raise HTTPException(status_code=400, detail="This gift card is no longer active.")
    expires_at = doc.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < _utcnow():
            raise HTTPException(status_code=400, detail="This gift card has expired.")
    if doc["balance"] <= 0:
        raise HTTPException(status_code=400, detail="This gift card has no remaining balance.")
    return doc


def commit_redemption(db: Database, code: str, amount: float) -> bool:
    """Atomically decrements balance; guarded so it can never go negative.
    Returns False (rather than raising) on the rare race where balance was
    already spent elsewhere — the order itself is not rolled back for this."""
    if amount <= 0:
        return True
    result = db.gift_cards.find_one_and_update(
        {"code": code.strip().upper(), "balance": {"$gte": amount}},
        {"$inc": {"balance": -amount}, "$set": {"updated_at": _utcnow()}},
    )
    return result is not None


def refund_redemption(db: Database, code: str, amount: float) -> None:
    """Restores a previously committed redemption (order cancelled after commit)."""
    if amount <= 0:
        return
    db.gift_cards.update_one(
        {"code": code.strip().upper()},
        {"$inc": {"balance": amount}, "$set": {"updated_at": _utcnow()}},
    )
