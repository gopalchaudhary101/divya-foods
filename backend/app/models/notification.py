"""
Notification collection schema.

Used to push in-app notifications to users:
  order_update → "Your order DF-2024-001234 has been shipped"
  promotion    → "New arrivals: Japanese Hamachi Fillets now in stock!"
  system       → "Your account password was changed"

data dict stores contextual info:
  {"order_id": "...", "order_number": "DF-2024-001234"}
"""

from datetime import datetime
from typing import Any, Dict, Literal

from pydantic import Field

from app.models.base import MongoBaseModel, PyObjectId, utcnow

NotificationType = Literal["order_update", "promotion", "system"]


class NotificationInDB(MongoBaseModel):
    user_id: PyObjectId
    type: NotificationType
    title: str
    message: str
    is_read: bool = False
    data: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=utcnow)


class NotificationResponse(MongoBaseModel):
    user_id: PyObjectId
    type: NotificationType
    title: str
    message: str
    is_read: bool
    data: Dict[str, Any]
    created_at: datetime
