"""
Products router — HTTP layer only.

Route ordering matters: /featured and /best-sellers and /search MUST be
defined before /{slug}, otherwise FastAPI matches them as slug values.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pymongo.database import Database

from app.dependencies import get_db
from app.services import product_service

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("/featured", summary="Homepage featured products")
def get_featured(db: Database = Depends(get_db)):
    return product_service.get_featured(db)


@router.get("/best-sellers", summary="Homepage best-seller products")
def get_best_sellers(db: Database = Depends(get_db)):
    return product_service.get_best_sellers(db)


@router.get("/search", summary="Full-text product search")
def search(
    q: str = Query(..., min_length=2, description="Search query"),
    db: Database = Depends(get_db),
):
    return product_service.search_products(db, q)


@router.get("/suggestions", summary="Autocomplete suggestions (name + price + image only)")
def suggestions(
    q: str = Query(..., min_length=1, description="Partial search query"),
    limit: int = Query(6, ge=1, le=10),
    db: Database = Depends(get_db),
):
    return product_service.get_suggestions(db, q, limit)


@router.get("", summary="Paginated, filtered product listing")
def list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=48),
    category: Optional[str] = Query(None, description="Category slug"),
    origin: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None, alias="minPrice"),
    max_price: Optional[float] = Query(None, alias="maxPrice"),
    in_stock: Optional[bool] = Query(None, alias="inStock"),
    sort_by: str = Query("newest", alias="sortBy"),
    search: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    return product_service.get_products(
        db,
        page=page,
        limit=limit,
        category=category,
        origin=origin,
        min_price=min_price,
        max_price=max_price,
        in_stock=in_stock,
        sort_by=sort_by,
        search=search,
    )


@router.get("/{slug}", summary="Single product by URL slug")
def get_product(slug: str, db: Database = Depends(get_db)):
    return product_service.get_by_slug(db, slug)


@router.get("/{product_id}/related", summary="Related products")
def get_related(product_id: str, db: Database = Depends(get_db)):
    return product_service.get_related(db, product_id)
