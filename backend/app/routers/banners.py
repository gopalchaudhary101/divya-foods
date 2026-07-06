from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.dependencies import get_db
from app.services import banner_service

router = APIRouter(prefix="/banners", tags=["Banners"])


@router.get("", summary="Active banners for the homepage carousel")
def get_active_banners(db: Database = Depends(get_db)):
    return banner_service.get_active(db)
