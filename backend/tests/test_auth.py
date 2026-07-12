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


# ─── Forgot / Reset Password ──────────────────────────────────────────────────

def test_forgot_password_unknown_email_returns_200(client):
    """Silent success prevents email enumeration — see auth_service.request_password_reset."""
    r = client.post("/auth/forgot-password", json={"email": "nobody@test.com"})
    assert r.status_code == 200


def test_forgot_password_sets_reset_token_for_known_user(client, db):
    insert_user(db, email="hasaccount@test.com")
    r = client.post("/auth/forgot-password", json={"email": "hasaccount@test.com"})
    assert r.status_code == 200

    user_doc = db.users.find_one({"email": "hasaccount@test.com"})
    assert user_doc["reset_token"]
    assert user_doc["reset_token_expires"] is not None


def test_reset_password_success(client, db):
    insert_user(db, email="reset@test.com")
    client.post("/auth/forgot-password", json={"email": "reset@test.com"})
    token = db.users.find_one({"email": "reset@test.com"})["reset_token"]

    r = client.post("/auth/reset-password", json={"token": token, "new_password": "NewPass123!"})
    assert r.status_code == 200

    # Old password no longer works, new one does
    assert client.post("/auth/login", json={"email": "reset@test.com", "password": "Test1234!"}).status_code == 401
    assert client.post("/auth/login", json={"email": "reset@test.com", "password": "NewPass123!"}).status_code == 200

    # Token is single-use
    user_doc = db.users.find_one({"email": "reset@test.com"})
    assert user_doc["reset_token"] is None
    assert user_doc["reset_token_expires"] is None


def test_reset_password_invalid_token(client, db):
    insert_user(db, email="badtoken@test.com")
    r = client.post("/auth/reset-password", json={"token": "not-a-real-token", "new_password": "NewPass123!"})
    assert r.status_code == 400


def test_reset_password_expired_token(client, db):
    from datetime import datetime, timedelta, timezone
    user_id = insert_user(db, email="expired@test.com")
    db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "reset_token": "expired-token-123",
            "reset_token_expires": datetime.now(timezone.utc) - timedelta(hours=1),
        }},
    )
    r = client.post("/auth/reset-password", json={"token": "expired-token-123", "new_password": "NewPass123!"})
    assert r.status_code == 400


def test_reset_password_token_cannot_be_reused(client, db):
    insert_user(db, email="reuse@test.com")
    client.post("/auth/forgot-password", json={"email": "reuse@test.com"})
    token = db.users.find_one({"email": "reuse@test.com"})["reset_token"]

    r1 = client.post("/auth/reset-password", json={"token": token, "new_password": "FirstNew123!"})
    assert r1.status_code == 200

    r2 = client.post("/auth/reset-password", json={"token": token, "new_password": "SecondNew123!"})
    assert r2.status_code == 400


# ─── Verify Email ─────────────────────────────────────────────────────────────

def test_register_creates_unverified_account_with_verification_token(client, db):
    """
    Registration doesn't block on verification (new accounts can order right
    away) but should always leave a verification token in place so the
    customer has a way to confirm their email afterward.
    """
    client.post("/auth/register", json={
        "name": "New User", "email": "newuser@test.com",
        "password": "Test1234!", "phone": "9999999999",
    })
    user_doc = db.users.find_one({"email": "newuser@test.com"})
    assert user_doc["is_email_verified"] is False
    assert user_doc["email_verification_token"]
    assert user_doc["email_verification_token_expires"] is not None


def test_verify_email_success(client, db):
    client.post("/auth/register", json={
        "name": "Verify Me", "email": "verifyme@test.com",
        "password": "Test1234!", "phone": "9999999999",
    })
    token = db.users.find_one({"email": "verifyme@test.com"})["email_verification_token"]

    r = client.post("/auth/verify-email", json={"token": token})
    assert r.status_code == 200

    user_doc = db.users.find_one({"email": "verifyme@test.com"})
    assert user_doc["is_email_verified"] is True
    assert user_doc["email_verification_token"] is None
    assert user_doc["email_verification_token_expires"] is None


def test_verify_email_invalid_token(client, db):
    r = client.post("/auth/verify-email", json={"token": "not-a-real-token"})
    assert r.status_code == 400


def test_verify_email_expired_token(client, db):
    from datetime import datetime, timedelta, timezone
    user_id = insert_user(db, email="expiredverify@test.com")
    db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "email_verification_token": "expired-verify-token",
            "email_verification_token_expires": datetime.now(timezone.utc) - timedelta(hours=1),
        }},
    )
    r = client.post("/auth/verify-email", json={"token": "expired-verify-token"})
    assert r.status_code == 400


def test_verify_email_token_cannot_be_reused(client, db):
    client.post("/auth/register", json={
        "name": "Reuse Verify", "email": "reuseverify@test.com",
        "password": "Test1234!", "phone": "9999999999",
    })
    token = db.users.find_one({"email": "reuseverify@test.com"})["email_verification_token"]

    r1 = client.post("/auth/verify-email", json={"token": token})
    assert r1.status_code == 200

    r2 = client.post("/auth/verify-email", json={"token": token})
    assert r2.status_code == 400


def test_unverified_account_can_still_place_orders(client, db):
    """The whole point of this design: verification is informational only."""
    from tests.conftest import insert_category, insert_product

    client.post("/auth/register", json={
        "name": "Shop Anyway", "email": "shopanyway@test.com",
        "password": "Test1234!", "phone": "9999999999",
    })
    user_doc = db.users.find_one({"email": "shopanyway@test.com"})
    assert user_doc["is_email_verified"] is False

    token = client.post("/auth/login", json={
        "email": "shopanyway@test.com", "password": "Test1234!",
    }).json()["access_token"]

    r = client.get("/orders", headers=bearer(token))
    assert r.status_code == 200   # not blocked by lack of verification
