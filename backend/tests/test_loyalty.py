"""
Loyalty points endpoint tests.

Covers: balance calculation from delivered+paid orders, and point redemption
rules (minimum, multiples of 100, can't exceed available).

Regression: _earned() used to compare a stringified user_id against the
ObjectId-typed user_id field on orders, so balances were always stuck at 0.
"""

from tests.conftest import insert_user, insert_category, insert_product, insert_order, get_token, bearer


def _headers(client, email="user@test.com"):
    token = get_token(client, email)
    return bearer(token)


def test_balance_zero_with_no_orders(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.get("/loyalty/balance", headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["earned"] == 0
    assert data["available"] == 0


def test_balance_counts_delivered_paid_orders(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, price=500.0)
    insert_order(db, uid, pid, status="delivered", payment_status="paid")
    hdrs = _headers(client)

    r = client.get("/loyalty/balance", headers=hdrs)
    data = r.json()["data"]
    assert data["earned"]    == 999   # order total is 999.0 from insert_order's fixed item price
    assert data["available"] == 999
    assert len(data["recentOrders"]) == 1


def test_balance_ignores_pending_orders(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid, status="pending", payment_status="pending")
    hdrs = _headers(client)

    r = client.get("/loyalty/balance", headers=hdrs)
    assert r.json()["data"]["earned"] == 0


def test_redeem_below_minimum_rejected(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.post("/loyalty/redeem", json={"points": 50}, headers=hdrs)
    assert r.status_code == 400


def test_redeem_non_multiple_of_100_rejected(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.post("/loyalty/redeem", json={"points": 150}, headers=hdrs)
    assert r.status_code == 400


def test_redeem_more_than_available_rejected(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.post("/loyalty/redeem", json={"points": 100}, headers=hdrs)
    assert r.status_code == 400
    assert "100" in r.json()["detail"] or "0" in r.json()["detail"]


def test_redeem_success_reduces_available_balance(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid, status="delivered", payment_status="paid")
    hdrs = _headers(client)

    r = client.post("/loyalty/redeem", json={"points": 900}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["discount"] == 90.0

    balance = client.get("/loyalty/balance", headers=hdrs).json()["data"]
    assert balance["redeemed"]  == 900
    assert balance["available"] == 99


def test_loyalty_endpoints_require_auth(client):
    assert client.get("/loyalty/balance").status_code == 401
    assert client.post("/loyalty/redeem", json={"points": 100}).status_code == 401


# ─── Membership tiers ─────────────────────────────────────────────────────────

def test_membership_defaults_to_silver_with_no_spend(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.get("/loyalty/membership", headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["tier"] == "Silver"
    assert data["lifetimeSpend"] == 0
    assert data["nextTier"] == "Gold"


def test_membership_reaches_gold_from_lifetime_paid_spend(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    # Paid orders count toward lifetime spend regardless of delivery status (unlike points).
    insert_order(db, uid, pid, status="confirmed", payment_status="paid", total=10000.0)
    hdrs = _headers(client)

    r = client.get("/loyalty/membership", headers=hdrs)
    data = r.json()["data"]
    assert data["tier"] == "Gold"
    assert data["nextTier"] == "Platinum"


def test_membership_ignores_unpaid_orders(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid, status="pending", payment_status="pending", total=50000.0)
    hdrs = _headers(client)

    r = client.get("/loyalty/membership", headers=hdrs)
    assert r.json()["data"]["tier"] == "Silver"


def test_membership_reaches_platinum_and_has_no_next_tier(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid, status="confirmed", payment_status="paid", total=30000.0)
    hdrs = _headers(client)

    r = client.get("/loyalty/membership", headers=hdrs)
    data = r.json()["data"]
    assert data["tier"] == "Platinum"
    assert data["nextTier"] is None
    assert data["perks"]["freeDelivery"] is True


def test_gold_member_gets_free_delivery_below_standard_threshold(client, db):
    from unittest.mock import patch, MagicMock
    uid    = insert_user(db)
    cat_id = insert_category(db)
    big_pid   = insert_product(db, cat_id, name="Bulk Order", price=10000.0)
    cheap_pid = insert_product(db, cat_id, name="Cheap Item", price=500.0)
    insert_order(db, uid, big_pid, status="confirmed", payment_status="paid", total=10000.0)

    token = get_token(client, "user@test.com")
    mock_client = MagicMock()
    mock_client.order.create.return_value = {"id": "order_fake"}
    with patch("app.services.order_service.razorpay.Client", return_value=mock_client):
        r = client.post("/orders", json={
            "delivery_address": {
                "full_name": "Test User", "phone": "9999999999", "address_line1": "123 St",
                "city": "Delhi", "state": "Delhi", "pincode": "110001",
            },
            "items": [{"productId": str(cheap_pid), "quantity": 1}],
        }, headers=bearer(token))

    assert r.status_code == 200
    order = db.orders.find_one({"_id": __import__("bson").ObjectId(r.json()["data"]["orderId"])})
    assert order["delivery_charge"] == 0.0   # 500 >= Gold's 499 free-delivery threshold


# ─── Birthday rewards ─────────────────────────────────────────────────────────

def test_birthday_bonus_granted_on_matching_date(client, db):
    from datetime import datetime, timezone
    uid = insert_user(db)
    today = datetime.now(timezone.utc)
    db.users.update_one({"_id": uid}, {"$set": {"date_of_birth": f"1990-{today.month:02d}-{today.day:02d}"}})

    hdrs = _headers(client)
    r = client.get("/loyalty/balance", headers=hdrs)
    data = r.json()["data"]
    assert data["birthdayBonusGranted"] is True
    assert data["bonusPoints"] == 500
    assert data["available"] == 500


def test_birthday_bonus_not_granted_twice_same_year(client, db):
    from datetime import datetime, timezone
    uid = insert_user(db)
    today = datetime.now(timezone.utc)
    db.users.update_one({"_id": uid}, {"$set": {"date_of_birth": f"1990-{today.month:02d}-{today.day:02d}"}})
    hdrs = _headers(client)

    client.get("/loyalty/balance", headers=hdrs)
    r2 = client.get("/loyalty/balance", headers=hdrs)
    data = r2.json()["data"]
    assert data["birthdayBonusGranted"] is False
    assert data["bonusPoints"] == 500   # unchanged, not doubled


def test_no_birthday_bonus_on_non_birthday(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.get("/loyalty/balance", headers=hdrs)
    data = r.json()["data"]
    assert data["birthdayBonusGranted"] is False
    assert data["bonusPoints"] == 0
