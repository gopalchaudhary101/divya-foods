"""
User endpoint tests.

Covers: profile get/update, address CRUD + default-address logic, wishlist.
"""

from bson import ObjectId

from tests.conftest import insert_user, insert_category, insert_product, get_token, bearer

_ADDRESS = {
    "label":         "Home",
    "full_name":     "Test User",
    "phone":         "9999999999",
    "address_line1": "123 Test Street",
    "city":          "Delhi",
    "state":         "Delhi",
    "pincode":       "110001",
    "is_default":    False,
}


def _headers(client, email="user@test.com"):
    token = get_token(client, email)
    return bearer(token)


# ─── Profile ───────────────────────────────────────────────────────────────────

def test_get_profile(client, db):
    insert_user(db, name="Test User")
    hdrs = _headers(client)
    r = client.get("/users/profile", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["name"] == "Test User"


def test_update_profile_name_and_phone(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.put("/users/profile", json={"name": "New Name", "phone": "8888888888"}, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["name"]  == "New Name"
    assert data["phone"] == "8888888888"


def test_update_profile_invalid_phone_rejected(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.put("/users/profile", json={"phone": "abc"}, headers=hdrs)
    assert r.status_code == 422


def test_update_profile_date_of_birth(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.put("/users/profile", json={"date_of_birth": "1995-08-15"}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["date_of_birth"] == "1995-08-15"


def test_update_profile_invalid_date_of_birth_rejected(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.put("/users/profile", json={"date_of_birth": "15-08-1995"}, headers=hdrs)
    assert r.status_code == 422


def test_profile_requires_auth(client):
    r = client.get("/users/profile")
    assert r.status_code == 401


# ─── Addresses ─────────────────────────────────────────────────────────────────

def test_create_and_list_address(client, db):
    insert_user(db)
    hdrs = _headers(client)

    r = client.post("/users/addresses", json=_ADDRESS, headers=hdrs)
    assert r.status_code == 201
    assert r.json()["data"]["city"] == "Delhi"

    r2 = client.get("/users/addresses", headers=hdrs)
    assert len(r2.json()["data"]) == 1


def test_create_address_invalid_pincode_rejected(client, db):
    insert_user(db)
    hdrs = _headers(client)
    bad = {**_ADDRESS, "pincode": "123"}
    r = client.post("/users/addresses", json=bad, headers=hdrs)
    assert r.status_code == 422


def test_creating_default_address_unsets_previous_default(client, db):
    insert_user(db)
    hdrs = _headers(client)

    r1 = client.post("/users/addresses", json={**_ADDRESS, "is_default": True}, headers=hdrs)
    addr1_id = r1.json()["data"]["id"]

    client.post("/users/addresses", json={**_ADDRESS, "label": "Work", "is_default": True}, headers=hdrs)

    addresses = client.get("/users/addresses", headers=hdrs).json()["data"]
    addr1 = next(a for a in addresses if a["id"] == addr1_id)
    assert addr1["isDefault"] is False
    assert sum(1 for a in addresses if a["isDefault"]) == 1


def test_update_address(client, db):
    insert_user(db)
    hdrs = _headers(client)
    aid = client.post("/users/addresses", json=_ADDRESS, headers=hdrs).json()["data"]["id"]

    r = client.put(f"/users/addresses/{aid}", json={**_ADDRESS, "city": "Gurgaon"}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["city"] == "Gurgaon"


def test_update_nonexistent_address(client, db):
    insert_user(db)
    hdrs = _headers(client)
    fake_id = str(ObjectId())
    r = client.put(f"/users/addresses/{fake_id}", json=_ADDRESS, headers=hdrs)
    assert r.status_code == 404


def test_cannot_update_other_users_address(client, db):
    insert_user(db, email="owner@test.com")
    insert_user(db, email="intruder@test.com")

    owner_hdrs = _headers(client, "owner@test.com")
    aid = client.post("/users/addresses", json=_ADDRESS, headers=owner_hdrs).json()["data"]["id"]

    intruder_hdrs = _headers(client, "intruder@test.com")
    r = client.put(f"/users/addresses/{aid}", json=_ADDRESS, headers=intruder_hdrs)
    assert r.status_code == 404


def test_delete_address(client, db):
    insert_user(db)
    hdrs = _headers(client)
    aid = client.post("/users/addresses", json=_ADDRESS, headers=hdrs).json()["data"]["id"]

    del_r = client.delete(f"/users/addresses/{aid}", headers=hdrs)
    assert del_r.status_code == 204

    remaining = client.get("/users/addresses", headers=hdrs).json()["data"]
    assert remaining == []


def test_delete_nonexistent_address(client, db):
    insert_user(db)
    hdrs = _headers(client)
    fake_id = str(ObjectId())
    r = client.delete(f"/users/addresses/{fake_id}", headers=hdrs)
    assert r.status_code == 404


def test_set_default_address(client, db):
    insert_user(db)
    hdrs = _headers(client)
    aid1 = client.post("/users/addresses", json={**_ADDRESS, "is_default": True}, headers=hdrs).json()["data"]["id"]
    aid2 = client.post("/users/addresses", json={**_ADDRESS, "label": "Work"}, headers=hdrs).json()["data"]["id"]

    r = client.put(f"/users/addresses/{aid2}/default", headers=hdrs)
    assert r.status_code == 200

    addresses = client.get("/users/addresses", headers=hdrs).json()["data"]
    by_id = {a["id"]: a for a in addresses}
    assert by_id[aid1]["isDefault"] is False
    assert by_id[aid2]["isDefault"] is True


# ─── Wishlist ──────────────────────────────────────────────────────────────────

def test_get_wishlist_empty(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.get("/users/wishlist", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_add_and_get_wishlist(client, db):
    insert_user(db)
    cat_id = insert_category(db)
    pid = str(insert_product(db, cat_id, name="Salmon"))
    hdrs = _headers(client)

    add_r = client.post("/users/wishlist", json={"product_id": pid}, headers=hdrs)
    assert add_r.status_code == 200

    r = client.get("/users/wishlist", headers=hdrs)
    names = [p["name"] for p in r.json()["data"]]
    assert names == ["Salmon"]


def test_add_to_wishlist_is_idempotent(client, db):
    insert_user(db)
    cat_id = insert_category(db)
    pid = str(insert_product(db, cat_id))
    hdrs = _headers(client)

    client.post("/users/wishlist", json={"product_id": pid}, headers=hdrs)
    client.post("/users/wishlist", json={"product_id": pid}, headers=hdrs)

    r = client.get("/users/wishlist", headers=hdrs)
    assert len(r.json()["data"]) == 1


def test_add_nonexistent_product_to_wishlist(client, db):
    insert_user(db)
    hdrs = _headers(client)
    fake_id = str(ObjectId())
    r = client.post("/users/wishlist", json={"product_id": fake_id}, headers=hdrs)
    assert r.status_code == 404


def test_remove_from_wishlist(client, db):
    insert_user(db)
    cat_id = insert_category(db)
    pid = str(insert_product(db, cat_id))
    hdrs = _headers(client)

    client.post("/users/wishlist", json={"product_id": pid}, headers=hdrs)
    del_r = client.delete(f"/users/wishlist/{pid}", headers=hdrs)
    assert del_r.status_code == 200

    r = client.get("/users/wishlist", headers=hdrs)
    assert r.json()["data"] == []
