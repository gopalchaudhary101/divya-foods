"""
Coupon endpoint tests.

Covers: /coupons/validate (public) and /admin/coupons CRUD.
"""

from datetime import datetime, timedelta, timezone

from bson import ObjectId

from tests.conftest import insert_user, get_token, bearer


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _insert_coupon(db, **overrides):
    doc = {
        "code":            "SAVE10",
        "discount_type":   "percentage",
        "discount_value":  10,
        "min_order_value": 0,
        "max_discount":    None,
        "is_active":       True,
        "expires_at":      None,
        "usage_limit":     None,
        "used_count":      0,
        "created_at":      datetime.now(timezone.utc),
        "updated_at":      datetime.now(timezone.utc),
    }
    doc.update(overrides)
    return db.coupons.insert_one(doc).inserted_id


# ─── Validate (public) ─────────────────────────────────────────────────────────

def test_validate_unknown_coupon(client, db):
    r = client.post("/coupons/validate", json={"code": "NOPE", "order_amount": 500})
    assert r.status_code == 200
    assert r.json()["data"]["valid"] is False


def test_validate_percentage_coupon(client, db):
    _insert_coupon(db, code="SAVE10", discount_type="percentage", discount_value=10)
    r = client.post("/coupons/validate", json={"code": "save10", "order_amount": 1000})
    data = r.json()["data"]
    assert data["valid"] is True
    assert data["discountAmount"] == 100.0


def test_validate_flat_coupon(client, db):
    _insert_coupon(db, code="FLAT50", discount_type="flat", discount_value=50)
    r = client.post("/coupons/validate", json={"code": "FLAT50", "order_amount": 500})
    assert r.json()["data"]["discountAmount"] == 50.0


def test_validate_percentage_capped_by_max_discount(db, client):
    _insert_coupon(db, code="BIG50", discount_type="percentage", discount_value=50, max_discount=100)
    r = client.post("/coupons/validate", json={"code": "BIG50", "order_amount": 1000})
    assert r.json()["data"]["discountAmount"] == 100.0


def test_validate_inactive_coupon(client, db):
    _insert_coupon(db, code="OLD", is_active=False)
    r = client.post("/coupons/validate", json={"code": "OLD", "order_amount": 500})
    assert r.json()["data"]["valid"] is False


def test_validate_expired_coupon(client, db):
    _insert_coupon(db, code="EXPIRED", expires_at=datetime.now(timezone.utc) - timedelta(days=1))
    r = client.post("/coupons/validate", json={"code": "EXPIRED", "order_amount": 500})
    assert r.json()["data"]["valid"] is False


def test_validate_below_minimum_order(client, db):
    _insert_coupon(db, code="MIN500", min_order_value=500)
    r = client.post("/coupons/validate", json={"code": "MIN500", "order_amount": 100})
    assert r.json()["data"]["valid"] is False


def test_validate_usage_limit_reached(client, db):
    _insert_coupon(db, code="LIMITED", usage_limit=1, used_count=1)
    r = client.post("/coupons/validate", json={"code": "LIMITED", "order_amount": 500})
    assert r.json()["data"]["valid"] is False


# ─── Admin CRUD ────────────────────────────────────────────────────────────────

def test_admin_create_coupon(client, db):
    hdrs = _admin_headers(client, db)
    r = client.post("/admin/coupons", json={
        "code":           "WELCOME20",
        "discountType":   "percentage",
        "discountValue":  20,
        "minOrderValue":  200,
        "isActive":       True,
    }, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["code"] == "WELCOME20"
    assert data["discountValue"] == 20


def test_admin_create_duplicate_coupon_conflict(client, db):
    hdrs = _admin_headers(client, db)
    payload = {"code": "DUPE", "discountType": "flat", "discountValue": 10}
    r1 = client.post("/admin/coupons", json=payload, headers=hdrs)
    r2 = client.post("/admin/coupons", json=payload, headers=hdrs)
    assert r1.status_code == 200
    assert r2.status_code == 409


def test_admin_list_coupons(client, db):
    hdrs = _admin_headers(client, db)
    _insert_coupon(db, code="A")
    _insert_coupon(db, code="B")
    r = client.get("/admin/coupons", headers=hdrs)
    codes = [c["code"] for c in r.json()["data"]]
    assert set(codes) == {"A", "B"}


def test_admin_update_coupon(client, db):
    hdrs = _admin_headers(client, db)
    cid  = str(_insert_coupon(db, code="OLDCODE"))

    r = client.put(f"/admin/coupons/{cid}", json={
        "code":          "NEWCODE",
        "discountType":  "flat",
        "discountValue": 75,
    }, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["code"] == "NEWCODE"


def test_admin_update_nonexistent_coupon(client, db):
    hdrs = _admin_headers(client, db)
    fake_id = str(ObjectId())
    r = client.put(f"/admin/coupons/{fake_id}", json={
        "code": "X", "discountType": "flat", "discountValue": 10,
    }, headers=hdrs)
    assert r.status_code == 404


def test_admin_delete_coupon(client, db):
    hdrs = _admin_headers(client, db)
    cid  = str(_insert_coupon(db))

    del_r = client.delete(f"/admin/coupons/{cid}", headers=hdrs)
    assert del_r.status_code == 200

    list_r = client.get("/admin/coupons", headers=hdrs)
    ids = [c["id"] for c in list_r.json()["data"]]
    assert cid not in ids


def test_admin_coupon_endpoints_require_admin(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    r = client.get("/admin/coupons", headers=bearer(token))
    assert r.status_code == 403
