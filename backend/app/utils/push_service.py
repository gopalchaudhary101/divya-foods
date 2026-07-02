"""
Web push utility — sends push notifications to subscribed browsers.

Uses pywebpush with VAPID authentication.
Silently drops stale subscriptions (410 Gone) from the database.
"""

import json
import logging
from typing import Optional

from pymongo.database import Database

from app.config import settings

logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    return bool(settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY)


def send_push_to_user(
    db: Database,
    user_id,
    title: str,
    body: str,
    url: str = "/",
    tag: str = "divya-foods",
) -> int:
    """
    Send a push notification to all subscriptions for a given user.
    Returns the number of successful sends.
    """
    if not _is_configured():
        return 0

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed — push notifications disabled")
        return 0

    subscriptions = list(db.push_subscriptions.find({"user_id": user_id}))
    if not subscriptions:
        return 0

    payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag})
    sent = 0
    stale_endpoints: list[str] = []

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"],
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_EMAIL},
            )
            sent += 1
        except WebPushException as exc:
            response = getattr(exc, "response", None)
            if response is not None and response.status_code in (404, 410):
                # Subscription expired or revoked — remove it
                stale_endpoints.append(sub["endpoint"])
            else:
                logger.warning("Push send failed for %s: %s", sub["endpoint"][:40], exc)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Push send error: %s", exc)

    if stale_endpoints:
        db.push_subscriptions.delete_many({"endpoint": {"$in": stale_endpoints}})

    return sent


def save_subscription(db: Database, user_id, endpoint: str, keys: dict, user_agent: str = "") -> None:
    """Upsert a push subscription for a user (keyed by endpoint)."""
    db.push_subscriptions.update_one(
        {"endpoint": endpoint},
        {"$set": {"user_id": user_id, "endpoint": endpoint, "keys": keys, "user_agent": user_agent}},
        upsert=True,
    )


def remove_subscription(db: Database, endpoint: str) -> None:
    """Remove a specific push subscription."""
    db.push_subscriptions.delete_one({"endpoint": endpoint})
