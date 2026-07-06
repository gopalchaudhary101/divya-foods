"""
Orders router — checkout flow + order history + customer cancel.

POST /orders                    → initiate order + create Razorpay order
POST /orders/verify              → verify Razorpay signature → mark paid
GET  /orders                     → my order history (paginated)
GET  /orders/{order_id}          → single order detail
PUT  /orders/{order_id}/cancel   → customer cancels own order
GET  /orders/{order_id}/invoice  → download own order's invoice PDF
POST /orders/{order_id}/invoice/email → email own order's invoice PDF to self

Guest checkout (no account/login required):
POST /orders/guest               → initiate order as a guest
POST /orders/guest/verify        → verify Razorpay payment for a guest order
GET  /orders/guest/track         → look up a guest order by order number + email
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, EmailStr
from pymongo.database import Database

from app.dependencies import get_db, get_current_user
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["Orders"])


class OrderInitiateRequest(BaseModel):
    delivery_address_id: Optional[str] = None
    delivery_address: Optional[dict] = None
    payment_method: str = "razorpay"
    coupon_code: Optional[str] = None
    gift_card_code: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[list] = None
    delivery_slot: Optional[dict] = None


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


@router.get("/{order_id}/invoice")
def get_invoice(
    order_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    pdf_bytes, order_number = order_service.get_invoice_pdf(db, order_id, current_user["_id"])
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="invoice-{order_number}.pdf"'},
    )


@router.post("/{order_id}/invoice/email")
def email_invoice(
    order_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return order_service.email_invoice(db, order_id, current_user["_id"])


# ─── Guest checkout ─────────────────────────────────────────────────────────────
# Reuses the exact same initiate_order/verify_payment logic as the authenticated
# flow above — a guest is just an ephemeral user record looked up/created by email,
# so none of the tested checkout/payment/stock-reservation logic is duplicated.

class GuestOrderInitiateRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    delivery_address: dict
    payment_method: str = "razorpay"
    coupon_code: Optional[str] = None
    gift_card_code: Optional[str] = None
    notes: Optional[str] = None
    items: list
    delivery_slot: Optional[dict] = None


class GuestPaymentVerifyRequest(BaseModel):
    order_id: str
    email: EmailStr
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/guest")
def initiate_guest_order(body: GuestOrderInitiateRequest, db: Database = Depends(get_db)):
    guest_user = order_service.get_or_create_guest_user(db, body.name, body.email, body.phone)
    payload = body.model_dump(exclude={"name", "email", "phone"})
    return order_service.initiate_order(db, guest_user, payload)


@router.post("/guest/verify")
def verify_guest_payment(body: GuestPaymentVerifyRequest, db: Database = Depends(get_db)):
    guest_user = db.users.find_one({"email": body.email.lower().strip()})
    if not guest_user:
        raise HTTPException(status_code=404, detail="Order not found.")
    return order_service.verify_payment(db, guest_user, body.model_dump(exclude={"email"}))


@router.get("/guest/track")
def track_guest_order(
    order_number: str = Query(...),
    email: str = Query(...),
    db: Database = Depends(get_db),
):
    return order_service.track_guest_order(db, order_number, email)
