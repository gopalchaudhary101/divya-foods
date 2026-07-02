"""
Orders router — checkout flow + order history + customer cancel.

POST /orders                → initiate order + create Razorpay order
POST /orders/verify         → verify Razorpay signature → mark paid
GET  /orders                → my order history (paginated)
GET  /orders/{order_id}     → single order detail
PUT  /orders/{order_id}/cancel → customer cancels own order
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from pymongo.database import Database
from pydantic import BaseModel

from app.dependencies import get_db, get_current_user
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["Orders"])


class OrderInitiateRequest(BaseModel):
    delivery_address_id: Optional[str] = None
    delivery_address: Optional[dict] = None
    payment_method: str = "razorpay"
    coupon_code: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[list] = None


class PaymentVerifyRequest(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class CancelRequest(BaseModel):
    reason: Optional[str] = ""


@router.post("")
def initiate_order(
    body: OrderInitiateRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return order_service.initiate_order(db, current_user, body.model_dump())


@router.post("/verify")
def verify_payment(
    body: PaymentVerifyRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return order_service.verify_payment(db, current_user, body.model_dump())


@router.get("")
def list_my_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return order_service.get_my_orders(db, current_user["_id"], page, limit)


@router.get("/{order_id}")
def get_order(
    order_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return order_service.get_order_by_id(db, current_user["_id"], order_id)


@router.put("/{order_id}/cancel")
def cancel_order(
    order_id: str,
    body: CancelRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return order_service.cancel_order(db, current_user["_id"], order_id, body.reason or "")
