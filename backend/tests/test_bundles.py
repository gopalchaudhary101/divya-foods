"""
Bundle endpoint tests.

Covers: public listing/detail (with resolved product info) and admin CRUD.
"""

from bson import ObjectId

from tests.conftest import insert_user, insert_category, insert_product, get_token, bearer


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _insert_bundle(db, product_id, name="Seafood Combo", is_active=True):
    from datetime import datetime, timezone
    return db.bundles.insert_one({
        "name":         name,
        "description":  "Great value combo",
        "image":        None,
        "bundle_price": 999.0,
        "is_active":    is_active,
        "items":        [{"product_id": str(product_id), "quantity": 2}],
        "created_at":   datetime.now(timezone.utc),
    }).inserted_id


# ─── Public endpoints ──────────────────────────────────────────────────────────

def test_list_bundles_empty(client, db):
    r = client.get("/bundles")
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_list_bundles_excludes_inactive(client, db):
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id)
    _insert_bundle(db, pid, name="Active Combo", is_active=True)
    _insert_bundle(db, pid, name="Inactive Combo", is_active=False)

    r = client.get("/bundles")
    names = [b["name"] for b in r.json()["data"]]
    assert names == ["Active Combo"]


def test_list_bundles_resolves_product_details(client, db):
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id, name="Salmon Fillet", price=500.0)
    _insert_bundle(db, pid)

    r = client.get("/bundles")
    item = r.json()["data"][0]["items"][0]
    assert item["name"] == "Salmon Fillet"
    assert item["quantity"] == 2


def test_get_bundle_by_id(client, db):
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id)
    bid = str(_insert_bundle(db, pid))

    r = client.get(f"/bundles/{bid}")
    assert r.status_code == 200
    assert r.json()["data"]["id"] == bid


def test_get_bundle_not_found(client, db):
    fake_id = str(ObjectId())
    r = client.get(f"/bundles/{fake_id}")
    assert r.status_code == 404


def test_get_bundle_invalid_id(client, db):
    r = client.get("/bundles/not-an-object-id")
    assert r.status_code == 400


# ─── Admin CRUD ────────────────────────────────────────────────────────────────

def test_admin_create_bundle(client, db):
    hdrs = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid = str(insert_product(db, cat_id))

    r = client.post("/admin/bundles", json={
        "name":        "Value Pack",
        "description": "Two great products together",
        "bundlePrice": 1499.0,
        "isActive":    True,
        "items":       [{"productId": pid, "quantity": 1}],
    }, headers=hdrs)
    assert r.status_code == 201
    assert "id" in r.json()["data"]


def test_admin_list_bundles_includes_inactive(client, db):
    hdrs = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id)
    _insert_bundle(db, pid, name="Hidden", is_active=False)

    r = client.get("/admin/bundles", headers=hdrs)
    names = [b["name"] for b in r.json()["data"]]
    assert "Hidden" in names


def test_admin_update_bundle(client, db):
    hdrs = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id)
    bid = str(_insert_bundle(db, pid, name="Old Name"))

    r = client.put(f"/admin/bundles/{bid}", json={
        "name":        "New Name",
        "bundlePrice": 1299.0,
        "isActive":    True,
        "items":       [{"productId": str(pid), "quantity": 3}],
    }, headers=hdrs)
    assert r.status_code == 200

    updated = db.bundles.find_one({"_id": ObjectId(bid)})
    assert updated["name"] == "New Name"
    assert updated["items"][0]["quantity"] == 3


def test_admin_delete_bundle(client, db):
    hdrs = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id)
    bid = str(_insert_bundle(db, pid))

    del_r = client.delete(f"/admin/bundles/{bid}", headers=hdrs)
    assert del_r.status_code == 204
    assert db.bundles.find_one({"_id": ObjectId(bid)}) is None


def test_admin_bundle_endpoints_require_admin(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    r = client.get("/admin/bundles", headers=bearer(token))
    assert r.status_code == 403
