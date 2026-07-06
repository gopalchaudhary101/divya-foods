"""
Banner endpoint tests.

Covers: public active-banner listing (homepage carousel) and admin CRUD.
"""

from bson import ObjectId

from tests.conftest import insert_user, get_token, bearer


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _customer_headers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    return bearer(token)


def _insert_banner(db, title="Summer Sale", is_active=True, order=0):
    result = db.banners.insert_one({
        "title":      title,
        "subtitle":   "Up to 50% off",
        "image":      "https://res.cloudinary.com/test/banner.jpg",
        "link":       "/products",
        "is_active":  is_active,
        "order":      order,
    })
    return result.inserted_id


# ─── Public endpoint ──────────────────────────────────────────────────────────

def test_get_active_banners_empty(client, db):
    r = client.get("/banners")
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_get_active_banners_excludes_inactive(client, db):
    _insert_banner(db, title="Active Banner", is_active=True, order=1)
    _insert_banner(db, title="Inactive Banner", is_active=False, order=0)

    r = client.get("/banners")
    assert r.status_code == 200
    titles = [b["title"] for b in r.json()["data"]]
    assert titles == ["Active Banner"]


def test_get_active_banners_sorted_by_order(client, db):
    _insert_banner(db, title="Second", order=2)
    _insert_banner(db, title="First", order=1)

    r = client.get("/banners")
    titles = [b["title"] for b in r.json()["data"]]
    assert titles == ["First", "Second"]


# ─── Admin access control ─────────────────────────────────────────────────────

def test_admin_banner_endpoints_block_customers(client, db):
    hdrs = _customer_headers(client, db)
    assert client.get("/admin/banners", headers=hdrs).status_code == 403
    assert client.post("/admin/banners", json={"title": "x", "image": "y"}, headers=hdrs).status_code == 403


def test_admin_banner_endpoints_block_anonymous(client):
    assert client.get("/admin/banners").status_code == 401


# ─── Admin CRUD ────────────────────────────────────────────────────────────────

def test_admin_create_banner(client, db):
    hdrs = _admin_headers(client, db)
    r = client.post("/admin/banners", json={
        "title":    "Diwali Offer",
        "subtitle": "Festive discounts",
        "image":    "https://res.cloudinary.com/test/diwali.jpg",
        "link":     "/offers",
        "isActive": True,
        "order":    1,
    }, headers=hdrs)

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["title"]    == "Diwali Offer"
    assert data["isActive"] is True
    assert data["order"]    == 1
    assert "id" in data


def test_admin_list_banners_includes_inactive(client, db):
    hdrs = _admin_headers(client, db)
    _insert_banner(db, title="Active", is_active=True)
    _insert_banner(db, title="Inactive", is_active=False)

    r = client.get("/admin/banners", headers=hdrs)
    assert r.status_code == 200
    titles = [b["title"] for b in r.json()["data"]]
    assert "Active" in titles
    assert "Inactive" in titles


def test_admin_update_banner(client, db):
    hdrs = _admin_headers(client, db)
    bid = str(_insert_banner(db, title="Old Title"))

    r = client.put(f"/admin/banners/{bid}", json={
        "title":    "New Title",
        "image":    "https://res.cloudinary.com/test/new.jpg",
        "isActive": False,
        "order":    5,
    }, headers=hdrs)

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["title"]    == "New Title"
    assert data["isActive"] is False
    assert data["order"]    == 5


def test_admin_update_nonexistent_banner(client, db):
    hdrs = _admin_headers(client, db)
    fake_id = str(ObjectId())
    r = client.put(f"/admin/banners/{fake_id}", json={
        "title": "x", "image": "y",
    }, headers=hdrs)
    assert r.status_code == 404


def test_admin_delete_banner(client, db):
    hdrs = _admin_headers(client, db)
    bid = str(_insert_banner(db))

    del_r = client.delete(f"/admin/banners/{bid}", headers=hdrs)
    assert del_r.status_code == 200

    list_r = client.get("/admin/banners", headers=hdrs)
    ids = [b["id"] for b in list_r.json()["data"]]
    assert bid not in ids


def test_admin_delete_nonexistent_banner(client, db):
    hdrs = _admin_headers(client, db)
    fake_id = str(ObjectId())
    r = client.delete(f"/admin/banners/{fake_id}", headers=hdrs)
    assert r.status_code == 404
