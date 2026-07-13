"""
Returns/refunds service — post-delivery return requests.

Flow:
  1. Customer requests a return within 24h of delivery (matches the published
     Refund Policy at /refund-policy) on specific items from a delivered,
     paid order.
  2. Admin reviews: approve — either a real Razorpay refund
     (order_service.admin_initiate_refund, requires the order to have a
     captured Razorpay payment) or a manual refund the admin already
     completed some other way (order_service.admin_record_manual_refund,
     for COD orders or as a fallback) — or reject (with a note explaining why).

Deliberately separate from product_service.admin_record_return, which is
inventory-only bookkeeping (restocking shelf quantity) with no connection to
order status, refunds, or the customer — an admin may still use that
separately once the physical goods are received back.
"""

import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException
from pymongo.database import Database

from app.services import email_service, order_service
from app.utils import push_service
from app.utils.mongo import get_object_id

RETURN_WINDOW_HOURS = 24
RETURN_REASONS = {"wrong_item", "damaged_or_spoiled", "missing_item", "other"}
# Everything except "rejected" ties up quantity against the order — a pending
# request blocks a second request for the same units, and a refunded one
# obviously shouldn't be claimable again. Only a rejection frees the quantity
# back up for a fresh request.
_QUANTITY_CONSUMING_STATUSES = {"requested", "approved", "refunded"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _return_to_dict(doc: dict) -> dict:
    return {
        "id":               str(doc["_id"]),
        "orderId":          str(doc["order_id"]),
        "orderNumber":      doc["order_number"],
        "userId":           str(doc["user_id"]),
        "reason":           doc["reason"],
        "note":             doc.get("note"),
        "items": [
            {"productId": str(i["product_id"]), "name": i["name"], "price": i["price"], "quantity": i["quantity"]}
            for i in doc.get("items", [])
        ],
        "refundAmount":     doc["refund_amount"],
        "status":           doc["status"],
        "adminNote":        doc.get("admin_note"),
        "razorpayRefundId": doc.get("razorpay_refund_id"),
        "orderPaymentMethod": doc.get("order_payment_method"),
        "refundMethod":     doc.get("refund_method"),
        "refundReference":  doc.get("refund_reference"),
        "requestedAt":      doc["requested_at"].isoformat(),
        "updatedAt":        doc["updated_at"].isoformat(),
        "resolvedAt":       doc["resolved_at"].isoformat() if doc.get("resolved_at") else None,
    }


def _customer_email(db: Database, user_id: ObjectId) -> str:
    user = db.users.find_one({"_id": user_id}, {"email": 1})
    return user.get("email", "") if user else ""


# ─── Customer: request a return ───────────────────────────────────────────────

def create_return_request(
    db: Database,
    user_id: ObjectId,
    order_id: str,
    reason: str,
    note: str,
    items: list,
) -> dict:
    oid = get_object_id(order_id, "order")

    order = db.orders.find_one({"_id": oid, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if reason not in RETURN_REASONS:
        raise HTTPException(status_code=400, detail=f"reason must be one of: {', '.join(sorted(RETURN_REASONS))}")
    if order["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Returns can only be requested for delivered orders.")
    if order["payment_status"] != "paid":
        raise HTTPException(status_code=400, detail="This order has no completed payment to refund.")

    delivered_event = next(
        (e for e in reversed(order.get("tracking_timeline", [])) if e["status"] == "delivered"), None
    )
    delivered_at = delivered_event["timestamp"] if delivered_event else order["updated_at"]
    if delivered_at.tzinfo is None:
        delivered_at = delivered_at.replace(tzinfo=timezone.utc)
    if (_utcnow() - delivered_at).total_seconds() > RETURN_WINDOW_HOURS * 3600:
        raise HTTPException(
            status_code=400,
            detail=f"Returns must be requested within {RETURN_WINDOW_HOURS} hours of delivery.",
        )

    if not items:
        raise HTTPException(status_code=400, detail="Select at least one item to return.")

    # Cumulative-quantity guard: sum how much of each product this order has
    # already claimed across every non-rejected prior return request (pending,
    # or already refunded) — not just whether one is currently in progress.
    # Without this, once a return is resolved (status leaves "requested") a
    # customer could file another return for the *same already-refunded*
    # units and, if approved again, be paid twice for one item.
    already_claimed: dict = {}
    for prior in db.returns.find({"order_id": oid, "status": {"$in": list(_QUANTITY_CONSUMING_STATUSES)}}):
        for it in prior.get("items", []):
            key = str(it["product_id"])
            already_claimed[key] = already_claimed.get(key, 0) + it["quantity"]

    order_items_by_id = {str(i["product_id"]): i for i in order["items"]}
    return_items = []
    refund_amount = 0.0
    for req_item in items:
        pid = req_item.get("productId") or req_item.get("product_id")
        qty = req_item.get("quantity", 0)
        matched = order_items_by_id.get(str(pid))
        if not matched:
            raise HTTPException(status_code=400, detail=f"Product {pid} was not part of this order.")
        remaining = matched["quantity"] - already_claimed.get(str(pid), 0)
        if not isinstance(qty, int) or qty < 1 or qty > remaining:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid quantity for {matched['name']} — only {max(remaining, 0)} unit(s) of {matched['quantity']} ordered remain eligible for return.",
            )
        return_items.append({
            "product_id": matched["product_id"], "name": matched["name"],
            "price": matched["price"], "quantity": qty,
        })
        refund_amount += matched["price"] * qty

    now = _utcnow()
    result = db.returns.insert_one({
        "order_id":          oid,
        "order_number":      order["order_number"],
        "order_payment_method": order["payment_method"],
        "user_id":           user_id,
        "reason":            reason,
        "note":              note or None,
        "items":             return_items,
        "refund_amount":     round(refund_amount, 2),
        "status":            "requested",
        "admin_note":        None,
        "razorpay_refund_id": None,
        "refund_method":     None,
        "refund_reference":  None,
        "processing_started_at": None,  # atomic-claim lock — see admin_approve_return*
        "requested_at":      now,
        "updated_at":        now,
        "resolved_at":       None,
    })
    doc = db.returns.find_one({"_id": result.inserted_id})
    ret_dict = _return_to_dict(doc)

    email_service.return_request_received(ret_dict, _customer_email(db, user_id))
    email_service.admin_return_request_notification(ret_dict)

    return {"success": True, "data": ret_dict}


def get_my_return_request(db: Database, user_id: ObjectId, order_id: str) -> dict:
    oid = get_object_id(order_id, "order")
    doc = db.returns.find_one({"order_id": oid, "user_id": user_id}, sort=[("requested_at", -1)])
    if not doc:
        raise HTTPException(status_code=404, detail="No return request found for this order.")
    return {"success": True, "data": _return_to_dict(doc)}


# ─── Admin: list / detail ─────────────────────────────────────────────────────

def admin_list_returns(
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
        query["order_number"] = {"$regex": re.escape(search), "$options": "i"}

    skip = (page - 1) * limit
    total = db.returns.count_documents(query)
    docs = list(db.returns.find(query).sort([("requested_at", -1)]).skip(skip).limit(limit))
    return {
        "success":    True,
        "data":       [_return_to_dict(d) for d in docs],
        "total":      total,
        "page":       page,
        "totalPages": -(-total // limit),
    }


def admin_get_return(db: Database, return_id: str) -> dict:
    oid = get_object_id(return_id, "return")
    doc = db.returns.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Return request not found.")
    return {"success": True, "data": _return_to_dict(doc)}


# ─── Admin: approve / reject ──────────────────────────────────────────────────

def _claim_return_for_processing(db: Database, oid: ObjectId) -> dict:
    """
    Atomically transitions a return from "requested" to "being processed"
    without changing its externally-visible `status` (still "requested" until
    the final resolution write) — gated on the internal processing_started_at
    lock instead. Prevents two near-simultaneous approve/reject calls (a
    double-click, a client retry, two admin sessions) on the same return from
    both proceeding, which previously could trigger two real refunds for one
    return. Missing the field (documents created before this fix) is treated
    the same as None by Mongo's query semantics, so no migration is needed.

    Raises 404/400 and returns nothing if the claim fails; otherwise returns
    the pre-claim document to act on.
    """
    claimed = db.returns.find_one_and_update(
        {"_id": oid, "status": "requested", "processing_started_at": None},
        {"$set": {"processing_started_at": _utcnow()}},
    )
    if claimed:
        return claimed
    existing = db.returns.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Return request not found.")
    if existing["status"] != "requested":
        raise HTTPException(status_code=400, detail=f"Cannot resolve a return that is already '{existing['status']}'.")
    raise HTTPException(status_code=400, detail="This return is already being processed by another request.")


def _release_return_claim(db: Database, oid: ObjectId) -> None:
    """Releases the processing lock after a failed refund/side-effect so the
    admin can retry, instead of leaving the return stuck unresolvable."""
    db.returns.update_one({"_id": oid}, {"$set": {"processing_started_at": None}})


def admin_approve_return(db: Database, return_id: str, note: str = "") -> dict:
    oid = get_object_id(return_id, "return")
    doc = _claim_return_for_processing(db, oid)

    try:
        refund_result = order_service.admin_initiate_refund(db, str(doc["order_id"]), doc["refund_amount"], note)
    except Exception:
        _release_return_claim(db, oid)
        raise

    now = _utcnow()
    db.returns.update_one(
        {"_id": oid},
        {"$set": {
            "status":             "refunded",
            "admin_note":         note or None,
            "razorpay_refund_id": refund_result["razorpayRefundId"],
            "refund_method":      "razorpay",
            "updated_at":         now,
            "resolved_at":        now,
        }},
    )
    updated = db.returns.find_one({"_id": oid})
    # refund_processed email + in-app/push notification already sent by
    # order_service.admin_initiate_refund -> _refund_order — nothing more to send here.
    return {"success": True, "data": _return_to_dict(updated)}


def admin_approve_return_manual(db: Database, return_id: str, reference: str, note: str = "") -> dict:
    """
    For orders an automatic Razorpay refund can't reach (most commonly COD) —
    the admin has already refunded the customer some other way (bank transfer,
    UPI, cash) and this records it, same shape as admin_approve_return but via
    order_service.admin_record_manual_refund instead of the Razorpay API call.
    """
    oid = get_object_id(return_id, "return")
    doc = _claim_return_for_processing(db, oid)

    try:
        order_service.admin_record_manual_refund(db, str(doc["order_id"]), doc["refund_amount"], reference, note)
    except Exception:
        _release_return_claim(db, oid)
        raise

    now = _utcnow()
    db.returns.update_one(
        {"_id": oid},
        {"$set": {
            "status":            "refunded",
            "admin_note":        note or None,
            "refund_method":     "manual",
            "refund_reference":  reference.strip(),
            "updated_at":        now,
            "resolved_at":       now,
        }},
    )
    updated = db.returns.find_one({"_id": oid})
    return {"success": True, "data": _return_to_dict(updated)}


def admin_reject_return(db: Database, return_id: str, note: str) -> dict:
    if not note or not note.strip():
        raise HTTPException(status_code=400, detail="A note explaining the rejection is required.")

    oid = get_object_id(return_id, "return")
    doc = _claim_return_for_processing(db, oid)

    now = _utcnow()
    db.returns.update_one(
        {"_id": oid},
        {"$set": {"status": "rejected", "admin_note": note, "updated_at": now, "resolved_at": now}},
    )
    updated = db.returns.find_one({"_id": oid})

    customer_email = _customer_email(db, doc["user_id"])
    email_service.return_rejected(_return_to_dict(updated), customer_email, note)

    db.notifications.insert_one({
        "user_id":    doc["user_id"],
        "type":       "return_update",
        "title":      "Return Request Update",
        "message":    f"Your return request for order {doc['order_number']} was not approved.",
        "is_read":    False,
        "data":       {"order_id": str(doc["order_id"]), "order_number": doc["order_number"]},
        "created_at": now,
    })
    try:
        push_service.send_push_to_user(
            db, doc["user_id"], "Return Request Update",
            f"Your return request for order {doc['order_number']} was not approved.",
            url=f"/orders/{doc['order_id']}",
        )
    except Exception:  # noqa: BLE001
        pass

    return {"success": True, "data": _return_to_dict(updated)}
