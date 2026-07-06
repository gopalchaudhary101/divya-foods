"""Bulk / wholesale order request tests — public submission + admin management."""

from bson import ObjectId

from tests.conftest import insert_user, get_token, bearer

_PAYLOAD = {
    "company_name": "Ocean Bistro",
    "contact_name": "Priya Shah",
    "email":        "priya@oceanbistro.com",
    "phone":        "9812345678",
    "items":        [{"productName": "Frozen Salmon Fillet", "quantity": 50}],
    "message":      "Need weekly delivery for our restaurant chain.",
}


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def test_submit_bulk_order_request(client, db):
    r = client.post("/bulk-orders", json=_PAYLOAD)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["status"] == "new"
    assert data["companyName"] == "Ocean Bistro"
    assert data["items"][0]["productName"] == "Frozen Salmon Fillet"


def test_submit_bulk_order_request_requires_items(client, db):
    payload = {**_PAYLOAD, "items": []}
    r = client.post("/bulk-orders", json=payload)
    assert r.status_code == 400


def test_submit_bulk_order_request_is_public(client, db):
    r = client.post("/bulk-orders", json=_PAYLOAD)
    assert r.status_code == 200   # no auth header sent at all


def test_admin_list_bulk_orders(client, db):
    client.post("/bulk-orders", json=_PAYLOAD)
    client.post("/bulk-orders", json={**_PAYLOAD, "contact_name": "Second Buyer", "email": "second@test.com"})

    hdrs = _admin_headers(client, db)
    r = client.get("/admin/bulk-orders", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["total"] == 2


def test_admin_list_bulk_orders_blocks_customers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    r = client.get("/admin/bulk-orders", headers=bearer(token))
    assert r.status_code == 403


def test_admin_update_bulk_order_status(client, db):
    created = client.post("/bulk-orders", json=_PAYLOAD).json()["data"]
    hdrs = _admin_headers(client, db)

    r = client.put(f"/admin/bulk-orders/{created['id']}", json={
        "status": "contacted", "admin_notes": "Called, sending quote tomorrow.",
    }, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "contacted"
    assert data["adminNotes"] == "Called, sending quote tomorrow."


def test_admin_update_bulk_order_rejects_invalid_status(client, db):
    created = client.post("/bulk-orders", json=_PAYLOAD).json()["data"]
    hdrs = _admin_headers(client, db)

    r = client.put(f"/admin/bulk-orders/{created['id']}", json={"status": "teleported"}, headers=hdrs)
    assert r.status_code == 400


def test_admin_update_bulk_order_404_for_missing(client, db):
    hdrs = _admin_headers(client, db)
    r = client.put(f"/admin/bulk-orders/{ObjectId()}", json={"status": "closed"}, headers=hdrs)
    assert r.status_code == 404


def test_admin_list_bulk_orders_filters_by_status(client, db):
    a = client.post("/bulk-orders", json=_PAYLOAD).json()["data"]
    client.post("/bulk-orders", json={**_PAYLOAD, "email": "second@test.com"})

    hdrs = _admin_headers(client, db)
    client.put(f"/admin/bulk-orders/{a['id']}", json={"status": "closed"}, headers=hdrs)

    r = client.get("/admin/bulk-orders", params={"status": "closed"}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["total"] == 1
