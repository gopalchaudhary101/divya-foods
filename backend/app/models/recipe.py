"""
Recipe collection schema.

Recipes are content, not commerce — no cart/order fields — but each one is
tagged with product-matching keywords so the storefront can automatically
recommend real products to buy for that dish (see recipe_service._resolve_products).
Designed to scale to 1000+ documents: is_published lets drafts be prepared
without going live, and every filterable field (cuisine, category, difficulty)
is indexed (see db_init.py) so listing/filtering stays fast regardless of
catalog size.
"""

from typing import Optional

from pydantic import BaseModel, Field


class RecipeCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    slug: Optional[str] = None  # auto-generated from title if omitted
    description: str = Field(..., min_length=10, max_length=500)
    cuisine: str = Field(..., min_length=2, max_length=50)
    category: str = Field(..., min_length=2, max_length=50)  # dish type: seafood, curry, soup, snack, sauce, noodles, grilled...
    ingredients: list[str] = Field(..., min_length=1)
    steps: list[str] = Field(..., min_length=1)
    prep_time_minutes: int = Field(..., ge=0, le=1440)
    cook_time_minutes: int = Field(..., ge=0, le=1440)
    difficulty: str = Field(..., pattern="^(Easy|Medium|Hard)$")
    servings: int = Field(..., ge=1, le=50)
    emoji: str = "🍽️"
    image: Optional[str] = None
    tags: list[str] = Field(default_factory=list)              # general keywords: quick, keto, party...
    product_tags: list[str] = Field(default_factory=list)      # matched against product name/tags/category slug
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    search_keywords: list[str] = Field(default_factory=list)
    is_published: bool = True


class RecipeUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=150)
    slug: Optional[str] = None
    description: Optional[str] = Field(None, min_length=10, max_length=500)
    cuisine: Optional[str] = None
    category: Optional[str] = None
    ingredients: Optional[list[str]] = None
    steps: Optional[list[str]] = None
    prep_time_minutes: Optional[int] = Field(None, ge=0, le=1440)
    cook_time_minutes: Optional[int] = Field(None, ge=0, le=1440)
    difficulty: Optional[str] = Field(None, pattern="^(Easy|Medium|Hard)$")
    servings: Optional[int] = Field(None, ge=1, le=50)
    emoji: Optional[str] = None
    image: Optional[str] = None
    tags: Optional[list[str]] = None
    product_tags: Optional[list[str]] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    search_keywords: Optional[list[str]] = None
    is_published: Optional[bool] = None


class RecipeBulkImportRequest(BaseModel):
    recipes: list[RecipeCreate] = Field(..., min_length=1, max_length=500)
