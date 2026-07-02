from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.dependencies import get_db
from app.services import category_service

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", summary="All active categories")
def list_categories(db: Database = Depends(get_db)):
    return category_service.get_all(db)


@router.get("/{slug}", summary="Single category by slug")
def get_category(slug: str, db: Database = Depends(get_db)):
    return category_service.get_by_slug(db, slug)
