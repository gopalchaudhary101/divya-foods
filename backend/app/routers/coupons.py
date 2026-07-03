from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from pymongo.database import Database

from app.dependencies import get_db

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

    if doc.get("expires_at") and doc["expires_at"] < now:
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
