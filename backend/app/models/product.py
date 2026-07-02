"""
Product collection schema — the most important collection.

Key design decisions:

1. SLUG field: products are fetched by slug (URL-friendly name), not by _id.
   e.g. GET /products/fz-hamachi-fillets-yellowtail
   This keeps URLs clean and SEO-friendly.

2. DENORMALISED rating + review_count: stored on the product document so we
   can sort/filter by rating without joining the reviews collection. Updated
   every time a review is submitted or deleted.

3. ORIGIN codes match the PDF catalogue: JAP, NOR, IND, SG, BEL, NZ, AUS, etc.

4. SEO fields (meta_title, meta_description): filled by admin for Google indexing.

5. TAGS array: enables flexible filtering. e.g. ["frozen", "japanese", "sushi-grade"]
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.base import MongoBaseModel, PyObjectId, utcnow


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    slug: str = Field(..., pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str = Field(..., min_length=10)
    price: float = Field(..., gt=0)
    original_price: Optional[float] = Field(None, gt=0)
    images: List[str] = Field(..., min_length=1)   # at least one image
    category_id: PyObjectId
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    origin: Optional[str] = None       # "JAP", "NOR", "IND", "SG", "BEL", etc.
    weight: Optional[str] = None       # "1KG", "500GM", "1.4KG-2.5KG"
    stock_quantity: int = Field(..., ge=0)
    tags: List[str] = []
    is_featured: bool = False
    is_best_seller: bool = False
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    # Flexible extra attributes (e.g. heat_level, grade, pcs_per_kg)
    attributes: Dict[str, Any] = {}

    @field_validator("original_price")
    @classmethod
    def original_must_exceed_price(cls, v: Optional[float], info: Any) -> Optional[float]:
        if v is not None and "price" in info.data and v <= info.data["price"]:
            raise ValueError("original_price must be greater than sale price")
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    original_price: Optional[float] = Field(None, gt=0)
    images: Optional[List[str]] = None
    category_id: Optional[PyObjectId] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    origin: Optional[str] = None
    weight: Optional[str] = None
    stock_quantity: Optional[int] = Field(None, ge=0)
    tags: Optional[List[str]] = None
    is_featured: Optional[bool] = None
    is_best_seller: Optional[bool] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None


class ProductInDB(MongoBaseModel):
    name: str
    slug: str
    description: str
    price: float
    original_price: Optional[float] = None
    images: List[str] = []
    category_id: PyObjectId
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    origin: Optional[str] = None
    weight: Optional[str] = None
    in_stock: bool = True
    stock_quantity: int = 0
    rating: float = 0.0                # denormalised: avg of all reviews
    review_count: int = 0              # denormalised: count of all reviews
    tags: List[str] = []
    is_featured: bool = False
    is_best_seller: bool = False
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    attributes: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class ProductResponse(MongoBaseModel):
    name: str
    slug: str
    description: str
    price: float
    original_price: Optional[float] = None
    images: List[str]
    category_id: PyObjectId
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    origin: Optional[str] = None
    weight: Optional[str] = None
    in_stock: bool
    stock_quantity: int
    rating: float
    review_count: int
    tags: List[str]
    is_featured: bool
    is_best_seller: bool
    attributes: Dict[str, Any]
    created_at: datetime


class ProductListResponse(BaseModel):
    """Lightweight version for listing pages — fewer fields to reduce payload."""
    id: Optional[PyObjectId] = Field(None, alias="_id")
    name: str
    slug: str
    price: float
    original_price: Optional[float] = None
    images: List[str]
    origin: Optional[str] = None
    weight: Optional[str] = None
    in_stock: bool
    rating: float
    review_count: int
    is_featured: bool
    is_best_seller: bool

    model_config = {"populate_by_name": True}
