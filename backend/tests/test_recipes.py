"""
Recipe endpoint tests.

Covers: public listing (pagination, filters, search), public detail (product
recommendations + related recipes), filters endpoint, admin CRUD, duplicate
guard, bulk-import, and access control.
"""

from bson import ObjectId

from tests.conftest import insert_user, insert_category, insert_product, get_token, bearer


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _customer_headers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    return bearer(token)


def _recipe_payload(**overrides):
    payload = {
        "title": "Garlic Butter Salmon",
        "description": "Perfectly seared salmon with a rich garlic butter sauce.",
        "cuisine": "Continental",
        "category": "seafood",
        "ingredients": ["2 salmon fillets", "3 tbsp butter", "4 cloves garlic"],
        "steps": ["Season the salmon.", "Sear in butter.", "Baste with garlic butter."],
        "prep_time_minutes": 5,
        "cook_time_minutes": 10,
        "difficulty": "Easy",
        "servings": 2,
        "tags": ["quick", "keto"],
        "product_tags": ["salmon"],
    }
    payload.update(overrides)
    return payload


def _insert_recipe(db, **overrides):
    from datetime import datetime, timezone
    from app.services.recipe_service import _slugify

    title = overrides.pop("title", "Garlic Butter Salmon")
    now = datetime.now(timezone.utc)
    doc = {
        "title": title,
        "slug": overrides.pop("slug", _slugify(title)),
        "description": "A great recipe.",
        "cuisine": "Continental",
        "category": "seafood",
        "ingredients": ["ingredient 1"],
        "steps": ["step 1"],
        "prep_time_minutes": 5,
        "cook_time_minutes": 10,
        "difficulty": "Easy",
        "servings": 2,
        "emoji": "🍽️",
        "tags": [],
        "product_tags": [],
        "search_keywords": [],
        "is_published": True,
        "created_at": now,
        "updated_at": now,
    }
    doc.update(overrides)
    result = db.recipes.insert_one(doc)
    return result.inserted_id


# ─── Public listing ────────────────────────────────────────────────────────────

def test_list_recipes_empty(client, db):
    r = client.get("/recipes")
    assert r.status_code == 200
    assert r.json()["data"] == []
    assert r.json()["total"] == 0


def test_list_recipes_excludes_unpublished(client, db):
    _insert_recipe(db, title="Published Recipe", is_published=True)
    _insert_recipe(db, title="Draft Recipe", is_published=False)

    r = client.get("/recipes")
    titles = [x["title"] for x in r.json()["data"]]
    assert titles == ["Published Recipe"]


def test_list_recipes_paginates(client, db):
    for i in range(5):
        _insert_recipe(db, title=f"Recipe {i}")

    r = client.get("/recipes", params={"page": 1, "limit": 2})
    body = r.json()
    assert len(body["data"]) == 2
    assert body["total"] == 5
    assert body["totalPages"] == 3


def test_list_recipes_filters_by_cuisine(client, db):
    _insert_recipe(db, title="Japanese Dish", cuisine="Japanese")
    _insert_recipe(db, title="Indian Dish", cuisine="Indian")

    r = client.get("/recipes", params={"cuisine": "Japanese"})
    titles = [x["title"] for x in r.json()["data"]]
    assert titles == ["Japanese Dish"]


def test_list_recipes_filters_by_category(client, db):
    _insert_recipe(db, title="Salmon Curry", category="curry")
    _insert_recipe(db, title="Salmon Soup", category="soup")

    r = client.get("/recipes", params={"category": "curry"})
    titles = [x["title"] for x in r.json()["data"]]
    assert titles == ["Salmon Curry"]


def test_list_recipes_filters_by_difficulty(client, db):
    _insert_recipe(db, title="Easy One", difficulty="Easy")
    _insert_recipe(db, title="Hard One", difficulty="Hard")

    r = client.get("/recipes", params={"difficulty": "Hard"})
    titles = [x["title"] for x in r.json()["data"]]
    assert titles == ["Hard One"]


def test_list_recipes_search(client, db):
    _insert_recipe(db, title="Miso Glazed Salmon", search_keywords=["miso", "glaze"])
    _insert_recipe(db, title="Chilli Garlic Prawns", search_keywords=["spicy", "prawns"])

    r = client.get("/recipes", params={"search": "miso"})
    titles = [x["title"] for x in r.json()["data"]]
    assert titles == ["Miso Glazed Salmon"]


def test_get_filters_returns_distinct_values(client, db):
    _insert_recipe(db, title="A", cuisine="Japanese", category="seafood")
    _insert_recipe(db, title="B", cuisine="Indian", category="curry")
    _insert_recipe(db, title="C", cuisine="Japanese", category="seafood")

    r = client.get("/recipes/filters")
    data = r.json()["data"]
    assert sorted(data["cuisines"]) == ["Indian", "Japanese"]
    assert sorted(data["categories"]) == ["curry", "seafood"]


# ─── Public detail ─────────────────────────────────────────────────────────────

def test_get_recipe_by_slug_not_found(client, db):
    r = client.get("/recipes/does-not-exist")
    assert r.status_code == 404


def test_get_recipe_by_slug_excludes_unpublished(client, db):
    _insert_recipe(db, title="Secret Draft", slug="secret-draft", is_published=False)
    r = client.get("/recipes/secret-draft")
    assert r.status_code == 404


def test_get_recipe_by_slug_returns_full_detail(client, db):
    _insert_recipe(
        db, title="Garlic Butter Salmon", slug="garlic-butter-salmon",
        ingredients=["2 salmon fillets", "butter"], steps=["Sear", "Baste"],
        prep_time_minutes=5, cook_time_minutes=10, servings=2,
    )
    r = client.get("/recipes/garlic-butter-salmon")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["title"] == "Garlic Butter Salmon"
    assert data["ingredients"] == ["2 salmon fillets", "butter"]
    assert data["totalTimeMinutes"] == 15
    assert "recommendedProducts" in data
    assert "relatedRecipes" in data


def test_get_recipe_recommends_matching_real_products(client, db):
    cat_id = insert_category(db)
    insert_product(db, cat_id, name="Norwegian Atlantic Salmon Fillet")
    _insert_recipe(
        db, title="Garlic Butter Salmon", slug="garlic-butter-salmon",
        product_tags=["salmon", "norwegian"],
    )

    r = client.get("/recipes/garlic-butter-salmon")
    products = r.json()["data"]["recommendedProducts"]
    assert len(products) == 1
    assert products[0]["name"] == "Norwegian Atlantic Salmon Fillet"


def test_get_recipe_returns_related_recipes_by_shared_cuisine(client, db):
    _insert_recipe(db, title="Miso Salmon", slug="miso-salmon", cuisine="Japanese", category="seafood")
    _insert_recipe(db, title="Teriyaki Chicken", slug="teriyaki-chicken", cuisine="Japanese", category="grilled")
    _insert_recipe(db, title="Butter Chicken", slug="butter-chicken", cuisine="Indian", category="curry")

    r = client.get("/recipes/miso-salmon")
    related_titles = [x["title"] for x in r.json()["data"]["relatedRecipes"]]
    assert "Teriyaki Chicken" in related_titles
    assert "Butter Chicken" not in related_titles


# ─── Admin access control ──────────────────────────────────────────────────────

def test_admin_recipe_endpoints_block_customers(client, db):
    hdrs = _customer_headers(client, db)
    assert client.get("/admin/recipes", headers=hdrs).status_code == 403
    assert client.post("/admin/recipes", json=_recipe_payload(), headers=hdrs).status_code == 403


def test_admin_recipe_endpoints_block_anonymous(client):
    assert client.get("/admin/recipes").status_code == 401
    assert client.post("/admin/recipes", json=_recipe_payload()).status_code == 401


# ─── Admin CRUD ─────────────────────────────────────────────────────────────────

def test_admin_create_recipe(client, db):
    hdrs = _admin_headers(client, db)
    r = client.post("/admin/recipes", json=_recipe_payload(), headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["title"] == "Garlic Butter Salmon"
    assert data["slug"] == "garlic-butter-salmon"
    assert data["isPublished"] is True


def test_admin_create_recipe_auto_generates_unique_slug_on_duplicate_title_attempt(client, db):
    hdrs = _admin_headers(client, db)
    r1 = client.post("/admin/recipes", json=_recipe_payload(title="Salmon Delight"), headers=hdrs)
    assert r1.status_code == 200

    # Same title again must be rejected outright (duplicate-recipe guard),
    # not silently create a second recipe with a "-1" slug.
    r2 = client.post("/admin/recipes", json=_recipe_payload(title="Salmon Delight"), headers=hdrs)
    assert r2.status_code == 409
    assert db.recipes.count_documents({"title": "Salmon Delight"}) == 1


def test_admin_create_recipe_rejects_duplicate_title_case_insensitively(client, db):
    hdrs = _admin_headers(client, db)
    client.post("/admin/recipes", json=_recipe_payload(title="Miso Salmon"), headers=hdrs)
    r = client.post("/admin/recipes", json=_recipe_payload(title="miso salmon"), headers=hdrs)
    assert r.status_code == 409


def test_admin_list_recipes_includes_drafts(client, db):
    hdrs = _admin_headers(client, db)
    _insert_recipe(db, title="Published", is_published=True)
    _insert_recipe(db, title="Draft", is_published=False)

    r = client.get("/admin/recipes", headers=hdrs)
    titles = [x["title"] for x in r.json()["data"]]
    assert "Published" in titles
    assert "Draft" in titles


def test_admin_list_recipes_filters_by_is_published(client, db):
    hdrs = _admin_headers(client, db)
    _insert_recipe(db, title="Published", is_published=True)
    _insert_recipe(db, title="Draft", is_published=False)

    r = client.get("/admin/recipes", params={"isPublished": "false"}, headers=hdrs)
    titles = [x["title"] for x in r.json()["data"]]
    assert titles == ["Draft"]


def test_admin_update_recipe(client, db):
    hdrs = _admin_headers(client, db)
    rid = str(_insert_recipe(db, title="Old Title", slug="old-title"))

    r = client.put(f"/admin/recipes/{rid}", json={"title": "New Title", "difficulty": "Hard"}, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["title"] == "New Title"
    assert data["difficulty"] == "Hard"
    # Slug is intentionally left untouched — changing a live recipe's URL
    # silently would break existing links/SEO.
    assert data["slug"] == "old-title"


def test_admin_update_nonexistent_recipe(client, db):
    hdrs = _admin_headers(client, db)
    fake_id = str(ObjectId())
    r = client.put(f"/admin/recipes/{fake_id}", json={"title": "New Title"}, headers=hdrs)
    assert r.status_code == 404


def test_admin_delete_recipe(client, db):
    hdrs = _admin_headers(client, db)
    rid = str(_insert_recipe(db))

    del_r = client.delete(f"/admin/recipes/{rid}", headers=hdrs)
    assert del_r.status_code == 200
    assert db.recipes.count_documents({}) == 0


def test_admin_delete_nonexistent_recipe(client, db):
    hdrs = _admin_headers(client, db)
    fake_id = str(ObjectId())
    r = client.delete(f"/admin/recipes/{fake_id}", headers=hdrs)
    assert r.status_code == 404


# ─── Bulk import ────────────────────────────────────────────────────────────────

def test_admin_bulk_import_creates_many_recipes(client, db):
    hdrs = _admin_headers(client, db)
    r = client.post("/admin/recipes/bulk-import", json={
        "recipes": [_recipe_payload(title="Recipe A"), _recipe_payload(title="Recipe B")],
    }, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["created"] == 2
    assert data["skipped"] == 0
    assert db.recipes.count_documents({}) == 2


def test_admin_bulk_import_skips_existing_titles_instead_of_erroring(client, db):
    hdrs = _admin_headers(client, db)
    _insert_recipe(db, title="Recipe A")

    r = client.post("/admin/recipes/bulk-import", json={
        "recipes": [_recipe_payload(title="Recipe A"), _recipe_payload(title="Recipe C")],
    }, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["created"] == 1
    assert data["skipped"] == 1
    assert db.recipes.count_documents({}) == 2


def test_admin_bulk_import_blocks_customers(client, db):
    hdrs = _customer_headers(client, db)
    r = client.post("/admin/recipes/bulk-import", json={"recipes": [_recipe_payload()]}, headers=hdrs)
    assert r.status_code == 403
