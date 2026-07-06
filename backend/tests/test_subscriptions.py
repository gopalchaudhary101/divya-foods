"""
Subscription endpoint tests.

Covers: create/list/update/cancel, duplicate-active-subscription guard,
frequency-driven next-delivery date, and ownership checks.
"""

from bson import ObjectId

from tests.conftest import insert_user, get_token, bearer

_SUB_PAYLOAD = {
    "productId":    "prod123",
    "productName":  "Norwegian Salmon",
    "productPrice": 999.0,
    "quantity":     2,
    "frequency":    "weekly",
}


def _headers(client, email="user@test.com"):
    token = get_token(client, email)
    return bearer(token)


def test_create_subscription(client, db):
    insert_user(db)
    hdrs = _headers(client)

    r = client.post("/subscriptions", json=_SUB_PAYLOAD, headers=hdrs)
    assert r.status_code == 201
    data = r.json()["data"]
    assert data["productName"] == "Norwegian Salmon"
    assert data["quantity"]    == 2
    assert data["status"]      == "active"
    assert data["discountPct"] == 10
    assert data["nextDelivery"] is not None


def test_list_subscriptions(client, db):
    insert_user(db)
    hdrs = _headers(client)
    client.post("/subscriptions", json=_SUB_PAYLOAD, headers=hdrs)

    r = client.get("/subscriptions", headers=hdrs)
    assert len(r.json()["data"]) == 1


def test_duplicate_active_subscription_rejected(client, db):
    insert_user(db)
    hdrs = _headers(client)
    client.post("/subscriptions", json=_SUB_PAYLOAD, headers=hdrs)

    r = client.post("/subscriptions", json=_SUB_PAYLOAD, headers=hdrs)
    assert r.status_code == 400


def test_list_subscriptions_scoped_to_user(client, db):
    insert_user(db, email="usera@test.com")
    insert_user(db, email="userb@test.com")

    hdrs_a = _headers(client, "usera@test.com")
    hdrs_b = _headers(client, "userb@test.com")
    client.post("/subscriptions", json=_SUB_PAYLOAD, headers=hdrs_a)

    assert len(client.get("/subscriptions", headers=hdrs_a).json()["data"]) == 1
    assert len(client.get("/subscriptions", headers=hdrs_b).json()["data"]) == 0


def test_update_subscription_quantity_and_frequency(client, db):
    insert_user(db)
    hdrs = _headers(client)
    sub_id = client.post("/subscriptions", json=_SUB_PAYLOAD, headers=hdrs).json()["data"]["id"]

    r = client.put(f"/subscriptions/{sub_id}", json={"quantity": 5, "frequency": "monthly"}, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["quantity"]  == 5
    assert data["frequency"] == "monthly"


def test_pause_and_resume_subscription(client, db):
    insert_user(db)
    hdrs = _headers(client)
    sub_id = client.post("/subscriptions", json=_SUB_PAYLOAD, headers=hdrs).json()["data"]["id"]

    r1 = client.put(f"/subscriptions/{sub_id}", json={"status": "paused"}, headers=hdrs)
    assert r1.json()["data"]["status"] == "paused"

    r2 = client.put(f"/subscriptions/{sub_id}", json={"status": "active"}, headers=hdrs)
    assert r2.json()["data"]["status"] == "active"


def test_update_nonexistent_subscription(client, db):
    insert_user(db)
    hdrs = _headers(client)
    fake_id = str(ObjectId())
    r = client.put(f"/subscriptions/{fake_id}", json={"quantity": 3}, headers=hdrs)
    assert r.status_code == 404


def test_cannot_update_other_users_subscription(client, db):
    insert_user(db, email="owner@test.com")
    insert_user(db, email="intruder@test.com")

    owner_hdrs = _headers(client, "owner@test.com")
    sub_id = client.post("/subscriptions", json=_SUB_PAYLOAD, headers=owner_hdrs).json()["data"]["id"]

    intruder_hdrs = _headers(client, "intruder@test.com")
    r = client.put(f"/subscriptions/{sub_id}", json={"quantity": 3}, headers=intruder_hdrs)
    assert r.status_code == 404


def test_cancel_subscription(client, db):
    insert_user(db)
    hdrs = _headers(client)
    sub_id = client.post("/subscriptions", json=_SUB_PAYLOAD, headers=hdrs).json()["data"]["id"]

    del_r = client.delete(f"/subscriptions/{sub_id}", headers=hdrs)
    assert del_r.status_code == 204

    remaining = client.get("/subscriptions", headers=hdrs).json()["data"]
    assert remaining == []


def test_cancelled_subscription_frees_up_new_subscription(client, db):
    """After cancelling, the user should be able to subscribe to the same product again."""
    insert_user(db)
    hdrs = _headers(client)
    sub_id = client.post("/subscriptions", json=_SUB_PAYLOAD, headers=hdrs).json()["data"]["id"]
    client.delete(f"/subscriptions/{sub_id}", headers=hdrs)

    r = client.post("/subscriptions", json=_SUB_PAYLOAD, headers=hdrs)
    assert r.status_code == 201


def test_cancel_nonexistent_subscription(client, db):
    insert_user(db)
    hdrs = _headers(client)
    fake_id = str(ObjectId())
    r = client.delete(f"/subscriptions/{fake_id}", headers=hdrs)
    assert r.status_code == 404


def test_subscription_endpoints_require_auth(client):
    assert client.get("/subscriptions").status_code == 401
    assert client.post("/subscriptions", json=_SUB_PAYLOAD).status_code == 401


# ─── Admin view ────────────────────────────────────────────────────────────────

def test_admin_list_subscriptions(client, db):
    insert_user(db, email="cust@test.com")
    cust_hdrs = _headers(client, "cust@test.com")
    client.post("/subscriptions", json=_SUB_PAYLOAD, headers=cust_hdrs)

    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    admin_hdrs = _headers(client, "admin@test.com")

    r = client.get("/admin/subscriptions", headers=admin_hdrs)
    assert r.status_code == 200
    assert len(r.json()["data"]) == 1


def test_admin_subscriptions_requires_admin(client, db):
    insert_user(db, email="cust@test.com")
    hdrs = _headers(client, "cust@test.com")
    r = client.get("/admin/subscriptions", headers=hdrs)
    assert r.status_code == 403
