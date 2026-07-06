"""
Digital marketing content generation tests — covers the template fallback
(no ANTHROPIC_API_KEY needed for these) and access control. The real Claude
call path is exercised via a mocked client so no network/API key is needed.
"""

from unittest.mock import MagicMock, patch

from tests.conftest import insert_user, insert_category, insert_product, get_token, bearer


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _customer_headers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    return bearer(token)


def test_marketing_endpoint_blocks_customers(client, db):
    hdrs   = _customer_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id))
    r = client.post(f"/admin/products/{pid}/marketing", headers=hdrs)
    assert r.status_code == 403


def test_marketing_endpoint_blocks_anonymous(client, db):
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id))
    r = client.post(f"/admin/products/{pid}/marketing")
    assert r.status_code == 401


def test_marketing_404_for_missing_product(client, db):
    hdrs = _admin_headers(client, db)
    from bson import ObjectId
    r = client.post(f"/admin/products/{ObjectId()}/marketing", headers=hdrs)
    assert r.status_code == 404


def test_marketing_uses_template_fallback_without_api_key(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id, name="Norwegian Salmon"))

    with patch("app.services.marketing_service.settings.ANTHROPIC_API_KEY", ""):
        r = client.post(f"/admin/products/{pid}/marketing", headers=hdrs)

    assert r.status_code == 200
    data = r.json()["data"]
    assert "Norwegian Salmon" in data["seoTitle"]
    assert len(data["seoTitle"]) <= 60
    assert len(data["seoDescription"]) <= 160
    assert "#DivyaFoods" in data["hashtags"]
    assert data["productUrl"] == "https://divya-foods.vercel.app/products/norwegian-salmon"


def test_marketing_uses_ai_when_configured(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id, name="Norwegian Salmon"))

    fake_response = MagicMock()
    fake_response.content = [MagicMock(text='{"seoTitle": "AI Title", "seoDescription": "AI description", "caption": "AI caption!", "hashtags": ["#AI", "#Seafood"]}')]

    with patch("app.services.marketing_service.settings.ANTHROPIC_API_KEY", "fake-key"), \
         patch("anthropic.Anthropic") as MockClient:
        MockClient.return_value.messages.create.return_value = fake_response
        r = client.post(f"/admin/products/{pid}/marketing", headers=hdrs)

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["seoTitle"] == "AI Title"
    assert data["hashtags"] == ["#AI", "#Seafood"]


def test_marketing_falls_back_when_ai_response_is_malformed(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id, name="Norwegian Salmon"))

    fake_response = MagicMock()
    fake_response.content = [MagicMock(text="not valid json at all")]

    with patch("app.services.marketing_service.settings.ANTHROPIC_API_KEY", "fake-key"), \
         patch("anthropic.Anthropic") as MockClient:
        MockClient.return_value.messages.create.return_value = fake_response
        r = client.post(f"/admin/products/{pid}/marketing", headers=hdrs)

    assert r.status_code == 200
    data = r.json()["data"]
    assert "Norwegian Salmon" in data["seoTitle"]  # fell back to template


def test_marketing_falls_back_when_ai_call_raises(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id, name="Norwegian Salmon"))

    with patch("app.services.marketing_service.settings.ANTHROPIC_API_KEY", "fake-key"), \
         patch("anthropic.Anthropic", side_effect=Exception("network error")):
        r = client.post(f"/admin/products/{pid}/marketing", headers=hdrs)

    assert r.status_code == 200
    assert "Norwegian Salmon" in r.json()["data"]["seoTitle"]
