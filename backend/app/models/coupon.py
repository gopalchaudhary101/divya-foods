"""
Coupon collection schema.

Two discount types:
  percentage → "20% off" (max_discount_amount caps the saving to prevent abuse)
  fixed      → "₹200 off"

Validation flow at checkout:
  1. Is the code valid? (exists + is_active)
  2. Is it expired? (expires_at > now)
  3. Has it reached max uses? (used_count < max_uses)
  4. Does the order meet min_order_amount?
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.models.base import MongoBaseModel, utcnow


class CouponCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=20, pattern=r"^[A-Z0-9_-]+$")
    description: str
    discount_type: Literal["percentage", "fixed"]
    discount_value: float = Field(..., gt=0)
    min_order_amount: float = Field(default=0, ge=0)
    max_discount_amount: Optional[float] = None   # cap for % coupons
    max_uses: int = Field(..., gt=0)
    expires_at: datetime
    is_active: bool = True


class CouponValidateRequest(BaseModel):
    code: str
    order_amount: float


class CouponValidateResponse(BaseModel):
    valid: bool
    discount_amount: float = 0.0
    message: str


class CouponInDB(MongoBaseModel):
    code: str
    description: str
    discount_type: Literal["percentage", "fixed"]
    discount_value: float
    min_order_amount: float = 0.0
    max_discount_amount: Optional[float] = None
    max_uses: int
    used_count: int = 0
    expires_at: datetime
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class CouponResponse(MongoBaseModel):
    code: str
    description: str
    discount_type: Literal["percentage", "fixed"]
    discount_value: float
    min_order_amount: float
    max_uses: int
    used_count: int
    expires_at: datetime
    is_active: bool
