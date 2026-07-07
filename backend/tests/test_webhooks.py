"""
Razorpay webhook tests — signature verification + event handling.

The webhook is the authoritative, server-to-server confirmation path,
independent of whatever the customer's browser did (or didn't) report back.
"""

import hashlib
import hmac
import json
from unittest.mock import patch

from bson import ObjectId

from tests.conftest import insert_user, insert_category, insert_product, insert_order

_WEBHOOK_SECRET = "test_webhook_secret"
_RZP_ORDER_ID = "order_test_abc123"   # matches insert_order()'s hardcoded razorpay_order_id
_RZP_PAYMENT_ID = "pay_webhook_xyz"


def _sign(body: bytes, secret: str = _WEBHOOK_SECRET) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _post_webhook(client, event: dict, secret: str = _WEBHOOK_SECRET):
    body = json.dumps(event).encode()
    signature = _sign(body, secret)
    with patch("app.services.order_service.settings.RAZORPAY_WEBHOOK_SECRET", secret):
        return client.post(
            "/webhooks/razorpay",
            content=body,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature},
        )


def _setup_pending_order(db, total=999.0):
    uid = insert_user(db)
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id, name="Webhook Salmon", price=total)
    order_id = insert_order(db, uid, pid, status="pending", payment_status="pending", total=total)
    return order_id, pid


def test_webhook_rejects_invalid_signature(client, db):
    event = {"event": "payment.captured", "payload": {}}
    body = json.dumps(event).encode()
    with patch("app.services.order_service.settings.RAZORPAY_WEBHOOK_SECRET", _WEBHOOK_SECRET):
        r = client.post(
            "/webhooks/razorpay",
            content=body,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": "wrong_signature"},
        )
    assert r.status_code == 400


def test_webhook_rejects_when_secret_not_configured(client, db):
    event = {"event": "payment.captured", "payload": {}}
    body = json.dumps(event).encode()
    signature = _sign(body)
    with patch("app.services.order_service.settings.RAZORPAY_WEBHOOK_SECRET", ""):
        r = client.post(
            "/webhooks/razorpay",
            content=body,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature},
        )
    assert r.status_code == 400


def test_webhook_payment_captured_marks_order_paid(client, db):
    order_id, _ = _setup_pending_order(db, total=999.0)

    event = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": _RZP_PAYMENT_ID,
                    "order_id": _RZP_ORDER_ID,
                    "amount": 99900,
                    "status": "captured",
                }
            }
        },
    }
    with patch("app.services.email_service.send_async"):
        r = _post_webhook(client, event)
    assert r.status_code == 200

    order = db.orders.find_one({"_id": order_id})
    assert order["payment_status"] == "paid"
    assert order["status"] == "confirmed"
    assert order["razorpay_payment_id"] == _RZP_PAYMENT_ID


def test_webhook_payment_captured_ignores_amount_mismatch(client, db):
    order_id, _ = _setup_pending_order(db, total=999.0)

    event = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": _RZP_PAYMENT_ID,
                    "order_id": _RZP_ORDER_ID,
                    "amount": 100,   # doesn't match order total (99900)
                    "status": "captured",
                }
            }
        },
    }
    r = _post_webhook(client, event)
    assert r.status_code == 200   # webhook always 200s so Razorpay doesn't retry-storm

    order = db.orders.find_one({"_id": order_id})
    assert order["payment_status"] == "pending"   # not marked paid — amount didn't match


def test_webhook_payment_captured_is_idempotent(client, db):
    order_id, _ = _setup_pending_order(db, total=999.0)
    event = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {
            "id": _RZP_PAYMENT_ID, "order_id": _RZP_ORDER_ID, "amount": 99900, "status": "captured",
        }}},
    }
    with patch("app.services.email_service.send_async") as mock_send:
        _post_webhook(client, event)
        first_call_count = mock_send.call_count   # order_confirmation + admin_new_order_notification
        assert first_call_count > 0
        _post_webhook(client, event)   # duplicate delivery — Razorpay retries are expected
        assert mock_send.call_count == first_call_count   # only finalized (and emailed) once


def test_webhook_payment_failed_releases_stock(client, db):
    order_id, pid = _setup_pending_order(db, total=999.0)
    before = db.products.find_one({"_id": ObjectId(pid)})
    db.products.update_one({"_id": ObjectId(pid)}, {"$set": {"reserved_stock": 1, "stock_quantity": before["stock_quantity"] - 1}})

    event = {
        "event": "payment.failed",
        "payload": {"payment": {"entity": {
            "order_id": _RZP_ORDER_ID, "error_description": "Insufficient funds",
        }}},
    }
    r = _post_webhook(client, event)
    assert r.status_code == 200

    order = db.orders.find_one({"_id": order_id})
    assert order["payment_status"] == "failed"

    product = db.products.find_one({"_id": ObjectId(pid)})
    assert product["reserved_stock"] == 0
    assert product["stock_quantity"] == before["stock_quantity"]   # restored


def test_webhook_payment_failed_does_not_touch_already_paid_order(client, db):
    order_id, _ = _setup_pending_order(db, total=999.0)
    db.orders.update_one({"_id": order_id}, {"$set": {"payment_status": "paid", "status": "confirmed"}})

    event = {
        "event": "payment.failed",
        "payload": {"payment": {"entity": {"order_id": _RZP_ORDER_ID, "error_description": "late failure event"}}},
    }
    r = _post_webhook(client, event)
    assert r.status_code == 200

    order = db.orders.find_one({"_id": order_id})
    assert order["payment_status"] == "paid"   # untouched


def test_webhook_refund_processed_marks_order_refunded(client, db):
    order_id, _ = _setup_pending_order(db, total=999.0)
    db.orders.update_one({"_id": order_id}, {"$set": {"payment_status": "paid", "status": "confirmed"}})

    event = {
        "event": "refund.processed",
        "payload": {
            "payment": {"entity": {"order_id": _RZP_ORDER_ID, "amount": 99900}},
            "refund":  {"entity": {"id": "rfnd_test123", "amount": 99900}},
        },
    }
    r = _post_webhook(client, event)
    assert r.status_code == 200

    order = db.orders.find_one({"_id": order_id})
    assert order["payment_status"] == "refunded"
    assert order["refunds"][0]["refund_id"] == "rfnd_test123"
    assert order["refunds"][0]["full"] is True


def test_webhook_unknown_order_is_a_safe_noop(client, db):
    event = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {
            "id": "pay_x", "order_id": "order_does_not_exist_anywhere", "amount": 100, "status": "captured",
        }}},
    }
    r = _post_webhook(client, event)
    assert r.status_code == 200   # doesn't error out just because the order isn't ours
