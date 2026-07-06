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
from app.utils import push_service
from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.database import Database

from app.config import settings
from app.models.address import AddressSnapshot
from app.services import email_service, invoice_service, product_service, settings_service, membership_service, gift_card_service


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


# ─── Order lifecycle: stock reserve/commit/release ────────────────────────────
# stock_quantity decrements at order placement (reserved_stock tracks how much of
# that decrement is still tied up in an unpaid order); the reservation is released
# — without touching stock_quantity again — once payment is verified (committed)
# or the still-unpaid order is cancelled (released). If a *paid* order is later
# cancelled, the existing unconditional stock_quantity restore below handles that
# (unchanged from before) since the reservation was already released at payment time.

def _reserve_stock(db: Database, order_items: list[dict], order_id: str) -> None:
    """Decrements stock_quantity + increments reserved_stock, atomically per item.
    Availability must already have been checked by the caller."""
    for item in order_items:
        pid, qty = item["product_id"], item["quantity"]
        result = db.products.update_one(
            {"_id": pid, "stock_quantity": {"$gte": qty}},
            {"$inc": {"stock_quantity": -qty, "reserved_stock": qty}, "$set": {"updated_at": _utcnow()}},
        )
        if result.matched_count:
            product = db.products.find_one({"_id": pid}, {"stock_quantity": 1})
            product_service.log_stock_movement(
                db, pid, "order_placed", -qty, product["stock_quantity"],
                reference_type="order", reference_id=str(order_id),
            )


def _release_reserved_stock(db: Database, order_items: list[dict]) -> None:
    """Decrements reserved_stock only (floored at 0) — used both when a reservation
    converts into a firm sale (payment verified) and when it's abandoned (order
    cancelled before payment ever completed). stock_quantity is untouched either way."""
    for item in order_items:
        db.products.update_one(
            {"_id": item["product_id"]},
            [{"$set": {
                "reserved_stock": {
                    "$max": [0, {"$subtract": [{"$ifNull": ["$reserved_stock", 0]}, item["quantity"]]}],
                },
            }}],
        )


def _delivery_to_dict(d: Optional[dict]) -> Optional[dict]:
    """Converts the embedded `delivery` sub-document to the camelCase shape the frontend expects."""
    if not d:
        return None
    return {
        "provider":            d.get("provider"),
        "trackingId":          d.get("tracking_id"),
        "bookingId":           d.get("booking_id"),
        "partnerName":         d.get("partner_name"),
        "driverId":            str(d["driver_id"]) if d.get("driver_id") else None,
        "driverName":          d.get("driver_name"),
        "driverPhone":         d.get("driver_phone"),
        "vehicleNumber":       d.get("vehicle_number"),
        "vehicleType":         d.get("vehicle_type"),
        "deliveryCharge":      d.get("delivery_charge"),
        "notes":               d.get("notes"),
        "deliveryStatus":      d.get("delivery_status"),
        "estimatedDeliveryAt": d["estimated_delivery_at"].isoformat() if d.get("estimated_delivery_at") else None,
        "proofOfDeliveryUrl":  d.get("proof_of_delivery_url"),
        "deliveredAt":         d["delivered_at"].isoformat() if d.get("delivered_at") else None,
        "createdAt":           d["created_at"].isoformat() if d.get("created_at") else None,
        "updatedAt":           d["updated_at"].isoformat() if d.get("updated_at") else None,
    }


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
        "giftCardCode":     doc.get("gift_card_code"),
        "giftCardAmount":   doc.get("gift_card_amount", 0.0),
        "notes":            doc.get("notes"),
        "trackingTimeline": [
            {"status": e["status"], "timestamp": e["timestamp"].isoformat(), "note": e.get("note")}
            for e in doc.get("tracking_timeline", [])
        ],
        "delivery":         _delivery_to_dict(doc.get("delivery")),
        "deliverySlot": (
            {"type": doc["delivery_slot"]["type"], "date": doc["delivery_slot"].get("date"), "timeWindow": doc["delivery_slot"].get("time_window")}
            if doc.get("delivery_slot") else None
        ),
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
    expires_at = doc.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < _utcnow():
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

DELIVERY_SLOT_TYPES = {"express", "scheduled"}


def _validate_delivery_slot(raw: Optional[dict]) -> Optional[dict]:
    """
    Optional checkout choice — {"type": "express"} for the existing default
    fastest-dispatch flow, or {"type": "scheduled", "date": "YYYY-MM-DD", "timeWindow": "10am-1pm"}
    for a customer-picked slot. Absent entirely on orders placed before this existed.
    """
    if not raw:
        return None
    slot_type = raw.get("type")
    if slot_type not in DELIVERY_SLOT_TYPES:
        raise HTTPException(status_code=400, detail=f"deliverySlot.type must be one of: {', '.join(DELIVERY_SLOT_TYPES)}")
    slot: dict = {"type": slot_type}
    if slot_type == "scheduled":
        date = (raw.get("date") or "").strip()
        time_window = (raw.get("timeWindow") or "").strip()
        if not date or not time_window:
            raise HTTPException(status_code=400, detail="Scheduled delivery requires both date and timeWindow.")
        try:
            datetime.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="deliverySlot.date must be an ISO date (YYYY-MM-DD).")
        slot["date"] = date
        slot["time_window"] = time_window
    return slot


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
        product = db.products.find_one(
            {"_id": oid},
            {"name": 1, "price": 1, "images": 1, "in_stock": 1, "stock_quantity": 1, "reserved_stock": 1},
        )
        if not product or not product.get("in_stock", True):
            raise HTTPException(status_code=400, detail=f"'{item.get('name', pid)}' is out of stock.")
        qty = int(item.get("quantity", 1))
        available = product.get("stock_quantity", 0) - product.get("reserved_stock", 0)
        if qty > available:
            raise HTTPException(
                status_code=400,
                detail=f"Only {max(available, 0)} unit(s) of '{product['name']}' available.",
            )
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
    delivery_charge = membership_service.get_delivery_charge(
        db, user_id, subtotal, DELIVERY_CHARGE, FREE_DELIVERY_ABOVE,
    )

    # ── Coupon ────────────────────────────────────────────────────────────────
    coupon_code = (body.get("coupon_code") or "").strip().upper() or None
    discount = _apply_coupon(db, coupon_code or "", subtotal) if coupon_code else 0.0
    total_before_gift_card = round(max(0.0, subtotal + delivery_charge - discount), 2)

    # ── Gift card ─────────────────────────────────────────────────────────────
    # Validated here (raises 400 if the code is unusable) but the balance itself
    # is only decremented once the purchase is committed — see commit at
    # verify_payment (Razorpay) / immediately below (COD, no separate verify step).
    gift_card_code = (body.get("gift_card_code") or "").strip().upper() or None
    gift_card_amount = 0.0
    if gift_card_code:
        gift_card_doc = gift_card_service.find_redeemable(db, gift_card_code)
        gift_card_amount = round(min(gift_card_doc["balance"], total_before_gift_card), 2)

    total = round(total_before_gift_card - gift_card_amount, 2)

    # ── Address ───────────────────────────────────────────────────────────────
    address_snapshot = _resolve_address(
        db,
        user_id,
        body.get("delivery_address_id"),
        body.get("delivery_address"),
    )

    payment_method = body.get("payment_method", "razorpay")
    # A gift card can cover the entire order — no payment gateway needed at all in that case.
    fully_covered = total <= 0

    # ── Create Razorpay order ─────────────────────────────────────────────────
    rzp_order_id = None
    if payment_method == "razorpay" and not fully_covered:
        rzp = _rzp_client()
        rzp_resp = rzp.order.create({
            "amount":   int(total * 100),   # Razorpay works in paise
            "currency": "INR",
            "receipt":  f"divya-{user_id}",
            "payment_capture": 1,
        })
        rzp_order_id = rzp_resp["id"]

    # Orders with no gateway step (COD, or fully covered by a gift card) are
    # committed immediately — there's no separate verify_payment call for them.
    commits_immediately = fully_covered or payment_method != "razorpay"

    # ── Save order ────────────────────────────────────────────────────────────
    order_number = _generate_order_number(db)
    now = _utcnow()
    doc = {
        "order_number":        order_number,
        "user_id":             user_id,
        "items":               order_items,
        "status":              "confirmed" if fully_covered else "pending",
        "payment_status":      "paid" if fully_covered else "pending",
        "payment_method":      payment_method,
        "razorpay_order_id":   rzp_order_id,
        "delivery_address":    address_snapshot,
        "subtotal":            subtotal,
        "delivery_charge":     delivery_charge,
        "discount":            discount,
        "total":               total,
        "coupon_code":         coupon_code,
        "gift_card_code":      gift_card_code,
        "gift_card_amount":    gift_card_amount,
        "gift_card_committed": False,
        "notes":               body.get("notes", ""),
        "delivery_slot":       _validate_delivery_slot(body.get("delivery_slot")),
        "tracking_timeline": [
            {"status": "pending", "timestamp": now, "note": "Order placed"},
            *([{"status": "confirmed", "timestamp": now, "note": "Fully covered by gift card"}] if fully_covered else []),
        ],
        "created_at":        now,
        "updated_at":        now,
    }
    result = db.orders.insert_one(doc)
    order_id = str(result.inserted_id)

    _reserve_stock(db, order_items, order_id)
    if fully_covered:
        # Payment is already settled — release the reservation immediately, same as verify_payment does.
        _release_reserved_stock(db, order_items)

    if gift_card_code and commits_immediately:
        gift_card_service.commit_redemption(db, gift_card_code, gift_card_amount)
        db.orders.update_one({"_id": result.inserted_id}, {"$set": {"gift_card_committed": True}})

    # For COD/fully-covered orders send confirmation immediately (Razorpay orders send it after verify_payment)
    if commits_immediately:
        if fully_covered:
            db.carts.update_one({"user_id": user_id}, {"$set": {"items": [], "updated_at": now}})
        customer_email = _get_customer_email(db, user_id)
        email_service.order_confirmation(_order_to_dict(db.orders.find_one({"_id": result.inserted_id})), customer_email)

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

    # Payment confirmed — the reservation made at checkout is now a firm sale.
    # stock_quantity was already decremented in initiate_order; only the reserved
    # counter needs releasing.
    _release_reserved_stock(db, doc.get("items", []))

    # Payment just confirmed — this is the commit point for any gift card used at checkout.
    if doc.get("gift_card_code") and not doc.get("gift_card_committed"):
        gift_card_service.commit_redemption(db, doc["gift_card_code"], doc.get("gift_card_amount", 0.0))
        db.orders.update_one({"_id": oid}, {"$set": {"gift_card_committed": True}})
        doc["gift_card_committed"] = True

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

    # Restore stock for each item (stock_quantity was decremented at checkout regardless
    # of payment status — see _reserve_stock in initiate_order)
    for item in doc.get("items", []):
        db.products.update_one(
            {"_id": item["product_id"]},
            {"$inc": {"stock_quantity": item["quantity"]}},
        )
        product = db.products.find_one({"_id": item["product_id"]}, {"stock_quantity": 1})
        product_service.log_stock_movement(
            db, item["product_id"], "order_cancelled", item["quantity"], product["stock_quantity"],
            reference_type="order", reference_id=str(oid),
        )

    # If payment was never verified, the reservation from checkout is still outstanding
    # and needs releasing too (already-paid orders had theirs released at verify_payment).
    if doc["payment_status"] != "paid":
        _release_reserved_stock(db, doc.get("items", []))

    # Refund any gift card redemption that was already committed (COD, or a Razorpay
    # order that had already been paid before cancellation).
    if doc.get("gift_card_code") and doc.get("gift_card_committed"):
        gift_card_service.refund_redemption(db, doc["gift_card_code"], doc.get("gift_card_amount", 0.0))
        db.orders.update_one({"_id": oid}, {"$set": {"gift_card_committed": False}})

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
    delivery_status_filter: Optional[str] = None,
) -> dict:
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    if delivery_status_filter:
        query["delivery.delivery_status"] = delivery_status_filter
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

    # Restore stock on admin cancellation (stock_quantity was decremented at checkout
    # regardless of payment status — see _reserve_stock in initiate_order)
    if new_status == "cancelled":
        for item in doc.get("items", []):
            db.products.update_one(
                {"_id": item["product_id"]},
                {"$inc": {"stock_quantity": item["quantity"]}},
            )
            product = db.products.find_one({"_id": item["product_id"]}, {"stock_quantity": 1})
            product_service.log_stock_movement(
                db, item["product_id"], "order_cancelled", item["quantity"], product["stock_quantity"],
                reference_type="order", reference_id=str(oid),
            )
        # If payment was never verified, release the outstanding reservation too.
        if doc["payment_status"] != "paid":
            _release_reserved_stock(db, doc.get("items", []))

        # Refund any gift card redemption that was already committed.
        if doc.get("gift_card_code") and doc.get("gift_card_committed"):
            gift_card_service.refund_redemption(db, doc["gift_card_code"], doc.get("gift_card_amount", 0.0))
            update["$set"]["gift_card_committed"] = False

    db.orders.update_one({"_id": oid}, update)
    updated    = db.orders.find_one({"_id": oid})
    order_dict = _order_to_dict(updated)

    # Send status-change emails (non-blocking)
    customer_email = _get_customer_email(db, doc["user_id"])
    if new_status == "processing":
        email_service.order_processing(order_dict, customer_email)
    elif new_status == "shipped":
        email_service.order_shipped(order_dict, customer_email, note)
    elif new_status == "delivered":
        email_service.order_delivered(order_dict, customer_email)
    elif new_status == "cancelled":
        email_service.order_cancelled(order_dict, customer_email, note)

    # Push + in-app notification
    _PUSH_MESSAGES = {
        "confirmed":  ("Order Confirmed ✓", f"Order {doc['order_number']} is confirmed and being prepared."),
        "processing": ("Packing Your Order 📦", f"Order {doc['order_number']} is now being packed."),
        "shipped":    ("Order Shipped 🚚", f"Order {doc['order_number']} is on its way! {note or ''}".strip()),
        "delivered":  ("Order Delivered 🎉", f"Order {doc['order_number']} has been delivered. Enjoy your seafood!"),
        "cancelled":  ("Order Cancelled", f"Order {doc['order_number']} has been cancelled. {note or ''}".strip()),
    }
    if new_status in _PUSH_MESSAGES:
        push_title, push_body = _PUSH_MESSAGES[new_status]
        order_url = f"/orders/{order_id}"

        # Save in-app notification
        db.notifications.insert_one({
            "user_id":    doc["user_id"],
            "type":       "order_update",
            "title":      push_title,
            "message":    push_body,
            "is_read":    False,
            "data":       {"order_id": order_id, "order_number": doc.get("order_number", "")},
            "created_at": _utcnow(),
        })

        # Send browser push (best-effort, non-blocking)
        try:
            push_service.send_push_to_user(
                db, doc["user_id"], push_title, push_body, url=order_url
            )
        except Exception:  # noqa: BLE001
            pass

    return {"success": True, "data": order_dict}


# ─── Admin: delivery partner management ───────────────────────────────────────
# A "delivery" sub-document embedded on the order, independent of the order.status
# flow above — this lets a courier/tracking assignment happen without touching
# the existing status/transition/notification logic already covering
# pending → confirmed → processing → shipped → delivered → cancelled.

DELIVERY_STATUSES = [
    "packed", "ready_for_pickup", "picked_up", "in_transit",
    "near_delivery", "delivered", "failed", "cancelled",
]

_DELIVERY_PUSH_MESSAGES = {
    "packed":           ("Order Packed 📦",      "has been packed and is ready for dispatch."),
    "ready_for_pickup": ("Ready for Pickup",     "is ready for pickup by the delivery partner."),
    "picked_up":        ("Order Picked Up 🚴",   "has been picked up and is on its way."),
    "in_transit":       ("Out for Delivery 🚚",  "is out for delivery."),
    "near_delivery":    ("Arriving Soon",        "will be delivered shortly!"),
    "delivered":        ("Order Delivered 🎉",   "has been delivered. Enjoy your seafood!"),
    "failed":           ("Delivery Attempt Failed", "delivery attempt failed — we'll retry soon."),
    "cancelled":        ("Delivery Cancelled",   "delivery was cancelled."),
}

_DELIVERY_FIELD_MAP = {
    "provider":           "provider",
    "trackingId":         "tracking_id",
    "bookingId":          "booking_id",
    "partnerName":        "partner_name",
    "driverName":         "driver_name",
    "driverPhone":        "driver_phone",
    "vehicleNumber":      "vehicle_number",
    "vehicleType":        "vehicle_type",
    "deliveryCharge":     "delivery_charge",
    "notes":              "notes",
    "proofOfDeliveryUrl": "proof_of_delivery_url",
}


def _send_delivery_notification(db: Database, order: dict, delivery_status: str) -> None:
    """
    Push + in-app notification for a delivery-status change. Deliberately separate from
    admin_update_status's email notifications — order-level milestones (confirmed/shipped/
    delivered/cancelled) keep getting email as before; granular courier updates (packed,
    picked up, in transit, ...) are push/in-app only, matching typical delivery-app UX.
    """
    labels = _DELIVERY_PUSH_MESSAGES.get(delivery_status)
    if not labels:
        return
    title, suffix = labels
    body = f"Order {order['order_number']} {suffix}"
    order_url = f"/orders/{str(order['_id'])}"

    db.notifications.insert_one({
        "user_id":    order["user_id"],
        "type":       "delivery_update",
        "title":      title,
        "message":    body,
        "is_read":    False,
        "data":       {"order_id": str(order["_id"]), "order_number": order.get("order_number", "")},
        "created_at": _utcnow(),
    })

    try:
        push_service.send_push_to_user(db, order["user_id"], title, body, url=order_url)
    except Exception:  # noqa: BLE001
        pass


def _record_delivery_status_change(db: Database, oid: ObjectId, order: dict, new_status: str, note: Optional[str]) -> None:
    """Shared tail of a delivery-status change: tracking timeline entry + customer notification.
    Used by both the admin upsert path and the driver-scoped status update below."""
    now = _utcnow()
    db.orders.update_one(
        {"_id": oid},
        {"$push": {"tracking_timeline": {
            "status":    f"delivery_{new_status}",
            "timestamp": now,
            "note":      note or _DELIVERY_PUSH_MESSAGES.get(new_status, ("", ""))[1],
        }}},
    )
    _send_delivery_notification(db, order, new_status)


def admin_upsert_delivery(db: Database, order_id: str, data: dict) -> dict:
    """
    Creates the delivery record on first call, or applies a partial update on later calls
    (assign/edit partner, update tracking, change delivery status, cancel delivery).
    A `deliveryStatus` change appends an event to the order's existing tracking_timeline
    (prefixed `delivery_` to stay distinguishable from order-level status events) and
    fires a push + in-app notification.

    `driverId` (optional) links the delivery to a real driver account (role="driver") —
    when provided, it takes precedence over any manually-typed driverName/driverPhone so
    the account's own details stay the single source of truth once a real driver is assigned.
    """
    try:
        oid = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID.")

    order = db.orders.find_one({"_id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    existing = order.get("delivery") or {}
    now = _utcnow()
    updated = {**existing}

    for camel, snake in _DELIVERY_FIELD_MAP.items():
        if data.get(camel) is not None:
            updated[snake] = data[camel]

    if data.get("driverId"):
        try:
            driver_oid = ObjectId(data["driverId"])
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid driver ID.")
        driver = db.users.find_one({"_id": driver_oid, "role": "driver"})
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found.")
        updated["driver_id"]    = driver["_id"]
        updated["driver_name"]  = driver["name"]
        updated["driver_phone"] = driver.get("phone")

    if data.get("estimatedDeliveryAt"):
        try:
            updated["estimated_delivery_at"] = datetime.fromisoformat(
                data["estimatedDeliveryAt"].replace("Z", "+00:00")
            )
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid estimatedDeliveryAt datetime.")

    new_status = data.get("deliveryStatus")
    status_changed = bool(new_status) and new_status != existing.get("delivery_status")
    if new_status:
        if new_status not in DELIVERY_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"deliveryStatus must be one of: {', '.join(DELIVERY_STATUSES)}",
            )
        updated["delivery_status"] = new_status
        if new_status == "delivered":
            updated["delivered_at"] = now
    else:
        updated.setdefault("delivery_status", "packed")

    updated.setdefault("created_at", now)
    updated["updated_at"] = now

    db.orders.update_one({"_id": oid}, {"$set": {"delivery": updated, "updated_at": now}})

    if status_changed:
        _record_delivery_status_change(db, oid, order, new_status, data.get("statusNote"))

    refreshed = db.orders.find_one({"_id": oid})
    return {"success": True, "data": _order_to_dict(refreshed)}


# ─── Driver dashboard ─────────────────────────────────────────────────────────

def driver_list_orders(db: Database, driver_id: ObjectId, status_filter: Optional[str] = None, page: int = 1, limit: int = 20) -> dict:
    """Orders assigned to this driver account, scoped strictly by delivery.driver_id."""
    query: dict = {"delivery.driver_id": driver_id}
    if status_filter:
        query["delivery.delivery_status"] = status_filter

    total = db.orders.count_documents(query)
    docs = list(
        db.orders.find(query).sort([("updated_at", -1)]).skip((page - 1) * limit).limit(limit)
    )
    return {
        "success":    True,
        "data":       [_order_to_dict(d) for d in docs],
        "total":      total,
        "page":       page,
        "totalPages": -(-total // limit),
    }


def driver_update_delivery_status(
    db: Database, driver_id: ObjectId, order_id: str,
    new_status: str, note: Optional[str] = None, proof_of_delivery_url: Optional[str] = None,
) -> dict:
    """A driver may only update the delivery status/proof-of-delivery on orders assigned
    to them — everything else about the delivery record (provider, tracking ID, reassigning
    to a different driver, ...) stays admin-only via admin_upsert_delivery."""
    try:
        oid = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID.")

    order = db.orders.find_one({"_id": oid})
    if not order or not order.get("delivery") or order["delivery"].get("driver_id") != driver_id:
        raise HTTPException(status_code=404, detail="Order not found.")

    if new_status not in DELIVERY_STATUSES:
        raise HTTPException(status_code=400, detail=f"deliveryStatus must be one of: {', '.join(DELIVERY_STATUSES)}")

    now = _utcnow()
    existing = order["delivery"]
    status_changed = new_status != existing.get("delivery_status")

    update: dict = {"delivery.delivery_status": new_status, "delivery.updated_at": now, "updated_at": now}
    if new_status == "delivered":
        update["delivery.delivered_at"] = now
    if proof_of_delivery_url:
        update["delivery.proof_of_delivery_url"] = proof_of_delivery_url

    db.orders.update_one({"_id": oid}, {"$set": update})

    if status_changed:
        _record_delivery_status_change(db, oid, order, new_status, note)

    refreshed = db.orders.find_one({"_id": oid})
    return {"success": True, "data": _order_to_dict(refreshed)}


# ─── Invoices ───────────────────────────────────────────────────────────────────

def get_invoice_pdf(db: Database, order_id: str, user_id: Optional[ObjectId] = None) -> tuple[bytes, str]:
    """
    Renders the invoice PDF for an order. Pass `user_id` to enforce customer
    ownership (404s if it's not their order); pass None for the admin path,
    which can fetch any order.
    """
    try:
        oid = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID.")

    query: dict = {"_id": oid}
    if user_id is not None:
        query["user_id"] = user_id
    doc = db.orders.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found.")

    order_dict = _order_to_dict(doc)
    settings_dict = settings_service.get_public(db)["data"]
    pdf_bytes = invoice_service.generate_invoice_pdf(order_dict, settings_dict)
    return pdf_bytes, doc["order_number"]


def email_invoice(db: Database, order_id: str, user_id: Optional[ObjectId] = None) -> dict:
    """Emails the invoice PDF to the order's customer (fire-and-forget, like other transactional email)."""
    pdf_bytes, order_number = get_invoice_pdf(db, order_id, user_id)
    try:
        oid = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID.")
    doc = db.orders.find_one({"_id": oid})
    customer_email = _get_customer_email(db, doc["user_id"])
    if not customer_email:
        raise HTTPException(status_code=400, detail="No email address on file for this order's customer.")
    email_service.send_invoice_email(customer_email, order_number, pdf_bytes)
    return {"success": True, "message": f"Invoice emailed to {customer_email}"}


# ─── Guest checkout ─────────────────────────────────────────────────────────────

def get_or_create_guest_user(db: Database, name: str, email: str, phone: str) -> dict:
    """
    Looks up a user by email, creating a lightweight guest record if none exists.
    If the email already belongs to a real registered account, the order is simply
    attached to that account's user_id (standard e-commerce behaviour) — guest
    checkout never issues a token or grants access to that account either way.
    """
    email = email.lower().strip()
    existing = db.users.find_one({"email": email})
    if existing:
        return existing

    now = _utcnow()
    doc = {
        "name":                name.strip(),
        "email":               email,
        "phone":               phone,
        "password_hash":       None,
        "role":                "customer",
        "is_guest":            True,
        "avatar":              None,
        "is_active":           True,
        "is_email_verified":   False,
        "refresh_token":       None,
        "reset_token":         None,
        "reset_token_expires": None,
        "created_at":          now,
        "updated_at":          now,
    }
    result = db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def track_guest_order(db: Database, order_number: str, email: str) -> dict:
    """Looks up an order by order number, gated by the customer's email matching —
    guests have no login, so this pair is the only thing that proves ownership."""
    doc = db.orders.find_one({"order_number": order_number.strip()})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found.")

    owner_email = _get_customer_email(db, doc["user_id"])
    if not owner_email or owner_email.lower() != email.lower().strip():
        raise HTTPException(status_code=404, detail="Order not found.")

    return {"success": True, "data": _order_to_dict(doc)}
