"""
Order service — Razorpay payment flow + order management.

Flow:
  1. create_razorpay_order()  → creates a Razorpay order, returns razorpay_order_id
  2. create_order()           → saves our order doc with status=pending
  3. verify_payment()         → HMAC-SHA256 check → marks order paid + clears server cart
"""

import hashlib
import hmac
from datetime import datetime, timezone
from typing import Optional

import razorpay
from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.database import Database

from app.config import settings
from app.models.address import AddressSnapshot
from app.services import email_service


def _get_customer_email(db: Database, user_id) -> str:
    """Fetch customer email for sending transactional emails."""
    try:
        user = db.users.find_one({"_id": user_id}, {"email": 1})
        return user.get("email", "") if user else ""
    except Exception:
        return ""


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _rzp_client() -> razorpay.Client:
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env",
        )
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def _generate_order_number(db: Database) -> str:
    year = _utcnow().year
    count = db.orders.count_documents({}) + 1
    return f"DF-{year}-{count:06d}"


def _order_to_dict(doc: dict) -> dict:
    return {
        "id":               str(doc["_id"]),
        "orderNumber":      doc["order_number"],
        "status":           doc["status"],
        "paymentStatus":    doc["payment_status"],
        "paymentMethod":    doc["payment_method"],
        "razorpayOrderId":  doc.get("razorpay_order_id"),
        "razorpayPaymentId":doc.get("razorpay_payment_id"),
        "deliveryAddress":  doc["delivery_address"],
        "items":            [
            {
                "productId": str(i["product_id"]),
                "name":      i["name"],
                "price":     i["price"],
                "quantity":  i["quantity"],
                "image":     i.get("image", ""),
            }
            for i in doc.get("items", [])
        ],
        "subtotal":         doc["subtotal"],
        "deliveryCharge":   doc["delivery_charge"],
        "discount":         doc.get("discount", 0.0),
        "total":            doc["total"],
        "couponCode":       doc.get("coupon_code"),
        "notes":            doc.get("notes"),
        "trackingTimeline": [
            {"status": e["status"], "timestamp": e["timestamp"].isoformat(), "note": e.get("note")}
            for e in doc.get("tracking_timeline", [])
        ],
        "createdAt":        doc["created_at"].isoformat(),
        "updatedAt":        doc["updated_at"].isoformat(),
    }


# ─── Address resolution ───────────────────────────────────────────────────────

def _resolve_address(
    db: Database,
    user_id: ObjectId,
    address_id: Optional[str],
    inline_address: Optional[dict],
) -> dict:
    """Return an address snapshot dict from either a saved address or inline input."""
    if address_id:
        try:
            oid = ObjectId(address_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid address ID.")
        saved = db.addresses.find_one({"_id": oid, "user_id": user_id})
        if not saved:
            raise HTTPException(status_code=404, detail="Address not found.")
        return {
            "label":         saved["label"],
            "full_name":     saved["full_name"],
            "phone":         saved["phone"],
            "address_line1": saved["address_line1"],
            "address_line2": saved.get("address_line2"),
            "city":          saved["city"],
            "state":         saved["state"],
            "pincode":       saved["pincode"],
        }
    if inline_address:
        return inline_address
    raise HTTPException(status_code=400, detail="Provide either address_id or delivery_address.")


# ─── Coupon validation (basic) ────────────────────────────────────────────────

def _apply_coupon(db: Database, code: str, subtotal: float) -> float:
    """Return discount amount. Returns 0 if coupon is invalid or expired."""
    if not code:
        return 0.0
    doc = db.coupons.find_one({"code": code.upper(), "is_active": True})
    if not doc:
        return 0.0
    # Check expiry
    if doc.get("expires_at") and doc["expires_at"] < _utcnow():
        return 0.0
    # Check minimum order value
    if doc.get("min_order_value") and subtotal < doc["min_order_value"]:
        return 0.0
    # Calculate discount
    if doc["discount_type"] == "percentage":
        discount = subtotal * doc["discount_value"] / 100
        if doc.get("max_discount"):
            discount = min(discount, doc["max_discount"])
    else:
        discount = float(doc["discount_value"])
    return round(discount, 2)


# ─── Core functions ───────────────────────────────────────────────────────────

FREE_DELIVERY_ABOVE = 999.0
DELIVERY_CHARGE     = 100.0


def initiate_order(db: Database, user: dict, body: dict) -> dict:
    """
    Step 1 of checkout:
    - Validate cart is not empty
    - Calculate totals (including coupon)
    - Create Razorpay order
    - Save our order document with status=pending / payment_status=pending
    - Return {order_id, razorpay_order_id, razorpay_key_id, total}
    """
    user_id = user["_id"]

    # ── Get cart items ────────────────────────────────────────────────────────
    # Accept items either from server cart or from the request body (client cart)
    items = body.get("items", [])
    if not items:
        server_cart = db.carts.find_one({"user_id": user_id})
        items = server_cart.get("items", []) if server_cart else []
    if not items:
        raise HTTPException(status_code=400, detail="Your cart is empty.")

    # ── Validate product prices against DB ────────────────────────────────────
    order_items = []
    subtotal = 0.0
    for item in items:
        pid = item.get("productId") or item.get("product_id")
        try:
            oid = ObjectId(pid)
        except Exception:
            continue
        product = db.products.find_one({"_id": oid}, {"name": 1, "price": 1, "images": 1, "in_stock": 1})
        if not product or not product.get("in_stock", True):
            raise HTTPException(status_code=400, detail=f"'{item.get('name', pid)}' is out of stock.")
        qty = int(item.get("quantity", 1))
        price = float(product["price"])          # always use DB price — never trust client price
        order_items.append({
            "product_id": oid,
            "name":       product["name"],
            "price":      price,
            "quantity":   qty,
            "image":      (product.get("images") or [""])[0],
        })
        subtotal += price * qty

    subtotal = round(subtotal, 2)
    delivery_charge = 0.0 if subtotal >= FREE_DELIVERY_ABOVE else DELIVERY_CHARGE

    # ── Coupon ────────────────────────────────────────────────────────────────
    coupon_code = (body.get("coupon_code") or "").strip().upper() or None
    discount = _apply_coupon(db, coupon_code or "", subtotal) if coupon_code else 0.0
    total = round(subtotal + delivery_charge - discount, 2)

    # ── Address ───────────────────────────────────────────────────────────────
    address_snapshot = _resolve_address(
        db,
        user_id,
        body.get("delivery_address_id"),
        body.get("delivery_address"),
    )

    payment_method = body.get("payment_method", "razorpay")

    # ── Create Razorpay order ─────────────────────────────────────────────────
    rzp_order_id = None
    if payment_method == "razorpay":
        rzp = _rzp_client()
        rzp_resp = rzp.order.create({
            "amount":   int(total * 100),   # Razorpay works in paise
            "currency": "INR",
            "receipt":  f"divya-{user_id}",
            "payment_capture": 1,
        })
        rzp_order_id = rzp_resp["id"]

    # ── Save order ────────────────────────────────────────────────────────────
    order_number = _generate_order_number(db)
    now = _utcnow()
    doc = {
        "order_number":      order_number,
        "user_id":           user_id,
        "items":             order_items,
        "status":            "pending",
        "payment_status":    "pending",
        "payment_method":    payment_method,
        "razorpay_order_id": rzp_order_id,
        "delivery_address":  address_snapshot,
        "subtotal":          subtotal,
        "delivery_charge":   delivery_charge,
        "discount":          discount,
        "total":             total,
        "coupon_code":       coupon_code,
        "notes":             body.get("notes", ""),
        "tracking_timeline": [{"status": "pending", "timestamp": now, "note": "Order placed"}],
        "created_at":        now,
        "updated_at":        now,
    }
    result = db.orders.insert_one(doc)
    order_id = str(result.inserted_id)

    return {
        "success": True,
        "data": {
            "orderId":         order_id,
            "orderNumber":     order_number,
            "razorpayOrderId": rzp_order_id,
            "razorpayKeyId":   settings.RAZORPAY_KEY_ID,
            "amount":          total,
            "currency":        "INR",
        },
    }


def verify_payment(db: Database, user: dict, body: dict) -> dict:
    """
    Step 2 — called from frontend after Razorpay popup succeeds.
    Verifies HMAC-SHA256 signature. On success:
      - Marks order as confirmed + paid
      - Clears the server-side cart
    """
    order_id      = body.get("order_id")
    rzp_order_id  = body.get("razorpay_order_id")
    rzp_payment_id= body.get("razorpay_payment_id")
    rzp_signature = body.get("razorpay_signature")

    # ── Verify signature ──────────────────────────────────────────────────────
    if not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail="Payment secret not configured.")

    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{rzp_order_id}|{rzp_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, rzp_signature or ""):
        raise HTTPException(status_code=400, detail="Payment verification failed — invalid signature.")

    # ── Update order ──────────────────────────────────────────────────────────
    try:
        oid = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID.")

    now = _utcnow()
    result = db.orders.update_one(
        {"_id": oid, "user_id": user["_id"]},
        {
            "$set": {
                "status":              "confirmed",
                "payment_status":      "paid",
                "razorpay_payment_id": rzp_payment_id,
                "razorpay_signature":  rzp_signature,
                "updated_at":          now,
            },
            "$push": {
                "tracking_timeline": {
                    "status":    "confirmed",
                    "timestamp": now,
                    "note":      "Payment received via Razorpay",
                }
            },
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found.")

    # ── Clear server cart ─────────────────────────────────────────────────────
    db.carts.update_one(
        {"user_id": user["_id"]},
        {"$set": {"items": [], "updated_at": now}},
    )

    doc = db.orders.find_one({"_id": oid})

    # Send order confirmation email (non-blocking)
    customer_email = _get_customer_email(db, user["_id"])
    email_service.order_confirmation(_order_to_dict(doc), customer_email)

    return {"success": True, "data": _order_to_dict(doc)}


def get_my_orders(db: Database, user_id: ObjectId, page: int = 1, limit: int = 10) -> dict:
    skip = (page - 1) * limit
    total = db.orders.count_documents({"user_id": user_id})
    docs = list(
        db.orders.find({"user_id": user_id})
        .sort([("created_at", -1)])
        .skip(skip)
        .limit(limit)
    )
    return {
        "success": True,
        "data": [_order_to_dict(d) for d in docs],
        "total": total,
        "page": page,
        "totalPages": -(-total // limit),   # ceiling division
    }


def get_order_by_id(db: Database, user_id: ObjectId, order_id: str) -> dict:
    try:
        oid = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID.")
    doc = db.orders.find_one({"_id": oid, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found.")
    return {"success": True, "data": _order_to_dict(doc)}


# ─── Customer: cancel own order ───────────────────────────────────────────────

CANCELLABLE_STATUSES = {"pending", "confirmed"}


def cancel_order(db: Database, user_id: ObjectId, order_id: str, reason: str = "") -> dict:
    """Customer cancels their own order. Only allowed when pending or confirmed."""
    try:
        oid = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID.")

    doc = db.orders.find_one({"_id": oid, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found.")
    if doc["status"] not in CANCELLABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel an order with status '{doc['status']}'. Contact support.",
        )

    now = _utcnow()
    db.orders.update_one(
        {"_id": oid},
        {
            "$set": {
                "status":         "cancelled",
                "payment_status": "refunded" if doc["payment_status"] == "paid" else doc["payment_status"],
                "updated_at":     now,
            },
            "$push": {
                "tracking_timeline": {
                    "status":    "cancelled",
                    "timestamp": now,
                    "note":      reason or "Cancelled by customer",
                }
            },
        },
    )

    # Restore stock for each item
    for item in doc.get("items", []):
        db.products.update_one(
            {"_id": item["product_id"]},
            {"$inc": {"stock_quantity": item["quantity"]}},
        )

    updated = db.orders.find_one({"_id": oid})
    order_dict = _order_to_dict(updated)

    # Send cancellation email (non-blocking)
    customer_email = _get_customer_email(db, user_id)
    email_service.order_cancelled(order_dict, customer_email, reason)

    return {"success": True, "data": order_dict}


# ─── Admin: list all orders ───────────────────────────────────────────────────

def admin_list_orders(
    db: Database,
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    if search:
        # Search by order number or customer name in address
        query["$or"] = [
            {"order_number": {"$regex": search, "$options": "i"}},
            {"delivery_address.full_name": {"$regex": search, "$options": "i"}},
            {"delivery_address.phone": {"$regex": search, "$options": "i"}},
        ]

    skip  = (page - 1) * limit
    total = db.orders.count_documents(query)
    docs  = list(
        db.orders.find(query)
        .sort([("created_at", -1)])
        .skip(skip)
        .limit(limit)
    )
    return {
        "success":    True,
        "data":       [_order_to_dict(d) for d in docs],
        "total":      total,
        "page":       page,
        "totalPages": -(-total // limit),
    }


def admin_get_order(db: Database, order_id: str) -> dict:
    try:
        oid = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID.")
    doc = db.orders.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found.")
    return {"success": True, "data": _order_to_dict(doc)}


# ─── Admin: update order status ───────────────────────────────────────────────

VALID_TRANSITIONS = {
    "pending":    {"confirmed", "cancelled"},
    "confirmed":  {"processing", "cancelled"},
    "processing": {"shipped", "cancelled"},
    "shipped":    {"delivered"},
    "delivered":  set(),
    "cancelled":  set(),
}


def admin_update_status(
    db: Database,
    order_id: str,
    new_status: str,
    note: str = "",
) -> dict:
    try:
        oid = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID.")

    doc = db.orders.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found.")

    current = doc["status"]
    allowed = VALID_TRANSITIONS.get(current, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move order from '{current}' to '{new_status}'.",
        )

    now = _utcnow()
    update: dict = {
        "$set": {"status": new_status, "updated_at": now},
        "$push": {
            "tracking_timeline": {
                "status":    new_status,
                "timestamp": now,
                "note":      note or f"Status updated to {new_status}",
            }
        },
    }

    # Mark payment as refunded when admin cancels a paid order
    if new_status == "cancelled" and doc["payment_status"] == "paid":
        update["$set"]["payment_status"] = "refunded"

    # Restore stock on admin cancellation
    if new_status == "cancelled":
        for item in doc.get("items", []):
            db.products.update_one(
                {"_id": item["product_id"]},
                {"$inc": {"stock_quantity": item["quantity"]}},
            )

    db.orders.update_one({"_id": oid}, update)
    updated    = db.orders.find_one({"_id": oid})
    order_dict = _order_to_dict(updated)

    # Send status-change emails (non-blocking)
    customer_email = _get_customer_email(db, doc["user_id"])
    if new_status == "shipped":
        email_service.order_shipped(order_dict, customer_email, note)
    elif new_status == "delivered":
        email_service.order_delivered(order_dict, customer_email)
    elif new_status == "cancelled":
        email_service.order_cancelled(order_dict, customer_email, note)

    return {"success": True, "data": order_dict}
