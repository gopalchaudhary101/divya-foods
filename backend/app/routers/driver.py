"""
Driver dashboard router — orders assigned to the logged-in driver only.

GET /driver/orders               → my assigned orders (paginated, filter by delivery status)
PUT /driver/orders/{id}/status   → update delivery status (+ optional proof-of-delivery URL)

Assigning a driver to an order, and everything else about a delivery record
(provider, tracking ID, vehicle, ...) stays admin-only — see PUT /admin/orders/{id}/delivery.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from pymongo.database import Database

from app.dependencies import get_db, require_driver
from app.services import order_service

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
