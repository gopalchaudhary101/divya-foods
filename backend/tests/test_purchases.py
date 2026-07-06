"""
Purchase order tests — supplier / batch / expiry tracking, and how a purchase's
lifecycle (ordered → received/cancelled) drives a product's incoming_stock and
stock_quantity.
"""

from tests.conftest import insert_user, insert_category, insert_product, get_token, bearer


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _customer_headers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    return bearer(token)


def test_purchase_endpoints_block_customers(client, db):
    hdrs   = _customer_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id))
    assert client.get("/admin/purchases", headers=hdrs).status_code == 403
    assert client.post("/admin/purchases", json={"productId": pid, "supplierName": "X", "unitCost": 1, "quantity": 1}, headers=hdrs).status_code == 403


def test_create_purchase_adds_to_incoming_stock(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id))

    r = client.post("/admin/purchases", json={
        "productId": pid, "supplierName": "Ocean Traders", "unitCost": 350.0, "quantity": 20,
        "invoiceNumber": "INV-001", "batchNumber": "B-42", "expiryDate": "2026-12-01T00:00:00Z",
    }, headers=hdrs)

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "ordered"
    assert data["totalCost"] == 7000.0
    assert data["batchNumber"] == "B-42"

    product = client.get(f"/admin/products?search=Test", headers=hdrs).json()["data"][0]
    assert product["incomingStock"] == 20
    assert product["stockQuantity"] == 50  # unchanged — not yet received


def test_receive_purchase_moves_incoming_to_stock(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id))

    purchase_id = client.post("/admin/purchases", json={
        "productId": pid, "supplierName": "Ocean Traders", "unitCost": 350.0, "quantity": 20,
    }, headers=hdrs).json()["data"]["id"]

    r = client.put(f"/admin/purchases/{purchase_id}/receive", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "received"

    product = client.get(f"/admin/products?search=Test", headers=hdrs).json()["data"][0]
    assert product["stockQuantity"] == 70   # 50 + 20
    assert product["incomingStock"] == 0

    history = client.get(f"/admin/products/{pid}/stock-history", headers=hdrs).json()["data"]
    assert history[0]["type"] == "purchase_received"
    assert history[0]["quantityDelta"] == 20


def test_cannot_receive_purchase_twice(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id))
    purchase_id = client.post("/admin/purchases", json={
        "productId": pid, "supplierName": "S", "unitCost": 10.0, "quantity": 5,
    }, headers=hdrs).json()["data"]["id"]

    client.put(f"/admin/purchases/{purchase_id}/receive", headers=hdrs)
    r = client.put(f"/admin/purchases/{purchase_id}/receive", headers=hdrs)
    assert r.status_code == 400


def test_cancel_purchase_releases_incoming_stock(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id))
    purchase_id = client.post("/admin/purchases", json={
        "productId": pid, "supplierName": "S", "unitCost": 10.0, "quantity": 8,
    }, headers=hdrs).json()["data"]["id"]

    r = client.delete(f"/admin/purchases/{purchase_id}", headers=hdrs)
    assert r.status_code == 200

    product = client.get(f"/admin/products?search=Test", headers=hdrs).json()["data"][0]
    assert product["incomingStock"] == 0
    assert product["stockQuantity"] == 50  # never touched


def test_cannot_cancel_received_purchase(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id))
    purchase_id = client.post("/admin/purchases", json={
        "productId": pid, "supplierName": "S", "unitCost": 10.0, "quantity": 3,
    }, headers=hdrs).json()["data"]["id"]
    client.put(f"/admin/purchases/{purchase_id}/receive", headers=hdrs)

    r = client.delete(f"/admin/purchases/{purchase_id}", headers=hdrs)
    assert r.status_code == 400


def test_update_purchase_quantity_adjusts_incoming_stock_delta(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id))
    purchase_id = client.post("/admin/purchases", json={
        "productId": pid, "supplierName": "S", "unitCost": 10.0, "quantity": 10,
    }, headers=hdrs).json()["data"]["id"]

    r = client.put(f"/admin/purchases/{purchase_id}", json={"quantity": 15}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["quantity"] == 15

    product = client.get(f"/admin/products?search=Test", headers=hdrs).json()["data"][0]
    assert product["incomingStock"] == 15


def test_cannot_edit_received_purchase(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id))
    purchase_id = client.post("/admin/purchases", json={
        "productId": pid, "supplierName": "S", "unitCost": 10.0, "quantity": 3,
    }, headers=hdrs).json()["data"]["id"]
    client.put(f"/admin/purchases/{purchase_id}/receive", headers=hdrs)

    r = client.put(f"/admin/purchases/{purchase_id}", json={"quantity": 99}, headers=hdrs)
    assert r.status_code == 400


def test_list_purchases_filters_by_product_and_status(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid1   = str(insert_product(db, cat_id, name="Fish A"))
    pid2   = str(insert_product(db, cat_id, name="Fish B"))

    client.post("/admin/purchases", json={"productId": pid1, "supplierName": "S", "unitCost": 10.0, "quantity": 5}, headers=hdrs)
    p2 = client.post("/admin/purchases", json={"productId": pid2, "supplierName": "S", "unitCost": 10.0, "quantity": 5}, headers=hdrs).json()["data"]["id"]
    client.put(f"/admin/purchases/{p2}/receive", headers=hdrs)

    r = client.get(f"/admin/purchases?productId={pid1}", headers=hdrs)
    assert r.json()["total"] == 1

    r = client.get("/admin/purchases?status=received", headers=hdrs)
    assert r.json()["total"] == 1
    assert r.json()["data"][0]["productId"] == pid2
