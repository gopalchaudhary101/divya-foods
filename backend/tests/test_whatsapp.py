"""
WhatsApp integration tests.

Covers both layers:
- Click-to-chat config/analytics (public config, share tracking, admin CRUD + auth guards)
- Cloud API webhook (GET verification handshake, POST signature verification,
  inbound-message-to-product-search-reply flow) — all outbound Graph API calls
  are mocked; no real network/credentials are ever exercised.
"""

import hashlib
import hmac
import json
from unittest.mock import patch

from tests.conftest import insert_user, insert_category, insert_product, get_token, bearer

_APP_SECRET = "test_whatsapp_app_secret"
_VERIFY_TOKEN = "test_verify_token"


def _sign(body: bytes, secret: str = _APP_SECRET) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


class _SyncThread:
    """Fake threading.Thread that runs the target synchronously — makes the
    webhook's fire-and-forget reply dispatch deterministic in tests."""
    def __init__(self, target=None, args=(), kwargs=None, daemon=None):
        self._target = target
        self._args = args
        self._kwargs = kwargs or {}

    def start(self):
        self._target(*self._args, **self._kwargs)


def _sync_dispatch(monkeypatch):
    monkeypatch.setattr("app.routers.whatsapp.threading.Thread", _SyncThread)


# ─── Public config ───────────────────────────────────────────────────────────

def test_public_config_returns_safe_defaults(client, db):
    r = client.get("/whatsapp/config")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["enabled"] is False
    assert data["phoneNumber"] == ""
    assert "{productName}" in data["productMessageTemplate"]
    assert "{itemsList}" in data["cartMessageTemplate"]
    assert "{orderNumber}" in data["orderMessageTemplate"]


def test_public_config_reflects_admin_update(client, db):
    uid = insert_user(db, email="admin_wa@test.com", role="admin")
    token = get_token(client, "admin_wa@test.com")
    r = client.put(
        "/admin/whatsapp/config",
        json={"enabled": True, "phoneNumber": "919999123242"},
        headers=bearer(token),
    )
    assert r.status_code == 200

    r = client.get("/whatsapp/config")
    data = r.json()["data"]
    assert data["enabled"] is True
    assert data["phoneNumber"] == "919999123242"


# ─── Admin config auth guards ────────────────────────────────────────────────

def test_admin_whatsapp_config_requires_auth(client, db):
    assert client.get("/admin/whatsapp/config").status_code == 401
    assert client.put("/admin/whatsapp/config", json={"enabled": True}).status_code == 401


def test_admin_whatsapp_config_rejects_customer(client, db):
    insert_user(db, email="cust_wa@test.com", role="customer")
    token = get_token(client, "cust_wa@test.com")
    r = client.get("/admin/whatsapp/config", headers=bearer(token))
    assert r.status_code == 403


def test_admin_get_config_reports_cloud_api_status(client, db):
    insert_user(db, email="admin_wa2@test.com", role="admin")
    token = get_token(client, "admin_wa2@test.com")

    r = client.get("/admin/whatsapp/config", headers=bearer(token))
    assert r.status_code == 200
    assert r.json()["data"]["cloudApiConfigured"] is False

    with patch("app.services.whatsapp_service.settings.WHATSAPP_ACCESS_TOKEN", "tok"), \
         patch("app.services.whatsapp_service.settings.WHATSAPP_PHONE_NUMBER_ID", "123"):
        r = client.get("/admin/whatsapp/config", headers=bearer(token))
        assert r.json()["data"]["cloudApiConfigured"] is True


# ─── Share tracking + analytics ──────────────────────────────────────────────

def test_track_share_is_public_and_logs_event(client, db):
    r = client.post("/whatsapp/track-share", json={
        "productId": "p1", "productName": "Norwegian Salmon", "source": "product_card",
    })
    assert r.status_code == 200
    assert db.whatsapp_shares.count_documents({}) == 1
    doc = db.whatsapp_shares.find_one({})
    assert doc["product_id"] == "p1"
    assert doc["source"] == "product_card"


def test_track_share_rejects_invalid_source(client, db):
    r = client.post("/whatsapp/track-share", json={
        "productId": "p1", "productName": "X", "source": "not_a_real_source",
    })
    assert r.status_code == 422


def test_admin_analytics_aggregates_totals_and_top_products(client, db):
    for _ in range(3):
        client.post("/whatsapp/track-share", json={"productId": "p1", "productName": "Salmon", "source": "product_card"})
    for _ in range(2):
        client.post("/whatsapp/track-share", json={"productId": "p2", "productName": "Tuna", "source": "cart"})
    client.post("/whatsapp/track-share", json={"productId": "p1", "productName": "Salmon", "source": "order"})

    insert_user(db, email="admin_wa3@test.com", role="admin")
    token = get_token(client, "admin_wa3@test.com")
    r = client.get("/admin/whatsapp/analytics", headers=bearer(token))
    assert r.status_code == 200
    data = r.json()["data"]

    assert data["totalShares"] == 6
    top = {p["productId"]: p["count"] for p in data["topProducts"]}
    assert top["p1"] == 4
    assert top["p2"] == 2
    by_source = {s["source"]: s["count"] for s in data["bySource"]}
    assert by_source["product_card"] == 3
    assert by_source["cart"] == 2
    assert by_source["order"] == 1


def test_admin_analytics_requires_auth(client, db):
    assert client.get("/admin/whatsapp/analytics").status_code == 401


# ─── Webhook: GET verification handshake ────────────────────────────────────

def test_webhook_verification_succeeds_with_correct_token(client, db):
    with patch("app.services.whatsapp_service.settings.WHATSAPP_VERIFY_TOKEN", _VERIFY_TOKEN):
        r = client.get("/whatsapp/webhook", params={
            "hub.mode": "subscribe", "hub.verify_token": _VERIFY_TOKEN, "hub.challenge": "12345",
        })
    assert r.status_code == 200
    assert r.text == "12345"


def test_webhook_verification_rejects_wrong_token(client, db):
    with patch("app.services.whatsapp_service.settings.WHATSAPP_VERIFY_TOKEN", _VERIFY_TOKEN):
        r = client.get("/whatsapp/webhook", params={
            "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "12345",
        })
    assert r.status_code == 403


def test_webhook_verification_rejects_when_token_not_configured(client, db):
    with patch("app.services.whatsapp_service.settings.WHATSAPP_VERIFY_TOKEN", ""):
        r = client.get("/whatsapp/webhook", params={
            "hub.mode": "subscribe", "hub.verify_token": "anything", "hub.challenge": "12345",
        })
    assert r.status_code == 403


# ─── Webhook: POST signature verification + message handling ───────────────

def _text_message_event(from_number="919876543210", text="salmon"):
    return {
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{"from": from_number, "type": "text", "text": {"body": text}}],
                },
            }],
        }],
    }


def test_webhook_post_rejects_invalid_signature(client, db, monkeypatch):
    _sync_dispatch(monkeypatch)
    body = json.dumps(_text_message_event()).encode()
    with patch("app.services.whatsapp_service.settings.WHATSAPP_APP_SECRET", _APP_SECRET), \
         patch("app.services.whatsapp_service.send_text_message") as mock_send:
        r = client.post(
            "/whatsapp/webhook", content=body,
            headers={"Content-Type": "application/json", "X-Hub-Signature-256": "sha256=wrong"},
        )
    assert r.status_code == 200  # always 200s so Meta doesn't retry-storm
    mock_send.assert_not_called()


def test_webhook_post_rejects_when_secret_not_configured(client, db, monkeypatch):
    _sync_dispatch(monkeypatch)
    body = json.dumps(_text_message_event()).encode()
    signature = _sign(body)
    with patch("app.services.whatsapp_service.settings.WHATSAPP_APP_SECRET", ""), \
         patch("app.services.whatsapp_service.send_text_message") as mock_send:
        r = client.post(
            "/whatsapp/webhook", content=body,
            headers={"Content-Type": "application/json", "X-Hub-Signature-256": f"sha256={signature}"},
        )
    assert r.status_code == 200
    mock_send.assert_not_called()


def test_webhook_post_with_valid_signature_searches_and_replies(client, db, monkeypatch):
    _sync_dispatch(monkeypatch)
    cat_id = insert_category(db)
    insert_product(db, cat_id, name="Norwegian Salmon Fillet", price=899.0)

    body = json.dumps(_text_message_event(text="salmon")).encode()
    signature = _sign(body)
    with patch("app.services.whatsapp_service.settings.WHATSAPP_APP_SECRET", _APP_SECRET), \
         patch("app.services.whatsapp_service.send_image_message") as mock_image, \
         patch("app.services.whatsapp_service.send_text_message") as mock_text:
        r = client.post(
            "/whatsapp/webhook", content=body,
            headers={"Content-Type": "application/json", "X-Hub-Signature-256": f"sha256={signature}"},
        )
    assert r.status_code == 200
    mock_image.assert_called_once()
    args = mock_image.call_args[0]
    assert args[0] == "919876543210"
    assert "Norwegian Salmon Fillet" in args[2]
    mock_text.assert_not_called()


def test_webhook_post_ignores_status_updates(client, db, monkeypatch):
    """Delivery/read receipts have no 'messages' key — must not crash or reply."""
    _sync_dispatch(monkeypatch)
    event = {"entry": [{"changes": [{"value": {"statuses": [{"status": "delivered"}]}}]}]}
    body = json.dumps(event).encode()
    signature = _sign(body)
    with patch("app.services.whatsapp_service.settings.WHATSAPP_APP_SECRET", _APP_SECRET), \
         patch("app.services.whatsapp_service.send_text_message") as mock_text:
        r = client.post(
            "/whatsapp/webhook", content=body,
            headers={"Content-Type": "application/json", "X-Hub-Signature-256": f"sha256={signature}"},
        )
    assert r.status_code == 200
    mock_text.assert_not_called()


# ─── handle_incoming_message (direct unit tests) ────────────────────────────

def test_handle_incoming_message_sends_text_fallback_when_no_products_match(db):
    from app.services import whatsapp_service
    with patch("app.services.whatsapp_service.send_text_message") as mock_text:
        whatsapp_service.handle_incoming_message(db, "919876543210", "asdfghjkl_no_match")
    mock_text.assert_called_once()
    assert "couldn't find" in mock_text.call_args[0][1]


def test_handle_incoming_message_sends_text_when_product_has_no_image(db):
    from app.services import whatsapp_service
    cat_id = insert_category(db)
    db.products.update_one(
        {"_id": insert_product(db, cat_id, name="Imageless Tuna", price=500.0)},
        {"$set": {"images": []}},
    )
    with patch("app.services.whatsapp_service.send_text_message") as mock_text, \
         patch("app.services.whatsapp_service.send_image_message") as mock_image:
        whatsapp_service.handle_incoming_message(db, "919876543210", "tuna")
    mock_text.assert_called_once()
    mock_image.assert_not_called()
    assert "Imageless Tuna" in mock_text.call_args[0][1]


def test_handle_incoming_message_never_raises_on_internal_error(db):
    from app.services import whatsapp_service
    with patch("app.services.product_service.search_products", side_effect=RuntimeError("boom")):
        whatsapp_service.handle_incoming_message(db, "919876543210", "salmon")  # must not raise


# ─── Signature/config helpers (unit-level) ──────────────────────────────────

def test_is_cloud_api_configured():
    from app.services import whatsapp_service
    with patch("app.services.whatsapp_service.settings.WHATSAPP_ACCESS_TOKEN", ""), \
         patch("app.services.whatsapp_service.settings.WHATSAPP_PHONE_NUMBER_ID", ""):
        assert whatsapp_service.is_cloud_api_configured() is False
    with patch("app.services.whatsapp_service.settings.WHATSAPP_ACCESS_TOKEN", "tok"), \
         patch("app.services.whatsapp_service.settings.WHATSAPP_PHONE_NUMBER_ID", "123"):
        assert whatsapp_service.is_cloud_api_configured() is True


def test_verify_webhook_signature_matches_only_correct_secret():
    from app.services import whatsapp_service
    body = b'{"a":1}'
    sig = "sha256=" + hmac.new(_APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
    with patch("app.services.whatsapp_service.settings.WHATSAPP_APP_SECRET", _APP_SECRET):
        assert whatsapp_service.verify_webhook_signature(body, sig) is True
        assert whatsapp_service.verify_webhook_signature(body, "sha256=deadbeef") is False
        assert whatsapp_service.verify_webhook_signature(body, "") is False
