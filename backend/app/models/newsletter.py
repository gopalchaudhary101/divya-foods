"""
Newsletter collection schema.

Simple email capture. is_subscribed allows unsubscribe without deleting the record
so we maintain a history of who opted out (important for GDPR compliance).
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.base import MongoBaseModel, utcnow


class NewsletterSubscribe(BaseModel):
    email: EmailStr


class NewsletterInDB(MongoBaseModel):
    email: str
    is_subscribed: bool = True
    subscribed_at: datetime = Field(default_factory=utcnow)
    unsubscribed_at: datetime | None = None
