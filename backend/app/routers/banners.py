from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from pymongo.database import Database

from app.dependencies import get_db, require_admin
from app.services import banner_service

router = APIRouter(prefix="/banners", tags=["Banners"])


@router.get("", summary="Active banners for the homepage carousel")
def get_active_banners(db: Database = Depends(get_db)):
    return banner_service.get_active(db)


# ─── Admin ────────────────────────────────────────────────────────────────────
# Separate no-prefix router — lives under /admin/banners. Moved here from the
# former monolithic admin.py.

admin_router = APIRouter(tags=["Admin"])


class BannerUpsertRequest(BaseModel):
    title: str
    subtitle: Optional[str] = None
    image: str
    link: Optional[str] = None
    isActive: bool = True
    order: int = 0


@admin_router.get("/admin/banners")
def admin_list_banners(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return banner_service.admin_list(db)


@admin_router.post("/admin/banners")
def admin_create_banner(
    body: BannerUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return banner_service.admin_create(db, {
        "title":     body.title,
        "subtitle":  body.subtitle,
        "image":     body.image,
        "link":      body.link,
        "is_active": body.isActive,
        "order":     body.order,
    })


@admin_router.put("/admin/banners/{banner_id}")
def admin_update_banner(
    banner_id: str,
    body: BannerUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return banner_service.admin_update(db, banner_id, {
        "title":     body.title,
        "subtitle":  body.subtitle,
        "image":     body.image,
        "link":      body.link,
        "is_active": body.isActive,
        "order":     body.order,
    })


@admin_router.delete("/admin/banners/{banner_id}")
def admin_delete_banner(
    banner_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return banner_service.admin_delete(db, banner_id)
