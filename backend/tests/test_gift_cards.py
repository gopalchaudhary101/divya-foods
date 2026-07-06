"""
Gift card tests — admin issue/list/manage, plus checkout redemption wired
through order_service (initiate/verify/cancel commit-refund lifecycle).
"""

import hmac
import hashlib
from unittest.mock import MagicMock, patch

from bson import ObjectId

from app.config import settings
from tests.conftest import insert_user, insert_category, insert_product, get_token, bearer

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
    mock_client = MagicMock()
    mock_client.order.create.return_value = {"id": _FAKE_RZP_ORDER_ID}
    return patch("app.services.order_service.razorpay.Client", return_value=mock_client)


def _real_signature(rzp_order_id: str, payment_id: str) -> str:
    return hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{rzp_order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()


def _admin_headers(client, db):
    if not db.users.find_one({"email": "admin@test.com"}):
        insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _issue_gift_card(client, db, value=500.0, code=None):
    hdrs = _admin_headers(client, db)
    payload = {"value": value}
    if code:
        payload["code"] = code
    r = client.post("/admin/gift-cards", json=payload, headers=hdrs)
    assert r.status_code == 200, r.text
    return r.json()["data"]


# ─── Admin issue/list/manage ──────────────────────────────────────────────────

def test_admin_issue_gift_card_with_auto_code(client, db):
    card = _issue_gift_card(client, db, value=1000.0)
    assert card["code"].startswith("GIFT-")
    assert card["balance"] == 1000.0
    assert card["isActive"] is True


def test_admin_issue_gift_card_with_custom_code(client, db):
    card = _issue_gift_card(client, db, value=250.0, code="WELCOME250")
    assert card["code"] == "WELCOME250"


def test_admin_issue_rejects_duplicate_code(client, db):
    _issue_gift_card(client, db, code="DUPETEST")
    hdrs = _admin_headers(client, db)
    r = client.post("/admin/gift-cards", json={"value": 100, "code": "DUPETEST"}, headers=hdrs)
    assert r.status_code == 400


def test_admin_issue_rejects_zero_value(client, db):
    hdrs = _admin_headers(client, db)
    r = client.post("/admin/gift-cards", json={"value": 0}, headers=hdrs)
    assert r.status_code == 400


def test_admin_list_gift_cards(client, db):
    _issue_gift_card(client, db)
    _issue_gift_card(client, db)
    hdrs = _admin_headers(client, db)
    r = client.get("/admin/gift-cards", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["total"] == 2


def test_admin_deactivate_gift_card(client, db):
    card = _issue_gift_card(client, db)
    hdrs = _admin_headers(client, db)
    r = client.put(f"/admin/gift-cards/{card['id']}", json={"is_active": False}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["isActive"] is False


def test_gift_card_endpoints_block_customers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    r = client.get("/admin/gift-cards", headers=bearer(token))
    assert r.status_code == 403


# ─── Checkout redemption ──────────────────────────────────────────────────────

def _setup_user_and_product(db, price=1200.0):
    insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Gift Card Salmon", price=price)
    return str(pid)


def test_checkout_applies_partial_gift_card_discount(client, db):
    pid = _setup_user_and_product(db, price=1200.0)
    card = _issue_gift_card(client, db, value=200.0)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        r = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
            "gift_card_code": card["code"],
        }, headers=bearer(token))

    assert r.status_code == 200, r.text
    assert r.json()["data"]["amount"] == 1000.0   # 1200 - 200 gift card, balance not yet committed


def test_gift_card_balance_not_debited_until_payment_verified(client, db):
    pid = _setup_user_and_product(db, price=1200.0)
    card = _issue_gift_card(client, db, value=200.0)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
            "gift_card_code": card["code"],
        }, headers=bearer(token))

    hdrs = _admin_headers(client, db)
    listed = client.get("/admin/gift-cards", headers=hdrs).json()["data"]
    assert listed[0]["balance"] == 200.0   # untouched — payment not verified yet


def test_gift_card_balance_debited_after_payment_verified(client, db):
    pid = _setup_user_and_product(db, price=1200.0)
    card = _issue_gift_card(client, db, value=200.0)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        init = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
            "gift_card_code": card["code"],
        }, headers=bearer(token))
    order_id = init.json()["data"]["orderId"]
    signature = _real_signature(_FAKE_RZP_ORDER_ID, _FAKE_RZP_PAYMENT_ID)

    with patch("app.services.email_service.send_async"):
        r = client.post("/orders/verify", json={
            "order_id":            order_id,
            "razorpay_order_id":   _FAKE_RZP_ORDER_ID,
            "razorpay_payment_id": _FAKE_RZP_PAYMENT_ID,
            "razorpay_signature":  signature,
        }, headers=bearer(token))
    assert r.status_code == 200

    hdrs = _admin_headers(client, db)
    listed = client.get("/admin/gift-cards", headers=hdrs).json()["data"]
    assert listed[0]["balance"] == 0.0   # 200 balance fully used on a 200 discount


def test_gift_card_refunded_on_cancellation_after_payment(client, db):
    pid = _setup_user_and_product(db, price=1200.0)
    card = _issue_gift_card(client, db, value=200.0)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        init = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
            "gift_card_code": card["code"],
        }, headers=bearer(token))
    order_id = init.json()["data"]["orderId"]
    signature = _real_signature(_FAKE_RZP_ORDER_ID, _FAKE_RZP_PAYMENT_ID)

    with patch("app.services.email_service.send_async"):
        client.post("/orders/verify", json={
            "order_id":            order_id,
            "razorpay_order_id":   _FAKE_RZP_ORDER_ID,
            "razorpay_payment_id": _FAKE_RZP_PAYMENT_ID,
            "razorpay_signature":  signature,
        }, headers=bearer(token))
        client.put(f"/orders/{order_id}/cancel", json={"reason": "Changed my mind"}, headers=bearer(token))

    hdrs = _admin_headers(client, db)
    listed = client.get("/admin/gift-cards", headers=hdrs).json()["data"]
    assert listed[0]["balance"] == 200.0   # refunded in full


def test_gift_card_not_refunded_on_cancellation_before_payment(client, db):
    pid = _setup_user_and_product(db, price=1200.0)
    card = _issue_gift_card(client, db, value=200.0)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        init = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
            "gift_card_code": card["code"],
        }, headers=bearer(token))
    order_id = init.json()["data"]["orderId"]

    with patch("app.services.email_service.send_async"):
        client.put(f"/orders/{order_id}/cancel", json={"reason": "Never paid"}, headers=bearer(token))

    hdrs = _admin_headers(client, db)
    listed = client.get("/admin/gift-cards", headers=hdrs).json()["data"]
    assert listed[0]["balance"] == 200.0   # never committed, so nothing to refund — still 200


def test_gift_card_fully_covers_order_skips_razorpay(client, db):
    pid = _setup_user_and_product(db, price=500.0)
    card = _issue_gift_card(client, db, value=1000.0)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        r = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
            "gift_card_code": card["code"],
        }, headers=bearer(token))

    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["amount"] == 0.0
    assert data["razorpayOrderId"] is None

    order = db.orders.find_one({"_id": ObjectId(data["orderId"])})
    assert order["status"] == "confirmed"
    assert order["payment_status"] == "paid"

    hdrs = _admin_headers(client, db)
    listed = client.get("/admin/gift-cards", headers=hdrs).json()["data"]
    assert listed[0]["balance"] == 400.0   # 500 subtotal + 100 delivery = 600 used; 1000 - 600 = 400 remaining


def test_invalid_gift_card_code_rejected(client, db):
    pid = _setup_user_and_product(db)
    token = get_token(client, "user@test.com")

    with _mock_rzp():
        r = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
            "gift_card_code": "DOES-NOT-EXIST",
        }, headers=bearer(token))
    assert r.status_code == 400


def test_inactive_gift_card_rejected(client, db):
    pid = _setup_user_and_product(db)
    card = _issue_gift_card(client, db, value=100.0)
    hdrs = _admin_headers(client, db)
    client.put(f"/admin/gift-cards/{card['id']}", json={"is_active": False}, headers=hdrs)

    token = get_token(client, "user@test.com")
    with _mock_rzp():
        r = client.post("/orders", json={
            "delivery_address": _ADDRESS,
            "items": [{"productId": pid, "quantity": 1}],
            "gift_card_code": card["code"],
        }, headers=bearer(token))
    assert r.status_code == 400
