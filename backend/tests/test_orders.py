"""
Order endpoint tests.

Covers: initiate, verify payment, list, detail, customer cancel.
Razorpay API calls are patched so no real network requests are made.
"""

import hmac
import hashlib
from unittest.mock import MagicMock, patch

from bson import ObjectId

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


def _mock_rzp(captured_amount=None):
    """
    Return a patch context that fakes razorpay.Client in order_service.
    Pass captured_amount (in paise) when the call under test will reach
    verify_payment's server-side Razorpay payment.fetch confirmation.
    """
    mock_client = MagicMock()
    mock_client.order.create.return_value = {"id": _FAKE_RZP_ORDER_ID}
    if captured_amount is not None:
        mock_client.payment.fetch.return_value = {"status": "captured", "amount": captured_amount}
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


def test_initiate_order_with_unexpired_coupon(client, db):
    """
    Regression test: coupons with an expires_at date used to crash checkout with
    a 500 (naive vs. aware datetime comparison in order_service._apply_coupon).
    """
    from datetime import datetime, timedelta, timezone
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    db.coupons.insert_one({
        "code":            "SAVE10",
        "discount_type":   "percentage",
        "discount_value":  10,
        "min_order_value": 0,
        "max_discount":    None,
        "is_active":       True,
        "expires_at":      datetime.now(timezone.utc) + timedelta(days=30),
        "usage_limit":     None,
        "used_count":      0,
        "created_at":      datetime.now(timezone.utc),
        "updated_at":      datetime.now(timezone.utc),
    })

    with _mock_rzp():
        r = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items":       [{"productId": pid, "quantity": 1}],
            "coupon_code": "SAVE10",
        }, headers=bearer(token))

    assert r.status_code == 200
    assert r.json()["data"]["amount"] == 1080.0


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

    with patch("app.services.email_service.send_async"), _mock_rzp(captured_amount=120000):
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


def test_verify_payment_rejects_signature_from_a_different_order(client, db):
    """
    Critical: a genuinely valid Razorpay signature for one order must not be
    replayable against a different order_id to mark it paid for free.
    """
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        init_a = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=bearer(token))
    order_a_id = init_a.json()["data"]["orderId"]

    # A signature that is genuinely valid — just not for order A.
    other_rzp_order_id = "order_belongs_to_someone_else"
    signature = _real_signature(other_rzp_order_id, _FAKE_RZP_PAYMENT_ID)

    r = client.post("/orders/verify", json={
        "order_id":            order_a_id,
        "razorpay_order_id":   other_rzp_order_id,
        "razorpay_payment_id": _FAKE_RZP_PAYMENT_ID,
        "razorpay_signature":  signature,
    }, headers=bearer(token))

    assert r.status_code == 400
    assert "match" in r.json()["detail"].lower()

    order = db.orders.find_one({"_id": ObjectId(order_a_id)})
    assert order["payment_status"] == "pending"   # untouched


def test_verify_payment_rejects_uncaptured_payment(client, db):
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        init = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=bearer(token))
    order_id = init.json()["data"]["orderId"]

    signature = _real_signature(_FAKE_RZP_ORDER_ID, _FAKE_RZP_PAYMENT_ID)
    uncaptured_client = MagicMock()
    uncaptured_client.payment.fetch.return_value = {"status": "authorized", "amount": 120000}
    with patch("app.services.order_service.razorpay.Client", return_value=uncaptured_client):
        r = client.post("/orders/verify", json={
            "order_id":            order_id,
            "razorpay_order_id":   _FAKE_RZP_ORDER_ID,
            "razorpay_payment_id": _FAKE_RZP_PAYMENT_ID,
            "razorpay_signature":  signature,
        }, headers=bearer(token))

    assert r.status_code == 400
    assert "captured" in r.json()["detail"].lower()


def test_verify_payment_rejects_amount_mismatch(client, db):
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        init = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=bearer(token))
    order_id = init.json()["data"]["orderId"]

    signature = _real_signature(_FAKE_RZP_ORDER_ID, _FAKE_RZP_PAYMENT_ID)
    with _mock_rzp(captured_amount=100):   # order total is 120000 paise, not 100
        r = client.post("/orders/verify", json={
            "order_id":            order_id,
            "razorpay_order_id":   _FAKE_RZP_ORDER_ID,
            "razorpay_payment_id": _FAKE_RZP_PAYMENT_ID,
            "razorpay_signature":  signature,
        }, headers=bearer(token))

    assert r.status_code == 400
    assert "amount" in r.json()["detail"].lower()


def test_verify_payment_is_idempotent(client, db):
    """Calling verify twice for an already-paid order just returns success,
    without re-fetching from Razorpay or re-sending emails."""
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        init = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=bearer(token))
    order_id = init.json()["data"]["orderId"]
    signature = _real_signature(_FAKE_RZP_ORDER_ID, _FAKE_RZP_PAYMENT_ID)

    with patch("app.services.email_service.send_async") as mock_send, _mock_rzp(captured_amount=120000):
        r1 = client.post("/orders/verify", json={
            "order_id": order_id, "razorpay_order_id": _FAKE_RZP_ORDER_ID,
            "razorpay_payment_id": _FAKE_RZP_PAYMENT_ID, "razorpay_signature": signature,
        }, headers=bearer(token))
        assert r1.status_code == 200
        first_call_count = mock_send.call_count

        # Second call — no _mock_rzp needed at all, since an already-paid order
        # short-circuits before ever reaching payment.fetch.
        r2 = client.post("/orders/verify", json={
            "order_id": order_id, "razorpay_order_id": _FAKE_RZP_ORDER_ID,
            "razorpay_payment_id": _FAKE_RZP_PAYMENT_ID, "razorpay_signature": signature,
        }, headers=bearer(token))
        assert r2.status_code == 200
        assert mock_send.call_count == first_call_count   # no duplicate email


def test_verify_payment_releases_reservation_without_changing_stock_quantity(client, db):
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        init = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 2}],
        }, headers=bearer(token))
    order_id = init.json()["data"]["orderId"]

    after_initiate = db.products.find_one({"_id": ObjectId(pid)})
    assert after_initiate["stock_quantity"] == 48   # 50 - 2
    assert after_initiate["reserved_stock"] == 2

    signature = _real_signature(_FAKE_RZP_ORDER_ID, _FAKE_RZP_PAYMENT_ID)
    with patch("app.services.email_service.send_async"), _mock_rzp(captured_amount=240000):
        client.post("/orders/verify", json={
            "order_id":            order_id,
            "razorpay_order_id":   _FAKE_RZP_ORDER_ID,
            "razorpay_payment_id": _FAKE_RZP_PAYMENT_ID,
            "razorpay_signature":  signature,
        }, headers=bearer(token))

    after_verify = db.products.find_one({"_id": ObjectId(pid)})
    assert after_verify["stock_quantity"] == 48   # unchanged — already decremented at checkout
    assert after_verify["reserved_stock"] == 0    # reservation released now that it's paid


def test_cancelling_unpaid_order_restores_stock_and_releases_reservation(client, db):
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        init = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 2}],
        }, headers=bearer(token))
    order_id = init.json()["data"]["orderId"]

    with patch("app.services.email_service.send_async"):
        client.put(f"/orders/{order_id}/cancel", json={"reason": "Changed my mind"}, headers=bearer(token))

    product = db.products.find_one({"_id": ObjectId(pid)})
    assert product["stock_quantity"] == 50   # fully restored
    assert product["reserved_stock"] == 0    # reservation released, not double-released


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


def test_order_detail_delivery_is_null_before_assignment(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid)

    token = get_token(client, "user@test.com")
    r = client.get(f"/orders/{oid}", headers=bearer(token))
    assert r.json()["data"]["delivery"] is None


def test_customer_sees_own_order_delivery_info_once_assigned(client, db):
    uid    = insert_user(db)
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="shipped")

    admin_token = get_token(client, "admin@test.com")
    client.put(f"/admin/orders/{oid}/delivery", json={
        "provider": "Porter", "trackingId": "PTR-9001", "deliveryStatus": "in_transit",
    }, headers=bearer(admin_token))

    token = get_token(client, "user@test.com")
    r = client.get(f"/orders/{oid}", headers=bearer(token))
    delivery = r.json()["data"]["delivery"]
    assert delivery["provider"] == "Porter"
    assert delivery["trackingId"] == "PTR-9001"
    assert delivery["deliveryStatus"] == "in_transit"


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


def test_cancelling_the_same_order_twice_only_restores_stock_once(client, db):
    """Regression test for a race condition: two near-simultaneous cancel
    requests for the same order (double-click, client retry, two tabs) must
    not both run the stock-restore side effect — only the first should."""
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Limited Stock", price=500.0)
    before = db.products.find_one({"_id": pid})["stock_quantity"]

    oid = insert_order(db, uid, pid, status="pending")
    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        r1 = client.put(f"/orders/{oid}/cancel", json={"reason": "Test"}, headers=bearer(token))
        r2 = client.put(f"/orders/{oid}/cancel", json={"reason": "Test again"}, headers=bearer(token))

    assert r1.status_code == 200
    assert r2.status_code == 400

    after = db.products.find_one({"_id": pid})["stock_quantity"]
    assert after == before + 1   # restored exactly once, not twice


# ─── Invoices ───────────────────────────────────────────────────────────────────

def test_download_own_invoice(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid)

    token = get_token(client, "user@test.com")
    r = client.get(f"/orders/{oid}/invoice", headers=bearer(token))
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:4] == b"%PDF"


def test_cannot_download_other_users_invoice(client, db):
    uid1 = insert_user(db, email="user1@test.com")
    insert_user(db, email="user2@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid1, pid)

    token2 = get_token(client, "user2@test.com")
    r = client.get(f"/orders/{oid}/invoice", headers=bearer(token2))
    assert r.status_code == 404


def test_invoice_requires_auth(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid)
    r = client.get(f"/orders/{oid}/invoice")
    assert r.status_code == 401


def test_email_own_invoice(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid)

    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_invoice_email") as mock_send:
        r = client.post(f"/orders/{oid}/invoice/email", headers=bearer(token))
    assert r.status_code == 200
    mock_send.assert_called_once()
    assert mock_send.call_args.args[0] == "user@test.com"


# ─── Delivery slots ───────────────────────────────────────────────────────────

def test_initiate_order_with_express_delivery_slot(client, db):
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        r = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
            "delivery_slot": {"type": "express"},
        }, headers=bearer(token))
    assert r.status_code == 200

    order_id = r.json()["data"]["orderId"]
    doc = db.orders.find_one({"_id": ObjectId(order_id)})
    assert doc["delivery_slot"] == {"type": "express"}


def test_initiate_order_with_scheduled_delivery_slot(client, db):
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        r = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
            "delivery_slot": {"type": "scheduled", "date": "2026-08-01", "timeWindow": "10am-1pm"},
        }, headers=bearer(token))
    assert r.status_code == 200

    order_id = r.json()["data"]["orderId"]
    r2 = client.get(f"/orders/{order_id}", headers=bearer(token))
    slot = r2.json()["data"]["deliverySlot"]
    assert slot == {"type": "scheduled", "date": "2026-08-01", "timeWindow": "10am-1pm"}


def test_scheduled_delivery_slot_requires_date_and_window(client, db):
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        r = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
            "delivery_slot": {"type": "scheduled"},
        }, headers=bearer(token))
    assert r.status_code == 400


def test_invalid_delivery_slot_type_rejected(client, db):
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        r = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
            "delivery_slot": {"type": "teleport"},
        }, headers=bearer(token))
    assert r.status_code == 400


def test_order_without_delivery_slot_is_null(client, db):
    pid   = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        r = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
        }, headers=bearer(token))
    order_id = r.json()["data"]["orderId"]

    r2 = client.get(f"/orders/{order_id}", headers=bearer(token))
    assert r2.json()["data"]["deliverySlot"] is None


# ─── Guest checkout ───────────────────────────────────────────────────────────

_GUEST_PAYLOAD_BASE = {
    "name":  "Guest Shopper",
    "email": "guest@test.com",
    "phone": "9876543210",
    "delivery_address": _ADDRESS,
}


def test_guest_checkout_creates_guest_user_and_order(client, db):
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Guest Prawns", price=800.0)

    with _mock_rzp():
        r = client.post("/orders/guest", json={
            **_GUEST_PAYLOAD_BASE,
            "items": [{"productId": str(pid), "quantity": 1}],
        })
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["amount"] == 900.0   # 800 + 100 delivery charge (below free-delivery threshold)

    guest_user = db.users.find_one({"email": "guest@test.com"})
    assert guest_user is not None
    assert guest_user["role"] == "customer"
    assert guest_user["is_guest"] is True

    order = db.orders.find_one({"_id": ObjectId(data["orderId"])})
    assert order["user_id"] == guest_user["_id"]


def test_guest_checkout_reuses_existing_account_by_email(client, db):
    uid    = insert_user(db, email="guest@test.com", name="Real Account")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Guest Prawns", price=800.0)

    with _mock_rzp():
        r = client.post("/orders/guest", json={
            **_GUEST_PAYLOAD_BASE,
            "items": [{"productId": str(pid), "quantity": 1}],
        })
    assert r.status_code == 200, r.text

    order_id = r.json()["data"]["orderId"]
    order = db.orders.find_one({"_id": ObjectId(order_id)})
    assert order["user_id"] == uid   # attached to the existing account, no duplicate created
    assert db.users.count_documents({"email": "guest@test.com"}) == 1


def test_guest_checkout_and_verify_payment(client, db):
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Guest Crab", price=600.0)

    with _mock_rzp():
        init = client.post("/orders/guest", json={
            **_GUEST_PAYLOAD_BASE,
            "items": [{"productId": str(pid), "quantity": 1}],
        })
    order_id = init.json()["data"]["orderId"]

    signature = _real_signature(_FAKE_RZP_ORDER_ID, _FAKE_RZP_PAYMENT_ID)
    with patch("app.services.email_service.send_async"), _mock_rzp(captured_amount=70000):
        r = client.post("/orders/guest/verify", json={
            "order_id":            order_id,
            "email":               "guest@test.com",
            "razorpay_order_id":   _FAKE_RZP_ORDER_ID,
            "razorpay_payment_id": _FAKE_RZP_PAYMENT_ID,
            "razorpay_signature":  signature,
        })
    assert r.status_code == 200, r.text
    assert r.json()["data"]["paymentStatus"] == "paid"


def test_guest_verify_unknown_email_returns_404(client, db):
    r = client.post("/orders/guest/verify", json={
        "order_id":            str(ObjectId()),
        "email":               "nobody@test.com",
        "razorpay_order_id":   _FAKE_RZP_ORDER_ID,
        "razorpay_payment_id": _FAKE_RZP_PAYMENT_ID,
        "razorpay_signature":  "whatever",
    })
    assert r.status_code == 404


def test_track_guest_order_success(client, db):
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Guest Squid", price=400.0)

    with _mock_rzp():
        init = client.post("/orders/guest", json={
            **_GUEST_PAYLOAD_BASE,
            "items": [{"productId": str(pid), "quantity": 1}],
        })
    order_number = init.json()["data"]["orderNumber"]

    r = client.get("/orders/guest/track", params={
        "order_number": order_number, "email": "guest@test.com",
    })
    assert r.status_code == 200
    assert r.json()["data"]["orderNumber"] == order_number


def test_track_guest_order_wrong_email_returns_404(client, db):
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Guest Squid", price=400.0)

    with _mock_rzp():
        init = client.post("/orders/guest", json={
            **_GUEST_PAYLOAD_BASE,
            "items": [{"productId": str(pid), "quantity": 1}],
        })
    order_number = init.json()["data"]["orderNumber"]

    r = client.get("/orders/guest/track", params={
        "order_number": order_number, "email": "wrong@test.com",
    })
    assert r.status_code == 404


def test_track_guest_order_unknown_order_number_returns_404(client, db):
    r = client.get("/orders/guest/track", params={
        "order_number": "DF-DOES-NOT-EXIST", "email": "guest@test.com",
    })
    assert r.status_code == 404
