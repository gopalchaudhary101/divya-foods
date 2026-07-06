from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.dependencies import get_db
from app.services import settings_service

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", summary="Public site settings (business name, GST, FSSAI)")
def get_settings(db: Database = Depends(get_db)):
    return settings_service.get_public(db)
