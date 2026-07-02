"""
Auth endpoint tests.

Auth endpoints return a Pydantic TokenResponse directly — no {"data":...} envelope.
Response shape: {"access_token": "...", "refresh_token": "...", "token_type": "bearer", "user": {...}}
Duplicate email → 409 CONFLICT (not 400).
"""

from tests.conftest import insert_user, get_token, bearer


# ─── Register ─────────────────────────────────────────────────────────────────

def test_register_success(client):
    r = client.post("/auth/register", json={
        "name":     "Priya Sharma",
        "email":    "priya@test.com",
        "password": "Test1234!",
        "phone":    "9876543210",
    })
    assert r.status_code == 201
    body = r.json()
    # TokenResponse shape — no {"data":...} wrapper
    assert "access_token"  in body
    assert "refresh_token" in body
    assert body["user"]["email"] == "priya@test.com"
    assert body["user"]["role"]  == "customer"
    # Security: password must never appear in any response field
    assert "password"      not in str(body)
    assert "password_hash" not in str(body)


def test_register_duplicate_email(client):
    payload = {"name": "Ab", "email": "dup@test.com", "password": "Test1234!", "phone": "9999999999"}
    client.post("/auth/register", json=payload)
    r = client.post("/auth/register", json=payload)
    assert r.status_code in (400, 409)          # implementation uses 409 CONFLICT
    assert "already" in r.json()["detail"].lower()


def test_register_weak_password(client):
    r = client.post("/auth/register", json={
        "name":     "B",
        "email":    "b@test.com",
        "password": "123",          # too short (min_length=8)
        "phone":    "9999999999",
    })
    assert r.status_code == 422                 # Pydantic validation


# ─── Login ────────────────────────────────────────────────────────────────────

def test_login_success(client, db):
    insert_user(db, email="login@test.com")
    r = client.post("/auth/login", json={"email": "login@test.com", "password": "Test1234!"})
    assert r.status_code == 200
    body = r.json()
    assert "access_token"  in body
    assert "refresh_token" in body
    assert body["user"]["email"] == "login@test.com"


def test_login_wrong_password(client, db):
    insert_user(db, email="wrong@test.com")
    r = client.post("/auth/login", json={"email": "wrong@test.com", "password": "BadPass!"})
    assert r.status_code == 401


def test_login_unknown_email(client):
    r = client.post("/auth/login", json={"email": "nobody@test.com", "password": "Test1234!"})
    assert r.status_code == 401


# ─── Protected routes ─────────────────────────────────────────────────────────

def test_protected_route_no_token(client):
    r = client.get("/orders")
    assert r.status_code == 401


def test_protected_route_with_token(client, db):
    insert_user(db)
    token = get_token(client, "user@test.com")
    r = client.get("/orders", headers=bearer(token))
    assert r.status_code == 200


def test_admin_route_blocked_for_customer(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    r = client.get("/admin/stats", headers=bearer(token))
    assert r.status_code == 403


def test_admin_route_allowed_for_admin(client, db):
    insert_user(db, email="admin@test.com", role="admin")
    token = get_token(client, "admin@test.com")
    r = client.get("/admin/stats", headers=bearer(token))
    assert r.status_code == 200
