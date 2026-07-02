"""
Banner collection schema.

Banners power the homepage hero carousel. Managed entirely by the admin.
The `order` field controls carousel position. Only is_active=True banners
are returned to the frontend.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.base import MongoBaseModel, utcnow


class BannerCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    subtitle: Optional[str] = None
    image: str                    # Cloudinary URL
    link: Optional[str] = None    # where tapping the banner takes the user
    is_active: bool = True
    order: int = 0                # lower number = shown first


class BannerUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    image: Optional[str] = None
    link: Optional[str] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None


class BannerInDB(MongoBaseModel):
    title: str
    subtitle: Optional[str] = None
    image: str
    link: Optional[str] = None
    is_active: bool = True
    order: int = 0
    created_at: datetime = Field(default_factory=utcnow)


class BannerResponse(MongoBaseModel):
    title: str
    subtitle: Optional[str] = None
    image: str
    link: Optional[str] = None
    is_active: bool
    order: int
