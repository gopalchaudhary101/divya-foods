"""
Category collection schema.

Categories support ONE level of nesting via parent_id:
  Frozen Seafood (parent)
    └── Prawns         (child — parent_id points to "Frozen Seafood")
    └── Fish Fillets   (child)

product_count is a denormalised counter — updated whenever a product is
added/removed from this category. This avoids a COUNT query on every page load.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.base import MongoBaseModel, PyObjectId, utcnow


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: Optional[str] = None
    image: str                              # Cloudinary URL
    parent_id: Optional[PyObjectId] = None  # None = top-level category
    order: int = 0                          # display sort order
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryInDB(MongoBaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    image: str
    parent_id: Optional[PyObjectId] = None
    product_count: int = 0
    order: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class CategoryResponse(MongoBaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    image: str
    parent_id: Optional[PyObjectId] = None
    product_count: int
    order: int
    is_active: bool
