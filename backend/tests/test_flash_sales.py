"""Flash sales endpoint tests — active sale window, stock, and sort order."""

from datetime import datetime, timedelta, timezone

from tests.conftest import insert_category, insert_product, insert_user, get_token, bearer


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _make_sale(db, cat_id, name, hours_until_end, in_stock=True, sale_price=799.0):
    pid = insert_product(db, cat_id, name=name, price=999.0, in_stock=in_stock)
    db.products.update_one({"_id": pid}, {"$set": {
        "sale_price":   sale_price,
        "sale_ends_at": datetime.now(timezone.utc) + timedelta(hours=hours_until_end),
    }})
    return pid


def test_list_flash_sales_empty(client, db):
    r = client.get("/flash-sales")
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_list_flash_sales_active_only(client, db):
    cat_id = insert_category(db)
    _make_sale(db, cat_id, "Active Sale", hours_until_end=2)
    _make_sale(db, cat_id, "Expired Sale", hours_until_end=-2)

    r = client.get("/flash-sales")
    names = [p["name"] for p in r.json()["data"]]
    assert names == ["Active Sale"]


def test_list_flash_sales_excludes_out_of_stock(client, db):
    cat_id = insert_category(db)
    _make_sale(db, cat_id, "In Stock Sale", hours_until_end=2, in_stock=True)
    _make_sale(db, cat_id, "Out of Stock Sale", hours_until_end=2, in_stock=False)

    r = client.get("/flash-sales")
    names = [p["name"] for p in r.json()["data"]]
    assert names == ["In Stock Sale"]


def test_list_flash_sales_sorted_by_soonest_ending(client, db):
    cat_id = insert_category(db)
    _make_sale(db, cat_id, "Ends Later", hours_until_end=10)
    _make_sale(db, cat_id, "Ends Soon", hours_until_end=1)

    r = client.get("/flash-sales")
    names = [p["name"] for p in r.json()["data"]]
    assert names == ["Ends Soon", "Ends Later"]


def test_flash_sale_item_shape(client, db):
    cat_id = insert_category(db)
    _make_sale(db, cat_id, "Salmon Deal", hours_until_end=5, sale_price=699.0)

    item = client.get("/flash-sales").json()["data"][0]
    assert item["price"]     == 999.0
    assert item["salePrice"] == 699.0
    assert item["saleEndsAt"] is not None


# ─── Admin: set / clear flash sale on a product ────────────────────────────────

def test_admin_set_flash_sale(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, price=999.0)

    r = client.put(f"/admin/products/{pid}/flash-sale", json={
        "salePrice": 799.0,
        "saleEndsAt": (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat(),
    }, headers=hdrs)
    assert r.status_code == 200

    product = db.products.find_one({"_id": pid})
    assert product["sale_price"] == 799.0
    assert product["sale_ends_at"] is not None


def test_admin_clear_flash_sale(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = _make_sale(db, cat_id, "On Sale", hours_until_end=2)

    r = client.put(f"/admin/products/{pid}/flash-sale", json={}, headers=hdrs)
    assert r.status_code == 200

    product = db.products.find_one({"_id": pid})
    assert "sale_price" not in product
    assert "sale_ends_at" not in product


def test_admin_flash_sale_requires_admin(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id)

    r = client.put(f"/admin/products/{pid}/flash-sale", json={"salePrice": 500.0}, headers=bearer(token))
    assert r.status_code == 403
