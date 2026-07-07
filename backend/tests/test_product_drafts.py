"""
Draft products (is_published=False) — admin-only, invisible to every public
product-facing query. Missing the field entirely (pre-existing products
created before this feature) must still be treated as published.
"""

from tests.conftest import insert_category, insert_product, insert_user, get_token, bearer


def test_draft_product_hidden_from_public_list(client, db):
    category_id = insert_category(db)
    insert_product(db, category_id, name="Live Salmon", is_published=True)
    insert_product(db, category_id, name="Draft Salmon", is_published=False)

    r = client.get("/products")
    assert r.status_code == 200
    names = [p["name"] for p in r.json()["data"]]
    assert "Live Salmon" in names
    assert "Draft Salmon" not in names


def test_draft_product_404s_on_direct_slug_lookup(client, db):
    category_id = insert_category(db)
    insert_product(db, category_id, name="Draft Salmon", is_published=False)

    r = client.get("/products/draft-salmon")
    assert r.status_code == 404


def test_product_missing_is_published_field_treated_as_published(client, db):
    """Backward compatibility: products created before this feature existed
    have no is_published field at all and must still show up publicly."""
    category_id = insert_category(db)
    result = db.products.insert_one({
        "name": "Legacy Product", "slug": "legacy-product", "price": 500.0,
        "category_id": category_id, "images": [], "in_stock": True,
        "stock_quantity": 10, "rating": 0.0, "review_count": 0,
        "tags": [], "is_featured": False, "is_best_seller": False,
        "description": "", "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    })

    r = client.get("/products")
    names = [p["name"] for p in r.json()["data"]]
    assert "Legacy Product" in names


def test_draft_product_still_visible_in_admin_list(client, db):
    category_id = insert_category(db)
    insert_product(db, category_id, name="Draft Salmon", is_published=False)
    insert_user(db, email="admin@test.com", role="admin")
    token = get_token(client, "admin@test.com")

    r = client.get("/admin/products", headers=bearer(token))
    names = [p["name"] for p in r.json()["data"]]
    assert "Draft Salmon" in names
    draft = next(p for p in r.json()["data"] if p["name"] == "Draft Salmon")
    assert draft["isPublished"] is False


def test_admin_can_create_product_as_draft(client, db):
    category_id = insert_category(db)
    insert_user(db, email="admin@test.com", role="admin")
    token = get_token(client, "admin@test.com")

    r = client.post("/admin/products", json={
        "name": "New Draft Product",
        "categoryId": str(category_id),
        "price": 0,
        "isPublished": False,
    }, headers=bearer(token))
    assert r.status_code in (200, 201)
    assert r.json()["data"]["isPublished"] is False

    public = client.get("/products")
    assert "New Draft Product" not in [p["name"] for p in public.json()["data"]]


def test_admin_can_publish_a_draft(client, db):
    category_id = insert_category(db)
    product_id = insert_product(db, category_id, name="Draft Salmon", is_published=False)
    insert_user(db, email="admin@test.com", role="admin")
    token = get_token(client, "admin@test.com")

    r = client.put(f"/admin/products/{product_id}", json={"isPublished": True}, headers=bearer(token))
    assert r.status_code == 200
    assert r.json()["data"]["isPublished"] is True

    public = client.get("/products")
    assert "Draft Salmon" in [p["name"] for p in public.json()["data"]]
