"""
Driver dashboard router — orders assigned to the logged-in driver only.

GET /driver/orders               → my assigned orders (paginated, filter by delivery status)
PUT /driver/orders/{id}/status   → update delivery status (+ optional proof-of-delivery URL)

Assigning a driver to an order, and everything else about a delivery record
(provider, tracking ID, vehicle, ...) stays admin-only — see PUT /admin/orders/{id}/delivery.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, EmailStr
from pymongo.database import Database

from app.dependencies import get_db, require_driver, require_admin
from app.services import order_service, driver_service

router = APIRouter(prefix="/driver", tags=["Driver"])


@router.get("/orders")
def list_my_orders(
    status: Optional[str] = Query(None, alias="deliveryStatus"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_driver),
):
    return order_service.driver_list_orders(db, current_user["_id"], status, page, limit)


class DriverStatusUpdateRequest(BaseModel):
    deliveryStatus: str
    note: Optional[str] = None
    proofOfDeliveryUrl: Optional[str] = None


@router.put("/orders/{order_id}/status")
def update_delivery_status(
    order_id: str,
    body: DriverStatusUpdateRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_driver),
):
    return order_service.driver_update_delivery_status(
        db, current_user["_id"], order_id, body.deliveryStatus, body.note, body.proofOfDeliveryUrl,
    )


# ─── Admin — driver account management ───────────────────────────────────────
# Separate no-prefix router — lives under /admin/drivers (an admin managing
# driver accounts, distinct from a driver's own /driver/* self-service above).
# Moved here from the former monolithic admin.py.

admin_router = APIRouter(tags=["Admin"])


class DriverCreateRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str


class DriverActiveRequest(BaseModel):
    is_active: bool


@admin_router.post("/admin/drivers")
def admin_create_driver(
    body: DriverCreateRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return driver_service.admin_create_driver(db, body.model_dump())


@admin_router.get("/admin/drivers")
def admin_list_drivers(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return driver_service.admin_list_drivers(db)


@admin_router.put("/admin/drivers/{driver_id}/active")
def admin_set_driver_active(
    driver_id: str,
    body: DriverActiveRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return driver_service.admin_set_driver_active(db, driver_id, body.is_active)
