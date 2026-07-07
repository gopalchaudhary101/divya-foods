"""
Review collection schema.

Constraints:
- One review per user per product (enforced by a compound unique index)
- is_verified_purchase: True only if the user has a delivered order containing
  this product — checked at review submission time
- Rating (1-5) updates the product's denormalised rating + review_count fields
"""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.base import MongoBaseModel, PyObjectId, utcnow


class ReviewCreate(BaseModel):
    product_id: PyObjectId
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(..., min_length=10, max_length=1000)


class ReviewInDB(MongoBaseModel):
    product_id: PyObjectId
    user_id: PyObjectId
    user_name: str               # denormalised for display without extra query
    rating: int
    comment: str
    is_verified_purchase: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class ReviewResponse(MongoBaseModel):
    product_id: PyObjectId
    user_id: PyObjectId
    user_name: str
    rating: int
    comment: str
    is_verified_purchase: bool
    created_at: datetime
