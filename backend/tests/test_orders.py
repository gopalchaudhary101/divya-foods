"""
Order endpoint tests.

Covers: initiate, verify payment, list, detail, customer cancel.
Razorpay API calls are patched so no real network requests are made.
"""

import hmac
import hashlib
from unittest.mock import MagicMock, patch

from app.config import settings
from tests.conftest import (
    insert_user, insert_category, insert_product, insert_order,
    get_token, bearer,
)

_ADDRESS = {
    "full_name":     "Test User",
    "phone":         "9999999999",
    "address_line1": "123 Test Street",
    "city":          "Delhi",
    "state":         "Delhi",
    "pincode":       "110001",
}

_FAKE_RZP_ORDER_ID   = "order_fake_abc123"
_FAKE_RZP_PAYMENT_ID = "pay_fake_xyz789"


def _mock_rzp():
    """Return a patch context that fakes razorpay.Client in order_service."""
    mock_client = MagicMock()
    mock_client.order.create.return_value = {"id": _FAKE_RZP_ORDER_ID}
    # Patch the class where it's imported in order_service
    return patch("app.services.order_service.razorpay.Client", return_value=mock_client)


def _real_signature(rzp_order_id: str, payment_id: str) -> str:
    """Compute HMAC-SHA256 using the real key from settings (same key backend uses)."""
    return hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{rzp_order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()


def _setup_user_and_product(db):
    insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Salmon Fillet", price=1200.0)
    return str(pid)


# ─── Initiate order ───────────────────────────────────────────────────────────

def test_initiate_order_empty_cart(client, db):
    insert_user(db)
    token = get_token(client, "user@test.com")
    with _mock_rzp():
        r = client.post("/orders",
            json={"delivery_address": _ADDRESS, "items": []},
            headers=bearer(token),
        )
    assert r.status_code == 400
    assert "empty" in r.json()["detail"].lower()


def test_initiate_order_success(client, db):
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        r = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=bearer(token))

    assert r.status_code == 200
    data = r.json()["data"]
    assert "orderId"        in data
    assert "razorpayOrderId" in data
    assert data["amount"]  == 1200.0


def test_initiate_order_unauthenticated(client):
    r = client.post("/orders", json={"delivery_address": _ADDRESS})
    assert r.status_code == 401


# ─── Verify payment ───────────────────────────────────────────────────────────

def test_verify_payment_valid_signature(client, db):
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        init = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=bearer(token))

    assert init.status_code == 200, f"Order initiation failed: {init.text}"
    order_id = init.json()["data"]["orderId"]

    # Use the SAME secret the backend will use for HMAC verification
    signature = _real_signature(_FAKE_RZP_ORDER_ID, _FAKE_RZP_PAYMENT_ID)

    with patch("app.services.email_service.send_async"):   # suppress email thread
        r = client.post("/orders/verify", json={
            "order_id":            order_id,
            "razorpay_order_id":   _FAKE_RZP_ORDER_ID,
            "razorpay_payment_id": _FAKE_RZP_PAYMENT_ID,
            "razorpay_signature":  signature,
        }, headers=bearer(token))

    assert r.status_code == 200, f"Verify failed: {r.text}"
    data = r.json()["data"]
    assert data["status"]        == "confirmed"
    assert data["paymentStatus"] == "paid"


def test_verify_payment_invalid_signature(client, db):
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        init = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=bearer(token))

    order_id = init.json()["data"]["orderId"]

    r = client.post("/orders/verify", json={
        "order_id":            order_id,
        "razorpay_order_id":   _FAKE_RZP_ORDER_ID,
        "razorpay_payment_id": _FAKE_RZP_PAYMENT_ID,
        "razorpay_signature":  "totally_wrong_signature",
    }, headers=bearer(token))

    assert r.status_code == 400
    assert "signature" in r.json()["detail"].lower()


# ─── List / detail ────────────────────────────────────────────────────────────

def test_list_my_orders(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid)
    insert_order(db, uid, pid)

    token = get_token(client, "user@test.com")
    r = client.get("/orders", headers=bearer(token))
    assert r.status_code == 200
    assert r.json()["total"] == 2


def test_get_order_detail(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid)

    token = get_token(client, "user@test.com")
    r = client.get(f"/orders/{oid}", headers=bearer(token))
    assert r.status_code == 200
    data = r.json()["data"]
    # Order number starts with "DF-TEST-" (set by conftest insert_order)
    assert data["orderNumber"].startswith("DF-TEST-")
    assert len(data["items"]) == 1


def test_cannot_see_other_users_order(client, db):
    uid1   = insert_user(db, email="user1@test.com")
    insert_user(db, email="user2@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid1, pid)

    token2 = get_token(client, "user2@test.com")
    r = client.get(f"/orders/{oid}", headers=bearer(token2))
    assert r.status_code == 404


# ─── Cancel ───────────────────────────────────────────────────────────────────

def test_cancel_pending_order(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="pending")

    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        r = client.put(f"/orders/{oid}/cancel",
            json={"reason": "Changed my mind"},
            headers=bearer(token),
        )
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "cancelled"


def test_cancel_shipped_order_fails(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="shipped")

    token = get_token(client, "user@test.com")
    r = client.put(f"/orders/{oid}/cancel",
        json={"reason": "Too late"},
        headers=bearer(token),
    )
    assert r.status_code == 400
    assert "cancel" in r.json()["detail"].lower()


def test_cancel_restores_stock(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Limited Stock", price=500.0)

    before = db.products.find_one({"_id": pid})["stock_quantity"]

    oid = insert_order(db, uid, pid, status="pending")
    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        client.put(f"/orders/{oid}/cancel", json={"reason": "Test"}, headers=bearer(token))

    after = db.products.find_one({"_id": pid})["stock_quantity"]
    assert after == before + 1   # 1 unit restored
