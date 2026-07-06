"""
Sales analytics extension tests — sales-by-period, estimated profit, best/worst
sellers, fast/slow movers, most/least viewed, top/returning customers, abandoned orders.
"""

from datetime import datetime, timedelta, timezone

from tests.conftest import insert_user, insert_category, insert_product, insert_order, get_token, bearer


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _analytics(client, hdrs):
    return client.get("/admin/analytics", headers=hdrs).json()["data"]


def test_sales_summary_buckets_orders_by_period(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)

    now = datetime.now(timezone.utc)
    insert_order(db, uid, pid, payment_status="paid", created_at=now, total=100.0)
    insert_order(db, uid, pid, payment_status="paid", created_at=now - timedelta(days=1), total=200.0)
    insert_order(db, uid, pid, payment_status="paid", created_at=now - timedelta(days=400), total=300.0)  # last year

    data = _analytics(client, hdrs)
    summary = data["salesSummary"]
    assert summary["today"]["revenue"] == 100.0
    assert summary["today"]["orders"] == 1
    assert summary["yesterday"]["revenue"] == 200.0
    assert summary["allTime"]["revenue"] == 600.0
    assert summary["allTime"]["orders"] == 3
    assert summary["thisYear"]["revenue"] == 300.0  # excludes the 400-days-ago order


def test_estimated_profit_uses_received_purchase_cost(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust@test.com")
    cat_id = insert_category(db)
    pid    = client.post("/admin/products", json={
        "name": "Cod", "categoryId": str(cat_id), "price": 500.0, "stockQuantity": 50,
    }, headers=hdrs).json()["data"]["id"]

    purchase_id = client.post("/admin/purchases", json={
        "productId": pid, "supplierName": "S", "unitCost": 200.0, "quantity": 10,
    }, headers=hdrs).json()["data"]["id"]
    client.put(f"/admin/purchases/{purchase_id}/receive", headers=hdrs)

    from bson import ObjectId
    insert_order(db, uid, ObjectId(pid), payment_status="paid", total=500.0, quantity=1)

    data = _analytics(client, hdrs)
    profit = data["estimatedProfit"]
    assert profit["totalRevenue"] == 999.0  # insert_order hardcodes item price 999.0 regardless of `total`
    assert profit["estimatedCost"] == 200.0  # 1 unit * avg cost 200
    assert profit["estimatedProfit"] == 799.0
    assert profit["productsWithCostData"] == 1


def test_estimated_profit_zero_when_no_purchase_data(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid, payment_status="paid")

    data = _analytics(client, hdrs)
    profit = data["estimatedProfit"]
    assert profit["estimatedCost"] == 0.0
    assert profit["productsWithCostData"] == 0
    assert profit["estimatedProfit"] == profit["totalRevenue"]


def test_worst_sellers_includes_zero_sale_products(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust@test.com")
    cat_id = insert_category(db)
    sold_pid   = insert_product(db, cat_id, name="Popular Fish")
    unsold_pid = insert_product(db, cat_id, name="Unsold Fish")
    insert_order(db, uid, sold_pid, payment_status="paid", quantity=5)

    data = _analytics(client, hdrs)
    names = [w["name"] for w in data["worstSellers"]]
    assert "Unsold Fish" in names
    unsold_entry = next(w for w in data["worstSellers"] if w["name"] == "Unsold Fish")
    assert unsold_entry["units"] == 0


def test_most_and_least_viewed_products(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    client.post("/admin/products", json={"name": "Viewed A Lot", "categoryId": str(cat_id), "price": 100.0}, headers=hdrs)
    popular_slug = "viewed-a-lot"
    client.post("/admin/products", json={"name": "Never Viewed", "categoryId": str(cat_id), "price": 100.0}, headers=hdrs)

    for _ in range(3):
        client.get(f"/products/{popular_slug}")

    data = _analytics(client, hdrs)
    most = {v["name"]: v["views"] for v in data["mostViewed"]}
    assert most["Viewed A Lot"] == 3
    least = {v["name"]: v["views"] for v in data["leastViewed"]}
    assert least["Never Viewed"] == 0


def test_top_customers_and_returning_customers(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)

    uid1 = insert_user(db, email="big-spender@test.com", name="Big Spender")
    uid2 = insert_user(db, email="one-timer@test.com", name="One Timer")

    insert_order(db, uid1, pid, payment_status="paid", total=1000.0)
    insert_order(db, uid1, pid, payment_status="paid", total=1000.0)  # 2nd order → returning
    insert_order(db, uid2, pid, payment_status="paid", total=100.0)

    data = _analytics(client, hdrs)
    assert data["topCustomers"][0]["name"] == "Big Spender"
    assert data["topCustomers"][0]["totalSpent"] == 2000.0
    assert data["topCustomers"][0]["orderCount"] == 2
    # 1 of 2 customers has 2+ orders → 50%
    assert data["returningCustomersPct"] == 50.0


def test_abandoned_orders_counts_stale_unpaid_pending(client, db):
    hdrs   = _admin_headers(client, db)
    uid    = insert_user(db, email="cust@test.com")
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)

    old = datetime.now(timezone.utc) - timedelta(hours=48)
    insert_order(db, uid, pid, status="pending", payment_status="pending", created_at=old)
    insert_order(db, uid, pid, status="pending", payment_status="pending")  # recent, not abandoned
    insert_order(db, uid, pid, status="confirmed", payment_status="paid", created_at=old)  # paid, not abandoned

    data = _analytics(client, hdrs)
    assert data["abandonedOrders"] == 1


def test_product_view_count_increments_on_detail_fetch(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    r = client.post("/admin/products", json={"name": "Trackable Fish", "categoryId": str(cat_id), "price": 100.0}, headers=hdrs)
    pid = r.json()["data"]["id"]
    assert r.json()["data"]["viewCount"] == 0

    client.get("/products/trackable-fish")
    client.get("/products/trackable-fish")

    products = client.get("/admin/products?search=Trackable", headers=hdrs).json()["data"]
    assert products[0]["viewCount"] == 2
