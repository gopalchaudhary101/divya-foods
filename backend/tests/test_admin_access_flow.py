"""
End-to-end role-based access flow: signup always creates a customer, a
customer is rejected from every admin endpoint, and an admin/developer
account (created the same way scripts/create_admin.py would) can log in
and manage products.
"""

from tests.conftest import insert_user, insert_category, get_token, bearer


def test_public_signup_always_creates_customer(client, db):
    r = client.post("/auth/register", json={
        "name": "New Shopper",
        "email": "shopper@test.com",
        "password": "Test1234!",
        "phone": "9999999999",
    })
    assert r.status_code == 201, r.text
    assert r.json()["user"]["role"] == "customer"

    stored = db.users.find_one({"email": "shopper@test.com"})
    assert stored["role"] == "customer"


def test_signup_payload_cannot_force_a_privileged_role(client, db):
    """Even if a client sends a `role` field, the server ignores it."""
    r = client.post("/auth/register", json={
        "name": "Sneaky",
        "email": "sneaky@test.com",
        "password": "Test1234!",
        "phone": "9999999999",
        "role": "admin",
    })
    assert r.status_code == 201, r.text
    assert r.json()["user"]["role"] == "customer"


def test_customer_cannot_list_admin_products(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")

    r = client.get("/admin/products", headers=bearer(token))
    assert r.status_code == 403


def test_customer_cannot_create_admin_product(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")

    r = client.post("/admin/products", json={"name": "Hacked Product", "price": 1}, headers=bearer(token))
    assert r.status_code == 403


def test_customer_cannot_upload_images(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")

    r = client.post(
        "/upload/image",
        files={"file": ("x.jpg", b"not-a-real-image", "image/jpeg")},
        headers=bearer(token),
    )
    assert r.status_code == 403


def test_admin_account_created_directly_can_log_in_and_manage_products(client, db):
    """Simulates scripts/create_admin.py — a user row inserted straight into
    Mongo with role='admin' (never through /auth/register)."""
    insert_user(db, email="owner@divyafoods.com", role="admin", name="Owner")
    token = get_token(client, "owner@divyafoods.com")
    hdrs = bearer(token)

    category_id = insert_category(db)

    create = client.post("/admin/products", json={
        "name": "Norwegian Salmon Fillet",
        "slug": "norwegian-salmon-fillet-e2e",
        "categoryId": str(category_id),
        "price": 899.0,
        "stockQuantity": 20,
        "images": [],
    }, headers=hdrs)
    assert create.status_code in (200, 201), create.text
    product_id = create.json()["data"]["id"] if "data" in create.json() else create.json()["id"]

    update = client.put(f"/admin/products/{product_id}", json={"price": 949.0}, headers=hdrs)
    assert update.status_code == 200, update.text


def test_developer_account_has_same_admin_access_as_admin(client, db):
    insert_user(db, email="dev@divyafoods.com", role="developer", name="Dev")
    token = get_token(client, "dev@divyafoods.com")

    r = client.get("/admin/products", headers=bearer(token))
    assert r.status_code == 200


def test_driver_cannot_access_admin_products(client, db):
    insert_user(db, email="driver@test.com", role="driver", name="Driver")
    token = get_token(client, "driver@test.com")

    r = client.get("/admin/products", headers=bearer(token))
    assert r.status_code == 403
