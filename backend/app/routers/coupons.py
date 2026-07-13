from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from pymongo.database import Database

from app.dependencies import get_db, require_admin
from app.utils.mongo import get_object_id

router = APIRouter(prefix="/coupons", tags=["Coupons"])


class ValidateRequest(BaseModel):
    code: str
    order_amount: float


@router.post("/validate")
def validate_coupon(body: ValidateRequest, db: Database = Depends(get_db)):
    """
    Validate a coupon code against an order subtotal.
    Always returns 200 — invalid coupons return valid=false with a human-readable message.
    """
    now  = datetime.now(timezone.utc)
    code = body.code.upper().strip()

    doc = db.coupons.find_one({"code": code})
    if not doc:
        return _fail("Invalid coupon code.")

    if not doc.get("is_active", True):
        return _fail("This coupon is no longer active.")

    expires_at = doc.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < now:
            return _fail("This coupon has expired.")

    min_order = doc.get("min_order_value", 0)
    if body.order_amount < min_order:
        short = min_order - body.order_amount
        return _fail(f"Add ₹{short:,.0f} more to use this coupon (min order ₹{min_order:,.0f}).")

    if doc.get("usage_limit") and doc.get("used_count", 0) >= doc["usage_limit"]:
        return _fail("This coupon has reached its usage limit.")

    # Calculate discount
    if doc["discount_type"] == "percentage":
        discount = body.order_amount * doc["discount_value"] / 100
        if doc.get("max_discount"):
            discount = min(discount, doc["max_discount"])
        label = f"{int(doc['discount_value'])}% off"
    else:
        discount = float(doc["discount_value"])
        label = f"₹{int(discount)} flat off"

    discount = round(discount, 2)
    return {
        "success": True,
        "data": {
            "valid": True,
            "discountAmount": discount,
            "message": f"{label} applied! You save ₹{discount:,.2f}",
        },
    }


def _fail(message: str) -> dict:
    return {"success": True, "data": {"valid": False, "discountAmount": 0, "message": message}}


# ─── Admin ────────────────────────────────────────────────────────────────────
# Separate no-prefix router — these live under /admin/coupons rather than
# /coupons/... Moved here from the former monolithic admin.py.

admin_router = APIRouter(tags=["Admin"])


class CouponUpsertRequest(BaseModel):
    code: str
    discountType: str           # "percentage" | "flat"
    discountValue: float = Field(..., gt=0)
    minOrderValue: float = Field(0.0, ge=0)
    maxDiscount: Optional[float] = Field(None, gt=0)
    isActive: bool = True
    expiresAt: Optional[str] = None   # ISO-8601 string or null
    usageLimit: Optional[int] = Field(None, gt=0)

    @model_validator(mode="after")
    def _percentage_cannot_exceed_100(self):
        if self.discountType == "percentage" and self.discountValue > 100:
            raise ValueError("A percentage discount cannot exceed 100.")
        return self


def _coupon_to_dict(c: dict) -> dict:
    return {
        "id":             str(c["_id"]),
        "code":           c["code"],
        "discountType":   c["discount_type"],
        "discountValue":  c["discount_value"],
        "minOrderValue":  c.get("min_order_value", 0),
        "maxDiscount":    c.get("max_discount"),
        "isActive":       c.get("is_active", True),
        "expiresAt":      c["expires_at"].isoformat() if c.get("expires_at") else None,
        "usageLimit":     c.get("usage_limit"),
        "usedCount":      c.get("used_count", 0),
        "createdAt":      c["created_at"].isoformat(),
    }


@admin_router.get("/admin/coupons")
def admin_list_coupons(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    docs = list(db.coupons.find({}).sort("created_at", -1))
    return {"success": True, "data": [_coupon_to_dict(c) for c in docs]}


@admin_router.post("/admin/coupons")
def admin_create_coupon(
    body: CouponUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    code = body.code.upper().strip()
    if db.coupons.find_one({"code": code}):
        raise HTTPException(status_code=409, detail=f"Coupon '{code}' already exists.")

    expires = None
    if body.expiresAt:
        try:
            expires = datetime.fromisoformat(body.expiresAt.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid expiresAt date format.")

    now = datetime.now(timezone.utc)
    doc = {
        "code":            code,
        "discount_type":   body.discountType,
        "discount_value":  body.discountValue,
        "min_order_value": body.minOrderValue,
        "max_discount":    body.maxDiscount,
        "is_active":       body.isActive,
        "expires_at":      expires,
        "usage_limit":     body.usageLimit,
        "used_count":      0,
        "created_at":      now,
        "updated_at":      now,
    }
    result = db.coupons.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"success": True, "data": _coupon_to_dict(doc)}


@admin_router.put("/admin/coupons/{coupon_id}")
def admin_update_coupon(
    coupon_id: str,
    body: CouponUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    oid = get_object_id(coupon_id, "coupon")

    expires = None
    if body.expiresAt:
        try:
            expires = datetime.fromisoformat(body.expiresAt.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid expiresAt date format.")

    update = {
        "$set": {
            "code":            body.code.upper().strip(),
            "discount_type":   body.discountType,
            "discount_value":  body.discountValue,
            "min_order_value": body.minOrderValue,
            "max_discount":    body.maxDiscount,
            "is_active":       body.isActive,
            "expires_at":      expires,
            "usage_limit":     body.usageLimit,
            "updated_at":      datetime.now(timezone.utc),
        }
    }
    result = db.coupons.update_one({"_id": oid}, update)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found.")

    doc = db.coupons.find_one({"_id": oid})
    return {"success": True, "data": _coupon_to_dict(doc)}


@admin_router.delete("/admin/coupons/{coupon_id}")
def admin_delete_coupon(
    coupon_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    oid = get_object_id(coupon_id, "coupon")

    result = db.coupons.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found.")
    return {"success": True, "data": {"deleted": True}}
