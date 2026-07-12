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


def test_admin_create_product_defaults_to_in_stock_when_omitted(client, db):
    """
    Regression test: admin_create_product used to do bool(data.get("inStock", True)),
    but since the router dumps the request with exclude_none=False, an omitted inStock
    is present in the dict as None — and .get() only falls back to its default when the
    key is *missing*, not when its value is None. bool(None) is False, so every product
    created without explicitly passing inStock silently became out-of-stock.
    """
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    r = client.post("/admin/products", json={"name": "Barramundi", "categoryId": cat_id, "price": 800.0}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["inStock"] is True
    assert r.json()["data"]["tags"] == []
    assert r.json()["data"]["images"] == []


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


def test_admin_list_products_search_with_regex_metacharacters_is_treated_literally(client, db):
    """Regression test — see product_service.admin_list_products: search terms
    are re.escape()'d before reaching the Mongo $regex, so '.*' is a literal
    substring search, not a wildcard that matches every product."""
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    client.post("/admin/products", json={"name": "Atlantic Salmon", "categoryId": cat_id, "price": 999.0}, headers=hdrs)

    r = client.get("/admin/products?search=.*", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["total"] == 0

    r2 = client.get("/admin/products?search=(a+)+$", headers=hdrs)
    assert r2.status_code == 200


# ─── Bulk product actions ─────────────────────────────────────────────────────

def test_admin_bulk_update_products(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    p1 = client.post("/admin/products", json={"name": "P1", "categoryId": cat_id, "price": 100.0}, headers=hdrs).json()["data"]["id"]
    p2 = client.post("/admin/products", json={"name": "P2", "categoryId": cat_id, "price": 200.0}, headers=hdrs).json()["data"]["id"]

    r = client.put("/admin/products/bulk-update", json={
        "productIds": [p1, p2], "isFeatured": True,
    }, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["updated"] == 2

    list_r = client.get("/admin/products", headers=hdrs)
    assert all(p["isFeatured"] for p in list_r.json()["data"])


def test_admin_bulk_update_rejects_no_valid_ids(client, db):
    hdrs = _admin_headers(client, db)
    r = client.put("/admin/products/bulk-update", json={"productIds": ["not-an-id"], "isFeatured": True}, headers=hdrs)
    assert r.status_code == 400


def test_admin_bulk_delete_products(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    p1 = client.post("/admin/products", json={"name": "P1", "categoryId": cat_id, "price": 100.0}, headers=hdrs).json()["data"]["id"]
    p2 = client.post("/admin/products", json={"name": "P2", "categoryId": cat_id, "price": 200.0}, headers=hdrs).json()["data"]["id"]

    r = client.post("/admin/products/bulk-delete", json={"productIds": [p1, p2]}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["deleted"] == 2

    list_r = client.get("/admin/products", headers=hdrs)
    assert list_r.json()["total"] == 0


def test_bulk_product_endpoints_block_customers(client, db):
    hdrs = _customer_headers(client, db)
    assert client.put("/admin/products/bulk-update", json={"productIds": [], "isFeatured": True}, headers=hdrs).status_code == 403
    assert client.post("/admin/products/bulk-delete", json={"productIds": []}, headers=hdrs).status_code == 403
    assert client.get("/admin/products/export", headers=hdrs).status_code == 403


# ─── CSV bulk import ───────────────────────────────────────────────────────────

def _csv_file(text: str):
    return {"file": ("products.csv", text.encode("utf-8"), "text/csv")}


def test_admin_bulk_import_creates_products(client, db):
    hdrs = _admin_headers(client, db)
    insert_category(db, name="Seafood", slug="seafood")

    csv_text = (
        "name,slug,category,price,originalPrice,stockQuantity,weight,origin,brand,tags,images,inStock,isFeatured,isBestSeller,description\n"
        "Norwegian Salmon,,Seafood,1299,,50,500g,Norway,Fjord,fresh,,true,true,false,Tasty salmon\n"
        "King Prawns,,Seafood,799,,30,1kg,India,,,,,,,\n"
    )
    r = client.post("/admin/products/bulk-import", files=_csv_file(csv_text), headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["created"] == 2
    assert data["skipped"] == 0

    list_r = client.get("/admin/products", headers=hdrs)
    names = {p["name"] for p in list_r.json()["data"]}
    assert names == {"Norwegian Salmon", "King Prawns"}


def test_admin_bulk_import_reports_row_errors(client, db):
    hdrs = _admin_headers(client, db)
    csv_text = (
        "name,category,price\n"
        ",Seafood,100\n"                # missing name
        "Bad Category Item,Nope,100\n"  # unknown category
        "Bad Price Item,,abc\n"         # invalid price
    )
    r = client.post("/admin/products/bulk-import", files=_csv_file(csv_text), headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["created"] == 0
    assert data["skipped"] == 3
    reasons = " ".join(e["reason"] for e in data["errors"])
    assert "name" in reasons.lower()
    assert "category" in reasons.lower()
    assert "price" in reasons.lower()


def test_admin_bulk_import_rejects_non_csv(client, db):
    hdrs = _admin_headers(client, db)
    r = client.post("/admin/products/bulk-import", files={"file": ("data.txt", b"hi", "text/plain")}, headers=hdrs)
    assert r.status_code == 400


def test_admin_bulk_import_rejects_empty_csv(client, db):
    hdrs = _admin_headers(client, db)
    r = client.post("/admin/products/bulk-import", files=_csv_file("name,price\n"), headers=hdrs)
    assert r.status_code == 400


# ─── CSV export ────────────────────────────────────────────────────────────────

def test_admin_export_products_csv(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db, name="Seafood"))
    client.post("/admin/products", json={"name": "Salmon", "categoryId": cat_id, "price": 999.0}, headers=hdrs)

    r = client.get("/admin/products/export", headers=hdrs)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    body = r.text
    assert "Salmon" in body
    assert "Seafood" in body


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


def test_admin_concurrent_status_updates_only_one_succeeds(client, db):
    """Regression test for a race condition: two admin requests transitioning
    the same order (double-click, retry, two admin sessions) must not both
    succeed — the second must see the order already moved and reject."""
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="pending")

    with patch("app.services.email_service.send_async"):
        r1 = client.put(f"/admin/orders/{oid}/status", json={"status": "confirmed"}, headers=hdrs)
        r2 = client.put(f"/admin/orders/{oid}/status", json={"status": "confirmed"}, headers=hdrs)

    assert r1.status_code == 200
    assert r2.status_code == 400

    order = db.orders.find_one({"_id": oid})
    # Exactly one "confirmed" tracking-timeline entry, not two.
    assert sum(1 for e in order["tracking_timeline"] if e["status"] == "confirmed") == 1


def test_admin_concurrent_cancellations_only_restore_stock_once(client, db):
    """Same race, via the admin cancellation path specifically — stock must
    only be restored once even if two admin cancel requests race."""
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Stock Item", price=500.0)
    before = db.products.find_one({"_id": pid})["stock_quantity"]
    oid    = insert_order(db, uid, pid, status="confirmed")

    with patch("app.services.email_service.send_async"):
        r1 = client.put(f"/admin/orders/{oid}/status", json={"status": "cancelled", "note": "A"}, headers=hdrs)
        r2 = client.put(f"/admin/orders/{oid}/status", json={"status": "cancelled", "note": "B"}, headers=hdrs)

    assert r1.status_code == 200
    assert r2.status_code == 400

    after = db.products.find_one({"_id": pid})["stock_quantity"]
    assert after == before + 1   # restored exactly once


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
    assert "deliveryAnalytics" in data
    assert data["deliveryAnalytics"] == {
        "totalDeliveries": 0, "activeDeliveries": 0, "completedDeliveries": 0,
        "cancelledDeliveries": 0, "avgDeliveryTimeHours": 0.0,
    }
    for key in [
        "salesSummary", "estimatedProfit", "worstSellers", "fastMoving", "slowMoving",
        "mostViewed", "leastViewed", "topCustomers", "returningCustomersPct", "abandonedOrders",
    ]:
        assert key in data


# ─── Delivery partner management ───────────────────────────────────────────────

def test_delivery_endpoints_block_customers(client, db):
    hdrs = _customer_headers(client, db)
    uid    = insert_user(db, email="cust2@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="shipped")
    r = client.put(f"/admin/orders/{oid}/delivery", json={"provider": "Porter"}, headers=hdrs)
    assert r.status_code == 403


def test_delivery_endpoints_block_anonymous(client, db):
    uid    = insert_user(db, email="cust2@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="shipped")
    r = client.put(f"/admin/orders/{oid}/delivery", json={"provider": "Porter"})
    assert r.status_code == 401


def test_admin_creates_delivery(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust2@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="shipped")

    r = client.put(f"/admin/orders/{oid}/delivery", json={
        "provider": "Porter",
        "trackingId": "PTR-8821",
        "bookingId": "BK-4471",
        "partnerName": "Ramesh Kumar",
        "driverPhone": "9812345678",
        "vehicleNumber": "DL-1AB-2345",
        "deliveryCharge": 60,
        "notes": "Handle with care",
    }, headers=hdrs)

    assert r.status_code == 200
    delivery = r.json()["data"]["delivery"]
    assert delivery["provider"] == "Porter"
    assert delivery["trackingId"] == "PTR-8821"
    assert delivery["partnerName"] == "Ramesh Kumar"
    assert delivery["deliveryStatus"] == "packed"  # default when not explicitly set


def test_admin_updates_delivery_status_appends_timeline_and_notifies(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust2@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="shipped")

    client.put(f"/admin/orders/{oid}/delivery", json={"provider": "Porter", "deliveryStatus": "packed"}, headers=hdrs)
    r = client.put(f"/admin/orders/{oid}/delivery", json={"deliveryStatus": "in_transit"}, headers=hdrs)

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["delivery"]["deliveryStatus"] == "in_transit"
    timeline_statuses = [e["status"] for e in data["trackingTimeline"]]
    assert "delivery_packed" in timeline_statuses
    assert "delivery_in_transit" in timeline_statuses

    notifs = list(db.notifications.find({"user_id": uid, "type": "delivery_update"}).sort("created_at", -1))
    assert len(notifs) == 2  # one for "packed", one for "in_transit"
    assert "out for delivery" in notifs[0]["message"].lower()


def test_admin_delivery_status_delivered_sets_delivered_at(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust2@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="shipped")

    r = client.put(f"/admin/orders/{oid}/delivery", json={"deliveryStatus": "delivered"}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["delivery"]["deliveredAt"] is not None


def test_admin_delivery_rejects_invalid_status(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust2@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="shipped")

    r = client.put(f"/admin/orders/{oid}/delivery", json={"deliveryStatus": "on_the_moon"}, headers=hdrs)
    assert r.status_code == 400


def test_admin_delivery_partial_update_preserves_other_fields(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust2@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="shipped")

    client.put(f"/admin/orders/{oid}/delivery", json={"provider": "Porter", "trackingId": "PTR-1"}, headers=hdrs)
    r = client.put(f"/admin/orders/{oid}/delivery", json={"driverName": "Suresh"}, headers=hdrs)

    delivery = r.json()["data"]["delivery"]
    assert delivery["provider"] == "Porter"
    assert delivery["trackingId"] == "PTR-1"
    assert delivery["driverName"] == "Suresh"


def test_admin_orders_filters_by_delivery_status(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust2@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid1   = insert_order(db, uid, pid, status="shipped")
    insert_order(db, uid, pid, status="shipped")

    client.put(f"/admin/orders/{oid1}/delivery", json={"deliveryStatus": "in_transit"}, headers=hdrs)

    r = client.get("/admin/orders?deliveryStatus=in_transit", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["data"][0]["id"] == str(oid1)


# ─── Invoices ───────────────────────────────────────────────────────────────────

def test_admin_downloads_any_order_invoice(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust3@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid)

    r = client.get(f"/admin/orders/{oid}/invoice", headers=hdrs)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:4] == b"%PDF"


def test_admin_invoice_endpoints_block_customers(client, db):
    hdrs   = _customer_headers(client, db)
    uid    = insert_user(db, email="cust3@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid)

    assert client.get(f"/admin/orders/{oid}/invoice", headers=hdrs).status_code == 403
    assert client.post(f"/admin/orders/{oid}/invoice/email", headers=hdrs).status_code == 403


def test_admin_emails_invoice_for_any_order(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust3@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid)

    with patch("app.services.email_service.send_invoice_email") as mock_send:
        r = client.post(f"/admin/orders/{oid}/invoice/email", headers=hdrs)
    assert r.status_code == 200
    mock_send.assert_called_once()
    assert mock_send.call_args.args[0] == "cust3@test.com"


# ─── Inventory ──────────────────────────────────────────────────────────────────

def test_admin_create_product_logs_initial_stock_movement(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    r = client.post("/admin/products", json={"name": "Cod Fillet", "categoryId": cat_id, "price": 500.0, "stockQuantity": 30}, headers=hdrs)
    pid = r.json()["data"]["id"]

    assert r.json()["data"]["stockStatus"] == "in_stock"
    assert r.json()["data"]["availableStock"] == 30
    assert r.json()["data"]["reservedStock"] == 0

    history = client.get(f"/admin/products/{pid}/stock-history", headers=hdrs).json()["data"]
    assert len(history) == 1
    assert history[0]["type"] == "product_created"
    assert history[0]["quantityDelta"] == 30


def test_admin_update_stock_quantity_logs_movement(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    pid = client.post("/admin/products", json={"name": "Prawns", "categoryId": cat_id, "price": 500.0, "stockQuantity": 20}, headers=hdrs).json()["data"]["id"]

    client.put(f"/admin/products/{pid}", json={"stockQuantity": 15}, headers=hdrs)

    history = client.get(f"/admin/products/{pid}/stock-history", headers=hdrs).json()["data"]
    assert history[0]["type"] == "manual_adjustment"
    assert history[0]["quantityDelta"] == -5


def test_admin_low_stock_and_out_of_stock_status(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    pid = client.post("/admin/products", json={
        "name": "Tuna Steak", "categoryId": cat_id, "price": 500.0,
        "stockQuantity": 5, "lowStockThreshold": 10,
    }, headers=hdrs).json()["data"]["id"]

    r = client.get(f"/admin/products?search=Tuna", headers=hdrs)
    assert r.json()["data"][0]["stockStatus"] == "low_stock"

    client.post(f"/admin/products/{pid}/stock-adjustment", json={"type": "remove", "quantity": 5}, headers=hdrs)
    r = client.get(f"/admin/products?search=Tuna", headers=hdrs)
    assert r.json()["data"][0]["stockStatus"] == "out_of_stock"


def test_admin_filters_products_by_stock_status(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    client.post("/admin/products", json={"name": "Plenty Fish", "categoryId": cat_id, "price": 100.0, "stockQuantity": 100}, headers=hdrs)
    client.post("/admin/products", json={"name": "Rare Fish", "categoryId": cat_id, "price": 100.0, "stockQuantity": 0}, headers=hdrs)

    r = client.get("/admin/products?stockStatus=out_of_stock", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["data"][0]["name"] == "Rare Fish"


def test_admin_stock_status_filter_paginates_correctly(client, db):
    """
    Regression test: pagination for the stockStatus filter used to load every
    matching row into Python before slicing it there. Now it's a $facet doing
    skip/limit and the count inside the same aggregation — this pins down
    that total/page/data still behave exactly like plain pagination.
    """
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    for i in range(5):
        client.post("/admin/products", json={
            "name": f"Out Of Stock {i}", "categoryId": cat_id, "price": 100.0, "stockQuantity": 0,
        }, headers=hdrs)

    r1 = client.get("/admin/products?stockStatus=out_of_stock&page=1&limit=2", headers=hdrs)
    assert r1.status_code == 200
    body1 = r1.json()
    assert body1["total"] == 5
    assert body1["totalPages"] == 3
    assert len(body1["data"]) == 2

    r2 = client.get("/admin/products?stockStatus=out_of_stock&page=3&limit=2", headers=hdrs)
    body2 = r2.json()
    assert len(body2["data"]) == 1   # last page has the remainder
    # No product appears on both pages
    page1_names = {p["name"] for p in body1["data"]}
    page2_names = {p["name"] for p in body2["data"]}
    assert page1_names.isdisjoint(page2_names)


def test_admin_stock_adjustment_add_and_remove(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    pid = client.post("/admin/products", json={"name": "Crab", "categoryId": cat_id, "price": 500.0, "stockQuantity": 10}, headers=hdrs).json()["data"]["id"]

    r = client.post(f"/admin/products/{pid}/stock-adjustment", json={"type": "add", "quantity": 5, "note": "Restock"}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["stockQuantity"] == 15

    r = client.post(f"/admin/products/{pid}/stock-adjustment", json={"type": "remove", "quantity": 3}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["stockQuantity"] == 12


def test_admin_stock_adjustment_damaged(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    pid = client.post("/admin/products", json={"name": "Squid", "categoryId": cat_id, "price": 500.0, "stockQuantity": 10}, headers=hdrs).json()["data"]["id"]

    r = client.post(f"/admin/products/{pid}/stock-adjustment", json={"type": "damaged", "quantity": 4}, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["stockQuantity"] == 6
    assert data["damagedStock"] == 4


def test_admin_stock_adjustment_rejects_removing_more_than_available(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    pid = client.post("/admin/products", json={"name": "Lobster", "categoryId": cat_id, "price": 500.0, "stockQuantity": 2}, headers=hdrs).json()["data"]["id"]

    r = client.post(f"/admin/products/{pid}/stock-adjustment", json={"type": "remove", "quantity": 5}, headers=hdrs)
    assert r.status_code == 400


def test_admin_record_return_with_restock(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    pid = client.post("/admin/products", json={"name": "Salmon Steak", "categoryId": cat_id, "price": 500.0, "stockQuantity": 10}, headers=hdrs).json()["data"]["id"]

    r = client.post(f"/admin/products/{pid}/returns", json={"quantity": 2, "restock": True}, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["stockQuantity"] == 12
    assert data["returnedStock"] == 2


def test_admin_record_return_without_restock(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    pid = client.post("/admin/products", json={"name": "Octopus", "categoryId": cat_id, "price": 500.0, "stockQuantity": 10}, headers=hdrs).json()["data"]["id"]

    r = client.post(f"/admin/products/{pid}/returns", json={"quantity": 2, "restock": False}, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["stockQuantity"] == 10  # unchanged — not sellable
    assert data["returnedStock"] == 2


def test_inventory_endpoints_block_customers(client, db):
    hdrs   = _customer_headers(client, db)
    cat_id = str(insert_category(db))
    pid    = str(insert_product(db, cat_id))
    assert client.post(f"/admin/products/{pid}/stock-adjustment", json={"type": "add", "quantity": 1}, headers=hdrs).status_code == 403
    assert client.post(f"/admin/products/{pid}/returns", json={"quantity": 1, "restock": True}, headers=hdrs).status_code == 403
    assert client.get(f"/admin/products/{pid}/stock-history", headers=hdrs).status_code == 403
    assert client.get("/admin/stock-history", headers=hdrs).status_code == 403


# ─── Order lifecycle: reserve / commit / release ────────────────────────────────

def test_order_placement_decrements_stock_and_reserves(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    pid = client.post("/admin/products", json={"name": "Basa Fillet", "categoryId": cat_id, "price": 500.0, "stockQuantity": 10}, headers=hdrs).json()["data"]["id"]

    uid   = insert_user(db, email="shopper@test.com")
    token = get_token(client, "shopper@test.com")

    from unittest.mock import MagicMock
    with patch("app.services.order_service.razorpay.Client") as MockClient:
        MockClient.return_value.order.create.return_value = {"id": "order_fake_1"}
        r = client.post("/orders", json={
            "delivery_address": {
                "full_name": "Test", "phone": "9999999999", "address_line1": "St",
                "city": "Delhi", "state": "Delhi", "pincode": "110001",
            },
            "items": [{"productId": pid, "quantity": 3}],
        }, headers=bearer(token))
    assert r.status_code == 200

    product = client.get(f"/admin/products?search=Basa", headers=hdrs).json()["data"][0]
    assert product["stockQuantity"] == 7
    assert product["reservedStock"] == 3
    assert product["availableStock"] == 4


def test_order_placement_rejects_insufficient_stock(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = str(insert_category(db))
    pid = client.post("/admin/products", json={"name": "Rare Eel", "categoryId": cat_id, "price": 500.0, "stockQuantity": 2}, headers=hdrs).json()["data"]["id"]

    insert_user(db, email="shopper2@test.com")
    token = get_token(client, "shopper2@test.com")

    with patch("app.services.order_service.razorpay.Client") as MockClient:
        MockClient.return_value.order.create.return_value = {"id": "order_fake_2"}
        r = client.post("/orders", json={
            "delivery_address": {
                "full_name": "Test", "phone": "9999999999", "address_line1": "St",
                "city": "Delhi", "state": "Delhi", "pincode": "110001",
            },
            "items": [{"productId": pid, "quantity": 5}],
        }, headers=bearer(token))
    assert r.status_code == 400
    assert "available" in r.json()["detail"].lower()
