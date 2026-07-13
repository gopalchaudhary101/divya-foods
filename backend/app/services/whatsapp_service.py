"""
WhatsApp integration — two independent layers:

1. Click-to-chat "Share on WhatsApp" buttons (product/cart/order pages).
   Pure config: a phone number + editable message templates. No Meta API,
   no credentials, works the instant an admin sets a number. Share clicks
   are logged to `whatsapp_shares` for the admin analytics view.

2. WhatsApp Business Cloud API webhook — receives inbound customer messages,
   searches the product catalogue (reusing product_service's existing
   text-search index) and replies with matching products. Requires the
   WHATSAPP_* env vars in app/config.py; until those are set, `is_cloud_api_configured()`
   is False and the webhook silently no-ops rather than erroring, so nothing
   breaks for sites that haven't done the Meta setup yet.
"""

import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from pymongo.database import Database

from app.config import settings
from app.services import product_service

logger = logging.getLogger("app.whatsapp")

_CONFIG_ID = "config"

_DEFAULTS = {
    "enabled": False,
    "phoneNumber": "",
    "productMessageTemplate": (
        "Hi! I'm interested in this product from Divya Foods:\n\n"
        "*{productName}*\n{description}\n\n"
        "💰 Price: {price}\n"
        "📦 Category: {category}\n"
        "✅ Availability: {availability}\n\n"
        "🔗 {link}\n\n"
        "Could you help me with more details?"
    ),
    "cartMessageTemplate": (
        "Hi! I'd like to order the following items from Divya Foods:\n\n"
        "{itemsList}\n\n"
        "💰 Total: {total}\n\n"
        "Could you please confirm availability and delivery details?"
    ),
    "orderMessageTemplate": (
        "Hi! I'd like to check on my order from Divya Foods:\n\n"
        "*Order:* {orderNumber}\n"
        "*Status:* {status}\n"
        "*Total:* {total}\n\n"
        "Could you please provide an update?"
    ),
}


def _to_dict(doc: dict) -> dict:
    return {field: doc.get(field, default) for field, default in _DEFAULTS.items()}


# ─── Public config + admin CRUD ─────────────────────────────────────────────

def get_public_config(db: Database) -> dict:
    """Safe to expose to any visitor — just a phone number and message templates,
    no secrets. Powers every 'Share on WhatsApp' button on the site."""
    doc = db.whatsapp_settings.find_one({"_id": _CONFIG_ID}) or {}
    return {"success": True, "data": _to_dict(doc)}


def admin_get_config(db: Database) -> dict:
    doc = db.whatsapp_settings.find_one({"_id": _CONFIG_ID}) or {}
    data = _to_dict(doc)
    data["cloudApiConfigured"] = is_cloud_api_configured()
    return {"success": True, "data": data}


def admin_update_config(db: Database, payload: dict) -> dict:
    update = {k: v for k, v in payload.items() if k in _DEFAULTS and v is not None}
    if update:
        db.whatsapp_settings.update_one(
            {"_id": _CONFIG_ID},
            {"$set": {**update, "updatedAt": datetime.now(timezone.utc)}},
            upsert=True,
        )
    doc = db.whatsapp_settings.find_one({"_id": _CONFIG_ID}) or {}
    data = _to_dict(doc)
    data["cloudApiConfigured"] = is_cloud_api_configured()
    return {"success": True, "data": data}


# ─── Share tracking + analytics ─────────────────────────────────────────────

def track_share(db: Database, product_id: str, product_name: str, source: str) -> dict:
    db.whatsapp_shares.insert_one({
        "product_id": product_id,
        "product_name": product_name,
        "source": source,
        "shared_at": datetime.now(timezone.utc),
    })
    return {"success": True}


def get_share_analytics(db: Database) -> dict:
    total = db.whatsapp_shares.count_documents({})

    by_source = list(db.whatsapp_shares.aggregate([
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))

    top_products = list(db.whatsapp_shares.aggregate([
        {"$group": {
            "_id": "$product_id",
            "productName": {"$last": "$product_name"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]))

    return {
        "success": True,
        "data": {
            "totalShares": total,
            "bySource": [{"source": r["_id"], "count": r["count"]} for r in by_source],
            "topProducts": [
                {"productId": r["_id"], "productName": r["productName"], "count": r["count"]}
                for r in top_products
            ],
        },
    }


# ─── Cloud API (Meta WhatsApp Business Platform) ────────────────────────────

def is_cloud_api_configured() -> bool:
    return bool(settings.WHATSAPP_ACCESS_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)


def _graph_url(path: str) -> str:
    return f"https://graph.facebook.com/{settings.WHATSAPP_GRAPH_API_VERSION}/{path}"


def _send(payload: dict) -> bool:
    if not is_cloud_api_configured():
        logger.warning("WhatsApp Cloud API not configured — skipping send.")
        return False
    try:
        resp = httpx.post(
            _graph_url(f"{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"),
            json={"messaging_product": "whatsapp", **payload},
            headers={"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"},
            timeout=10.0,
        )
        if resp.status_code >= 400:
            logger.error("WhatsApp send failed (%s): %s", resp.status_code, resp.text[:500])
            return False
        return True
    except httpx.HTTPError as e:
        logger.error("WhatsApp send request error: %s", e)
        return False


def send_text_message(to: str, body: str) -> bool:
    return _send({"to": to, "type": "text", "text": {"body": body}})


def send_image_message(to: str, image_url: str, caption: str) -> bool:
    return _send({"to": to, "type": "image", "image": {"link": image_url, "caption": caption}})


# ─── Webhook verification ────────────────────────────────────────────────────

def verify_webhook_challenge(mode: Optional[str], token: Optional[str], challenge: Optional[str]) -> Optional[str]:
    """Meta's one-time GET handshake when the webhook URL is first configured."""
    if mode == "subscribe" and settings.WHATSAPP_VERIFY_TOKEN and token == settings.WHATSAPP_VERIFY_TOKEN:
        return challenge
    return None


def verify_webhook_signature(raw_body: bytes, signature_header: str) -> bool:
    """Every inbound POST is signed with the App Secret (X-Hub-Signature-256:
    sha256=<hex>). Fail closed — an unconfigured APP_SECRET can never verify,
    so no traffic is trusted until the Meta setup is actually complete."""
    if not settings.WHATSAPP_APP_SECRET or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(settings.WHATSAPP_APP_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.removeprefix("sha256="))


# ─── Inbound message handling ────────────────────────────────────────────────

def parse_incoming_messages(payload: dict) -> list[tuple[str, str]]:
    """Extracts (from_number, text) pairs from a webhook payload. Only plain
    text messages are handled — status updates (delivered/read) and non-text
    message types are silently skipped."""
    results = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for msg in value.get("messages", []):
                if msg.get("type") == "text":
                    text = msg.get("text", {}).get("body", "").strip()
                    from_number = msg.get("from", "")
                    if text and from_number:
                        results.append((from_number, text))
    return results


def _format_product_reply(p: dict) -> str:
    price = f"₹{p['price']:.0f}" if isinstance(p.get("price"), (int, float)) else "N/A"
    availability = "✅ In Stock" if p.get("inStock", True) else "❌ Out of Stock"
    link = f"{settings.FRONTEND_URL}/products/{p['slug']}"
    return f"*{p['name']}*\n💰 {price}\n{availability}\n🔗 {link}"


def handle_incoming_message(db: Database, from_number: str, text: str) -> None:
    """Searches the catalogue for the customer's message and replies with up
    to 3 matching products (as image messages when a product photo exists,
    otherwise a text message), or a friendly fallback if nothing matched."""
    try:
        results = product_service.search_products(db, text, limit=3)
        products = results.get("data", [])

        if not products:
            send_text_message(
                from_number,
                "Sorry, I couldn't find a matching product 🐟 "
                f"Browse our full catalogue at {settings.FRONTEND_URL}/products "
                "or call us at +91 9999123242.",
            )
            return

        for p in products:
            caption = _format_product_reply(p)
            image = (p.get("images") or [None])[0]
            if image:
                send_image_message(from_number, image, caption)
            else:
                send_text_message(from_number, caption)
    except Exception:
        logger.exception("Failed to handle incoming WhatsApp message from %s", from_number)
