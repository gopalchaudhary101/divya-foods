"""
App-level tests: docs exposure and health check.

Regression coverage for gating Swagger/ReDoc behind DEBUG — the full OpenAPI
schema (every route, every field name) is reconnaissance material and has no
reason to be public once the app is in a real deployment. docs_url/redoc_url
are fixed at app-construction time (they're read from settings.DEBUG once,
at import), so these tests assert the app was actually wired up to follow
whatever DEBUG resolves to in this environment, rather than assuming a fixed
value — the contract ("docs exist only when DEBUG is on") is what matters,
and the config default (DEBUG=False, app/config.py) is what production runs.
"""
from app.config import settings
from app.main import app as fastapi_app


def test_docs_url_is_wired_to_the_debug_setting():
    expected = "/docs" if settings.DEBUG else None
    assert fastapi_app.docs_url == expected
    expected_redoc = "/redoc" if settings.DEBUG else None
    assert fastapi_app.redoc_url == expected_redoc
    expected_openapi = "/openapi.json" if settings.DEBUG else None
    assert fastapi_app.openapi_url == expected_openapi


def test_docs_http_status_matches_the_debug_setting(client):
    expected_status = 200 if settings.DEBUG else 404
    assert client.get("/docs").status_code == expected_status
    assert client.get("/redoc").status_code == expected_status
    assert client.get("/openapi.json").status_code == expected_status


def test_health_check_still_public(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] in ("healthy", "degraded")


# ─── Cache-Control on hot, public, non-personalized reads ─────────────────────

def test_cacheable_public_endpoints_get_cache_control(client):
    for path in ("/categories", "/banners", "/products/featured", "/products/best-sellers", "/products"):
        r = client.get(path)
        assert r.headers.get("cache-control") == "public, max-age=60, stale-while-revalidate=300", path


def test_personalized_endpoints_are_never_cached(client, db):
    from tests.conftest import insert_user, get_token, bearer

    insert_user(db)
    token = get_token(client, "user@test.com")

    r = client.get("/orders", headers=bearer(token))
    assert "cache-control" not in {k.lower() for k in r.headers.keys()} or r.headers.get("cache-control") != "public, max-age=60, stale-while-revalidate=300"

    r2 = client.get("/users/profile", headers=bearer(token))
    assert r2.headers.get("cache-control") != "public, max-age=60, stale-while-revalidate=300"


# ─── Backend response headers ──────────────────────────────────────────────────

def test_csp_header_matches_the_debug_setting(client):
    """CSP is only set in production (DEBUG=False) — skipped in local dev so
    the Swagger UI's own CDN-hosted JS/CSS keeps working when DEBUG=True."""
    r = client.get("/health")
    if settings.DEBUG:
        assert "content-security-policy" not in {k.lower() for k in r.headers.keys()}
    else:
        assert r.headers.get("content-security-policy") == "default-src 'none'; frame-ancestors 'none'"
