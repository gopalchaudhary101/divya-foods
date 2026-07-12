"""
Bulk / wholesale order request router.

POST /bulk-orders        → public — submit a wholesale/bulk quote request
GET  /admin/bulk-orders  → admin  — list requests (filter by status, paginated)
PUT  /admin/bulk-orders/{id} → admin — update status / admin notes
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, EmailStr
from pymongo.database import Database

from app.dependencies import get_db, require_admin
from app.limiter import limiter
from app.services import bulk_order_service

router = APIRouter(tags=["Bulk Orders"])


class BulkOrderItem(BaseModel):
    productName: str
    quantity: int


class BulkOrderRequestBody(BaseModel):
    company_name: Optional[str] = None
    contact_name: str
    email: EmailStr
    phone: str
    items: list[BulkOrderItem]
    message: Optional[str] = None


class BulkOrderUpdateBody(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None


@router.post("/bulk-orders")
@limiter.limit("5/minute")
def submit_bulk_order_request(request: Request, body: BulkOrderRequestBody, db: Database = Depends(get_db)):
    payload = body.model_dump()
    payload["items"] = [i.copy() if isinstance(i, dict) else i for i in payload["items"]]
    return bulk_order_service.create_request(db, payload)


@router.get("/admin/bulk-orders")
def admin_list_bulk_orders(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return bulk_order_service.admin_list_requests(db, status, page, limit)


@router.put("/admin/bulk-orders/{request_id}")
def admin_update_bulk_order(
    request_id: str,
    body: BulkOrderUpdateBody,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    payload = body.model_dump(exclude_none=True)
    return bulk_order_service.admin_update_request(db, request_id, payload)
