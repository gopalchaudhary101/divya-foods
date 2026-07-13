from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from pymongo.database import Database

from app.dependencies import get_db, require_admin
from app.services import settings_service

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", summary="Public site settings (business name, GST, FSSAI)")
def get_settings(db: Database = Depends(get_db)):
    return settings_service.get_public(db)


# ─── Admin ────────────────────────────────────────────────────────────────────
# Separate no-prefix router — lives under /admin/settings. Moved here from the
# former monolithic admin.py.

admin_router = APIRouter(tags=["Admin"])


class SettingsUpdateRequest(BaseModel):
    businessName: Optional[str] = None
    gstNumber: Optional[str] = None
    fssaiNumber: Optional[str] = None
    # Image-upload limits (see app/services/settings_service.py for defaults)
    maxUploadSizeMB: Optional[int] = None
    maxImageDimension: Optional[int] = None
    compressionQuality: Optional[str] = None
    allowedFormats: Optional[list[str]] = None
    enableWebP: Optional[bool] = None
    enableAVIF: Optional[bool] = None
    thumbnailSizes: Optional[list[int]] = None
    # Configurable delivery providers (see app/services/settings_service.py)
    deliveryProviders: Optional[list[str]] = None


@admin_router.get("/admin/settings")
def admin_get_settings(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return settings_service.admin_get(db)


@admin_router.put("/admin/settings")
def admin_update_settings(
    body: SettingsUpdateRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return settings_service.admin_update(db, body.model_dump(exclude_none=True))
