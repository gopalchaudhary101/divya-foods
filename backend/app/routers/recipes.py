"""
Recipes router — public browsing only. Admin CRUD lives in admin.py,
matching this codebase's convention (see banners/coupons/bundles there).

Route ordering matters: /filters MUST be defined before /{slug}, otherwise
FastAPI matches it as a slug value (same reason products.py orders its
/featured, /best-sellers routes before /{slug}).
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pymongo.database import Database

from app.dependencies import get_db
from app.services import recipe_service

router = APIRouter(prefix="/recipes", tags=["Recipes"])


@router.get("/filters", summary="Distinct cuisines/categories currently in use")
def get_filters(db: Database = Depends(get_db)):
    return recipe_service.get_filters(db)


@router.get("", summary="Paginated, filtered recipe listing")
def list_recipes(
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=48),
    cuisine: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    return recipe_service.list_recipes(
        db, page=page, limit=limit, cuisine=cuisine, category=category,
        difficulty=difficulty, tag=tag, search=search,
    )


@router.get("/{slug}", summary="Single recipe by slug, with product recommendations")
def get_recipe(slug: str, db: Database = Depends(get_db)):
    return recipe_service.get_by_slug(db, slug)
