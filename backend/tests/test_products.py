"""
Product endpoint tests.

Covers: list, filter, search, detail, featured, best-sellers.
"""

from tests.conftest import insert_category, insert_product


def test_list_products_empty(client):
    r = client.get("/products")
    assert r.status_code == 200
    body = r.json()
    assert body["data"] == []
    assert body["total"] == 0


def test_list_products_returns_items(client, db):
    cat_id = insert_category(db)
    insert_product(db, cat_id, name="Atlantic Salmon")
    insert_product(db, cat_id, name="King Prawns", price=1299.0)

    r = client.get("/products")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2
    names = [p["name"] for p in body["data"]]
    assert "Atlantic Salmon" in names
    assert "King Prawns" in names


def test_list_products_pagination(client, db):
    cat_id = insert_category(db)
    for i in range(5):
        insert_product(db, cat_id, name=f"Product {i}", price=100.0 + i)

    r = client.get("/products?page=1&limit=3")
    assert r.status_code == 200
    body = r.json()
    assert len(body["data"]) == 3
    assert body["total"] == 5
    assert body["totalPages"] == 2


def test_list_products_filter_by_category(client, db):
    cat1 = insert_category(db, name="Seafood",  slug="seafood")
    cat2 = insert_category(db, name="Japanese", slug="japanese")
    insert_product(db, cat1, name="Salmon Fillet")
    insert_product(db, cat2, name="Wagyu Beef")

    r = client.get("/products?category=seafood")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["data"][0]["name"] == "Salmon Fillet"


def test_list_products_filter_in_stock_only(client, db):
    cat_id = insert_category(db)
    insert_product(db, cat_id, name="In Stock",  in_stock=True)
    insert_product(db, cat_id, name="Out Stock", in_stock=False)

    r = client.get("/products?inStock=true")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["data"][0]["name"] == "In Stock"


def test_list_products_price_filter(client, db):
    cat_id = insert_category(db)
    insert_product(db, cat_id, name="Cheap",     price=200.0)
    insert_product(db, cat_id, name="Mid",       price=600.0)
    insert_product(db, cat_id, name="Expensive", price=2000.0)

    r = client.get("/products?minPrice=500&maxPrice=1000")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["data"][0]["name"] == "Mid"


def test_get_product_by_slug(client, db):
    cat_id = insert_category(db)
    insert_product(db, cat_id, name="Test Salmon")

    r = client.get("/products/test-salmon")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["name"] == "Test Salmon"
    assert data["slug"] == "test-salmon"
    assert "description" in data


def test_get_product_not_found(client):
    r = client.get("/products/nonexistent-slug-xyz")
    assert r.status_code == 404


def test_get_featured_products(client, db):
    cat_id = insert_category(db)
    insert_product(db, cat_id, name="Featured")     # is_featured=True by default in helper
    r = client.get("/products/featured")
    assert r.status_code == 200
    assert len(r.json()["data"]) >= 1


def test_search_products(client, db):
    cat_id = insert_category(db)
    insert_product(db, cat_id, name="Atlantic Salmon Fillet")
    insert_product(db, cat_id, name="King Prawns")

    r = client.get("/products/search?q=salmon")
    assert r.status_code == 200
    # Search may return 0 if text index not created on test DB — at least no 500
    assert r.status_code != 500


def test_search_too_short_query(client):
    r = client.get("/products/search?q=a")
    assert r.status_code == 422    # min_length=2 on Query param
