"""
push_subscription — stores browser PushSubscription objects per user.

One user can have multiple subscriptions (phone + laptop, etc.).
Subscriptions are removed when the browser revokes them (410 Gone from push service).
"""

from datetime import datetime
from typing import Any, Dict

from pydantic import Field

from app.models.base import MongoBaseModel, PyObjectId, utcnow


class PushSubscriptionInDB(MongoBaseModel):
    user_id: PyObjectId
    endpoint: str
    keys: Dict[str, str]          # {"p256dh": "...", "auth": "..."}
    user_agent: str = ""
    created_at: datetime = Field(default_factory=utcnow)
