"""
Admin user management tests — list/search users and change roles between
customer/admin/driver. The 'developer' role must stay completely untouchable
through this surface (no promoting to it, no modifying an existing one).
"""

from bson import ObjectId

from tests.conftest import insert_user, get_token, bearer


def _admin_headers(client, db, email="admin@test.com"):
    if not db.users.find_one({"email": email}):
        insert_user(db, email=email, role="admin", name="Admin")
    token = get_token(client, email)
    return bearer(token)


def test_admin_lists_users(client, db):
    insert_user(db, email="c1@test.com", role="customer", name="Customer One")
    insert_user(db, email="c2@test.com", role="customer", name="Customer Two")
    hdrs = _admin_headers(client, db)

    r = client.get("/admin/users", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["total"] == 3   # 2 customers + the admin itself


def test_admin_searches_users_by_name_or_email(client, db):
    insert_user(db, email="priya@test.com", role="customer", name="Priya Sharma")
    insert_user(db, email="rahul@test.com", role="customer", name="Rahul Verma")
    hdrs = _admin_headers(client, db)

    r = client.get("/admin/users", params={"search": "priya"}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["data"][0]["email"] == "priya@test.com"


def test_admin_filters_users_by_role(client, db):
    insert_user(db, email="c1@test.com", role="customer")
    insert_user(db, email="drv@test.com", role="driver", name="Driver")
    hdrs = _admin_headers(client, db)

    r = client.get("/admin/users", params={"role": "driver"}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["data"][0]["role"] == "driver"


def test_user_list_endpoint_blocks_customers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    r = client.get("/admin/users", headers=bearer(token))
    assert r.status_code == 403


# ─── Role changes ──────────────────────────────────────────────────────────────

def test_admin_promotes_customer_to_admin(client, db):
    uid = insert_user(db, email="cust@test.com", role="customer")
    hdrs = _admin_headers(client, db)

    r = client.put(f"/admin/users/{uid}/role", json={"role": "admin"}, headers=hdrs)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["role"] == "admin"

    stored = db.users.find_one({"_id": uid})
    assert stored["role"] == "admin"


def test_admin_demotes_admin_to_customer(client, db):
    uid = insert_user(db, email="other-admin@test.com", role="admin", name="Other Admin")
    hdrs = _admin_headers(client, db)

    r = client.put(f"/admin/users/{uid}/role", json={"role": "customer"}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["role"] == "customer"


def test_admin_sets_role_to_driver(client, db):
    uid = insert_user(db, email="cust@test.com", role="customer")
    hdrs = _admin_headers(client, db)

    r = client.put(f"/admin/users/{uid}/role", json={"role": "driver"}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["role"] == "driver"


def test_cannot_set_role_to_developer(client, db):
    uid = insert_user(db, email="cust@test.com", role="customer")
    hdrs = _admin_headers(client, db)

    r = client.put(f"/admin/users/{uid}/role", json={"role": "developer"}, headers=hdrs)
    assert r.status_code == 400


def test_cannot_modify_existing_developer_account(client, db):
    uid = insert_user(db, email="dev@test.com", role="developer", name="Dev")
    hdrs = _admin_headers(client, db)

    r = client.put(f"/admin/users/{uid}/role", json={"role": "customer"}, headers=hdrs)
    assert r.status_code == 403


def test_admin_cannot_change_own_role(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    hdrs = bearer(token)
    admin_doc = db.users.find_one({"email": "admin@test.com"})

    r = client.put(f"/admin/users/{admin_doc['_id']}/role", json={"role": "customer"}, headers=hdrs)
    assert r.status_code == 400


def test_role_update_rejects_invalid_role(client, db):
    uid = insert_user(db, email="cust@test.com", role="customer")
    hdrs = _admin_headers(client, db)

    r = client.put(f"/admin/users/{uid}/role", json={"role": "superuser"}, headers=hdrs)
    assert r.status_code == 400


def test_role_update_404_for_missing_user(client, db):
    hdrs = _admin_headers(client, db)
    r = client.put(f"/admin/users/{ObjectId()}/role", json={"role": "admin"}, headers=hdrs)
    assert r.status_code == 404


def test_role_update_blocks_customers(client, db):
    uid = insert_user(db, email="target@test.com", role="customer")
    insert_user(db, email="cust@test.com", role="customer", name="Actor")
    token = get_token(client, "cust@test.com")
    r = client.put(f"/admin/users/{uid}/role", json={"role": "admin"}, headers=bearer(token))
    assert r.status_code == 403


def test_role_change_takes_effect_on_next_request_immediately(client, db):
    """No stale-token window — get_current_user re-reads the role from the DB every request."""
    uid = insert_user(db, email="cust@test.com", role="customer")
    hdrs = _admin_headers(client, db)
    client.put(f"/admin/users/{uid}/role", json={"role": "admin"}, headers=hdrs)

    promoted_token = get_token(client, "cust@test.com")
    r = client.get("/admin/users", headers=bearer(promoted_token))
    assert r.status_code == 200
