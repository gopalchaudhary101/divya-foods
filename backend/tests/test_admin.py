"""
Admin endpoint tests.

Covers: product CRUD, order status transitions, analytics, access control.
"""

from unittest.mock import patch

from tests.conftest import (
    insert_user, insert_category, insert_product, insert_order,
    get_token, bearer,
)


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _customer_headers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    return bearer(token)


# ─── Access control ───────────────────────────────────────────────────────────

def test_admin_endpoints_block_customers(client, db):
    hdrs = _customer_headers(client, db)
    assert client.get("/admin/products", headers=hdrs).status_code == 403
    assert client.get("/admin/orders",   headers=hdrs).status_code == 403
    assert client.get("/admin/stats",    headers=hdrs).status_code == 403


def test_admin_endpoints_block_anonymous(client):
    assert client.get("/admin/products").status_code == 401
    assert client.get("/admin/stats").status_code    == 401


# ─── Product CRUD ─────────────────────────────────────────────────────────────

def test_admin_list_products_empty(client, db):
    hdrs = _admin_headers(client, db)
    r = client.get("/admin/products", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_admin_create_product(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))

    r = client.post("/admin/products", json={
        "name":          "Norwegian Salmon",
        "categoryId":    cat_id,
        "price":         1299.0,
        "stockQuantity": 100,
        "inStock":       True,
        "isFeatured":    True,
        "isBestSeller":  False,
    }, headers=hdrs)

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["name"]       == "Norwegian Salmon"
    assert data["slug"]       == "norwegian-salmon"
    assert data["price"]      == 1299.0
    assert data["isFeatured"] is True


def test_admin_create_product_auto_unique_slug(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))

    payload = {"name": "Salmon", "categoryId": cat_id, "price": 500.0}
    r1 = client.post("/admin/products", json=payload, headers=hdrs)
    r2 = client.post("/admin/products", json=payload, headers=hdrs)

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["data"]["slug"] != r2.json()["data"]["slug"]


def test_admin_update_product(client, db):
    hdrs = _admin_headers(client, db)
    cat_id = str(insert_category(db))

    # Create
    create_r = client.post("/admin/products", json={
        "name": "Old Name", "categoryId": cat_id, "price": 100.0,
    }, headers=hdrs)
    pid = create_r.json()["data"]["id"]

    # Update
    r = client.put(f"/admin/products/{pid}", json={
        "name": "New Name", "price": 299.0, "isFeatured": True,
    }, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["name"]       == "New Name"
    assert data["price"]      == 299.0
    assert data["isFeatured"] is True


def test_admin_update_product_slug_conflict(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))

    r1 = client.post("/admin/products", json={"name": "Alpha", "categoryId": cat_id, "price": 100.0}, headers=hdrs)
    r2 = client.post("/admin/products", json={"name": "Beta",  "categoryId": cat_id, "price": 200.0}, headers=hdrs)
    pid2 = r2.json()["data"]["id"]

    # Try to rename Beta's slug to "alpha" (already taken)
    r = client.put(f"/admin/products/{pid2}", json={"slug": "alpha"}, headers=hdrs)
    assert r.status_code == 400
    assert "slug" in r.json()["detail"].lower()


def test_admin_delete_product(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))

    r = client.post("/admin/products", json={"name": "To Delete", "categoryId": cat_id, "price": 50.0}, headers=hdrs)
    pid = r.json()["data"]["id"]

    del_r = client.delete(f"/admin/products/{pid}", headers=hdrs)
    assert del_r.status_code == 200

    # Confirm gone
    list_r = client.get("/admin/products", headers=hdrs)
    ids = [p["id"] for p in list_r.json()["data"]]
    assert pid not in ids


def test_admin_delete_nonexistent_product(client, db):
    hdrs = _admin_headers(client, db)
    from bson import ObjectId
    fake_id = str(ObjectId())
    r = client.delete(f"/admin/products/{fake_id}", headers=hdrs)
    assert r.status_code == 404


def test_admin_list_products_search(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    client.post("/admin/products", json={"name": "Atlantic Salmon", "categoryId": cat_id, "price": 999.0}, headers=hdrs)
    client.post("/admin/products", json={"name": "King Prawns",     "categoryId": cat_id, "price": 799.0}, headers=hdrs)

    r = client.get("/admin/products?search=salmon", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["data"][0]["name"] == "Atlantic Salmon"


# ─── Categories ───────────────────────────────────────────────────────────────

def test_admin_list_categories(client, db):
    hdrs = _admin_headers(client, db)
    insert_category(db, name="Seafood",   slug="seafood")
    insert_category(db, name="Japanese",  slug="japanese")

    r = client.get("/admin/categories", headers=hdrs)
    assert r.status_code == 200
    names = [c["name"] for c in r.json()["data"]]
    assert "Seafood" in names
    assert "Japanese" in names


# ─── Order status transitions ─────────────────────────────────────────────────

def test_admin_update_order_status_valid(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="pending")

    with patch("app.services.email_service.send_async"):
        r = client.put(f"/admin/orders/{oid}/status",
            json={"status": "confirmed", "note": "Order verified"},
            headers=hdrs,
        )
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "confirmed"


def test_admin_update_order_invalid_transition(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="delivered")

    r = client.put(f"/admin/orders/{oid}/status",
        json={"status": "pending"},  # can't go backwards
        headers=hdrs,
    )
    assert r.status_code == 400


def test_admin_cancel_restores_stock(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Stock Item", price=500.0)
    oid    = insert_order(db, uid, pid, status="confirmed")

    before = db.products.find_one({"_id": pid})["stock_quantity"]

    with patch("app.services.email_service.send_async"):
        client.put(f"/admin/orders/{oid}/status",
            json={"status": "cancelled", "note": "Admin cancelled"},
            headers=hdrs,
        )

    after = db.products.find_one({"_id": pid})["stock_quantity"]
    assert after == before + 1


# ─── Stats + analytics ────────────────────────────────────────────────────────

def test_admin_stats(client, db):
    hdrs = _admin_headers(client, db)
    r = client.get("/admin/stats", headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert "totalOrders"    in data
    assert "totalProducts"  in data
    assert "totalCustomers" in data
    assert "totalRevenue"   in data
    assert "recentOrders"   in data


def test_admin_analytics(client, db):
    hdrs = _admin_headers(client, db)
    r = client.get("/admin/analytics", headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert "dailyRevenue"      in data
    assert "ordersByStatus"    in data
    assert "topProducts"       in data
    assert "revenueByCategory" in data
    assert "metrics"           in data
