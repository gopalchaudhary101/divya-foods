"""
Recipes router — public browsing + admin CRUD (admin_router below, under
/admin/recipes).

Route ordering matters: /filters MUST be defined before /{slug}, otherwise
FastAPI matches it as a slug value (same reason products.py orders its
/featured, /best-sellers routes before /{slug}).
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pymongo.database import Database

from app.dependencies import get_db, require_admin
from app.models.recipe import RecipeCreate, RecipeUpdate, RecipeBulkImportRequest
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


# ─── Admin ────────────────────────────────────────────────────────────────────
# Separate no-prefix router — lives under /admin/recipes. Moved here from the
# former monolithic admin.py.

admin_router = APIRouter(tags=["Admin"])


@admin_router.get("/admin/recipes")
def admin_list_recipes(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    cuisine: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    is_published: Optional[bool] = Query(None, alias="isPublished"),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return recipe_service.admin_list_recipes(
        db, page=page, limit=limit, search=search, cuisine=cuisine,
        category=category, is_published=is_published,
    )


@admin_router.post("/admin/recipes")
def admin_create_recipe(
    body: RecipeCreate,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return recipe_service.admin_create_recipe(db, body.model_dump())


@admin_router.put("/admin/recipes/{recipe_id}")
def admin_update_recipe(
    recipe_id: str,
    body: RecipeUpdate,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return recipe_service.admin_update_recipe(db, recipe_id, body.model_dump(exclude_unset=True))


@admin_router.delete("/admin/recipes/{recipe_id}")
def admin_delete_recipe(
    recipe_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return recipe_service.admin_delete_recipe(db, recipe_id)


@admin_router.post("/admin/recipes/bulk-import")
def admin_bulk_import_recipes(
    body: RecipeBulkImportRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return recipe_service.admin_bulk_import_recipes(db, [r.model_dump() for r in body.recipes])
