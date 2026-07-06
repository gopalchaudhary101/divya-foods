"""Category endpoint tests — public listing and single-category lookup."""

from tests.conftest import insert_category


def test_list_categories_empty(client, db):
    r = client.get("/categories")
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_list_categories_excludes_inactive(client, db):
    insert_category(db, name="Seafood", slug="seafood")
    db.categories.insert_one({
        "name": "Hidden", "slug": "hidden", "is_active": False,
    })

    r = client.get("/categories")
    names = [c["name"] for c in r.json()["data"]]
    assert names == ["Seafood"]


def test_list_categories_sorted_by_order_then_name(client, db):
    db.categories.insert_one({"name": "Zebra", "slug": "zebra", "is_active": True, "order": 1})
    db.categories.insert_one({"name": "Alpha", "slug": "alpha", "is_active": True, "order": 1})
    db.categories.insert_one({"name": "First", "slug": "first", "is_active": True, "order": 0})

    r = client.get("/categories")
    names = [c["name"] for c in r.json()["data"]]
    assert names == ["First", "Alpha", "Zebra"]


def test_get_category_by_slug(client, db):
    insert_category(db, name="Frozen Seafood", slug="frozen-seafood")

    r = client.get("/categories/frozen-seafood")
    assert r.status_code == 200
    assert r.json()["data"]["name"] == "Frozen Seafood"


def test_get_category_not_found(client, db):
    r = client.get("/categories/does-not-exist")
    assert r.status_code == 404


def test_get_inactive_category_not_found(client, db):
    db.categories.insert_one({"name": "Hidden", "slug": "hidden", "is_active": False})
    r = client.get("/categories/hidden")
    assert r.status_code == 404
