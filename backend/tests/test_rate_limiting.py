"""
Rate limiting tests.

Regression coverage for the conftest.py fix: `limiter.reset()` runs in the
autouse `clean` fixture before every test, because slowapi's Limiter is a
process-wide singleton keyed by remote address. TestClient always reports
the same address ("testclient"), so without resetting between tests, hits
accumulate across the whole session and unrelated tests start failing with
429 once the shared counter is exhausted (see conftest.py, `limiter.reset()`).

These tests exercise the limits directly and prove two things:
  1. Each limited endpoint actually enforces its documented limit.
  2. The per-test reset means every test starts with a full allowance,
     regardless of how many requests earlier tests made against the same
     endpoint.
"""

from tests.conftest import insert_user, get_token, bearer


def test_login_enforces_5_per_minute(client, db):
    insert_user(db, email="ratelimit@test.com")
    payload = {"email": "ratelimit@test.com", "password": "Test1234!"}

    for _ in range(5):
        r = client.post("/auth/login", json=payload)
        assert r.status_code == 200

    r = client.post("/auth/login", json=payload)
    assert r.status_code == 429


def test_login_limit_resets_between_tests(client, db):
    """
    If limiter.reset() were missing, this test would inherit the exhausted
    counter from test_login_enforces_5_per_minute above and fail here.
    """
    insert_user(db, email="freshuser@test.com")
    r = client.post("/auth/login", json={"email": "freshuser@test.com", "password": "Test1234!"})
    assert r.status_code == 200


def test_register_enforces_10_per_minute(client, db):
    def _attempt(i):
        return client.post("/auth/register", json={
            "name":     "Rate Limit Test",
            "email":    f"reg{i}@test.com",
            "password": "Test1234!",
            "phone":    "9999999999",
        })

    for i in range(10):
        r = _attempt(i)
        assert r.status_code == 201

    r = _attempt(10)
    assert r.status_code == 429


def test_forgot_password_enforces_3_per_minute(client, db):
    payload = {"email": "nobody@test.com"}

    for _ in range(3):
        r = client.post("/auth/forgot-password", json=payload)
        assert r.status_code == 200

    r = client.post("/auth/forgot-password", json=payload)
    assert r.status_code == 429


def test_forgot_password_limit_resets_between_tests(client, db):
    r = client.post("/auth/forgot-password", json={"email": "someone-else@test.com"})
    assert r.status_code == 200


def test_change_password_enforces_5_per_minute(client, db):
    """
    Regression test: /auth/change-password previously had no rate limit at
    all — unlike /auth/login, it allows unlimited guesses against the current
    password for anyone already holding a stolen/leaked access token.
    """
    insert_user(db, email="changepw@test.com")
    token = get_token(client, "changepw@test.com")
    payload = {"current_password": "WrongPassword!", "new_password": "NewPass1234!"}

    for _ in range(5):
        r = client.post("/auth/change-password", json=payload, headers=bearer(token))
        assert r.status_code == 400   # wrong current password, but not rate-limited yet

    r = client.post("/auth/change-password", json=payload, headers=bearer(token))
    assert r.status_code == 429


def test_bulk_order_request_enforces_5_per_minute(client):
    """
    Regression test: /bulk-orders is intentionally public (like /contact), but
    unlike /contact (5/min) it previously had no rate limit at all — nothing
    stopped a script from flooding the bulk-order-requests collection.
    """
    payload = {
        "company_name": "Ocean Bistro",
        "contact_name": "Priya Shah",
        "email": "priya@oceanbistro.com",
        "phone": "9812345678",
        "items": [{"productName": "Frozen Salmon Fillet", "quantity": 50}],
    }

    for _ in range(5):
        r = client.post("/bulk-orders", json=payload)
        assert r.status_code == 200

    r = client.post("/bulk-orders", json=payload)
    assert r.status_code == 429


def test_chat_enforces_15_per_minute(client):
    """
    Regression test: /chat previously had no rate limit at all, despite calling
    a metered third-party API (Anthropic) per request — every other public,
    cost-bearing endpoint in this app is rate-limited, this one now matches.
    """
    payload = {"messages": [{"role": "user", "content": "Hi"}]}

    for _ in range(15):
        r = client.post("/chat", json=payload)
        assert r.status_code == 200

    r = client.post("/chat", json=payload)
    assert r.status_code == 429
