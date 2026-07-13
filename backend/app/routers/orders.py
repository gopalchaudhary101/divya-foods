"""
Orders router — checkout flow + order history + customer cancel.

POST /orders                    → initiate order + create Razorpay order
POST /orders/verify              → verify Razorpay signature → mark paid
GET  /orders                     → my order history (paginated)
GET  /orders/{order_id}          → single order detail
PUT  /orders/{order_id}/cancel   → customer cancels own order
GET  /orders/{order_id}/invoice  → download own order's invoice PDF
POST /orders/{order_id}/invoice/email → email own order's invoice PDF to self
POST /orders/{order_id}/return-request → request a return/refund (delivered orders only)
GET  /orders/{order_id}/return-request → check the status of your return request

Guest checkout (no account/login required):
POST /orders/guest               → initiate order as a guest
POST /orders/guest/verify        → verify Razorpay payment for a guest order
GET  /orders/guest/track         → look up a guest order by order number + email
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, EmailStr
from pymongo.database import Database

from app.dependencies import get_db, get_current_user, require_admin
from app.limiter import limiter
from app.services import order_service, return_service
from app.utils.mongo import get_object_id

router = APIRouter(prefix="/orders", tags=["Orders"])


class ReturnItemRequest(BaseModel):
    productId: str
    quantity: int


class ReturnRequestCreate(BaseModel):
    reason: str
    note: Optional[str] = ""
    items: list[ReturnItemRequest]


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
@limiter.limit("10/minute")
def initiate_order(
    request: Request,
    body: OrderInitiateRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return order_service.initiate_order(db, current_user, body.model_dump())


@router.post("/verify")
@limiter.limit("20/minute")
def verify_payment(
    request: Request,
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


@router.post("/{order_id}/return-request")
@limiter.limit("5/minute")
def request_return(
    request: Request,
    order_id: str,
    body: ReturnRequestCreate,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    items = [item.model_dump() for item in body.items]
    return return_service.create_return_request(
        db, current_user["_id"], order_id, body.reason, body.note or "", items
    )


@router.get("/{order_id}/return-request")
def get_return_request(
    order_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return return_service.get_my_return_request(db, current_user["_id"], order_id)


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
@limiter.limit("10/minute")
def initiate_guest_order(request: Request, body: GuestOrderInitiateRequest, db: Database = Depends(get_db)):
    guest_user = order_service.get_or_create_guest_user(db, body.name, body.email, body.phone)
    payload = body.model_dump(exclude={"name", "email", "phone"})
    return order_service.initiate_order(db, guest_user, payload)


@router.post("/guest/verify")
@limiter.limit("20/minute")
def verify_guest_payment(request: Request, body: GuestPaymentVerifyRequest, db: Database = Depends(get_db)):
    guest_user = db.users.find_one({"email": body.email.lower().strip()})
    if not guest_user:
        raise HTTPException(status_code=404, detail="Order not found.")
    return order_service.verify_payment(db, guest_user, body.model_dump(exclude={"email"}))


@router.get("/guest/track")
@limiter.limit("10/minute")
def track_guest_order(
    request: Request,
    order_number: str = Query(...),
    email: str = Query(...),
    db: Database = Depends(get_db),
):
    return order_service.track_guest_order(db, order_number, email)


# ─── Admin — Orders, bulk actions, returns ───────────────────────────────────
# A separate no-prefix router (rather than extending `router` above) since
# these live under /admin/... rather than /orders/... — moved here from the
# former monolithic admin.py, grouped with the customer-facing routes above
# because they're all order_service/return_service-backed.

admin_router = APIRouter(tags=["Admin"])


class StatusUpdateRequest(BaseModel):
    status: str
    note: Optional[str] = ""


class DeliveryUpsertRequest(BaseModel):
    provider: Optional[str] = None
    trackingId: Optional[str] = None
    bookingId: Optional[str] = None
    partnerName: Optional[str] = None
    driverId: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    vehicleNumber: Optional[str] = None
    vehicleType: Optional[str] = None
    deliveryCharge: Optional[float] = None
    notes: Optional[str] = None
    proofOfDeliveryUrl: Optional[str] = None
    estimatedDeliveryAt: Optional[str] = None
    deliveryStatus: Optional[str] = None
    statusNote: Optional[str] = None


@admin_router.get("/admin/orders")
def admin_list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    delivery_status: Optional[str] = Query(None, alias="deliveryStatus"),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return order_service.admin_list_orders(db, page, limit, status, search, delivery_status)


@admin_router.get("/admin/orders/{order_id}")
def admin_get_order(
    order_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return order_service.admin_get_order(db, order_id)


@admin_router.put("/admin/orders/{order_id}/status")
def admin_update_order_status(
    order_id: str,
    body: StatusUpdateRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return order_service.admin_update_status(db, order_id, body.status, body.note or "")


@admin_router.put("/admin/orders/{order_id}/delivery")
def admin_upsert_delivery(
    order_id: str,
    body: DeliveryUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return order_service.admin_upsert_delivery(db, order_id, body.model_dump(exclude_unset=True))


@admin_router.get("/admin/orders/{order_id}/invoice")
def admin_get_invoice(
    order_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    pdf_bytes, order_number = order_service.get_invoice_pdf(db, order_id, None)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="invoice-{order_number}.pdf"'},
    )


@admin_router.post("/admin/orders/{order_id}/invoice/email")
def admin_email_invoice(
    order_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return order_service.email_invoice(db, order_id, None)


class BulkStatusRequest(BaseModel):
    order_ids: list[str]
    status: str


@admin_router.put("/admin/bulk-order-status")
def admin_bulk_order_status(
    body: BulkStatusRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    valid = {"confirmed", "processing", "shipped", "delivered", "cancelled"}
    if body.status not in valid:
        raise HTTPException(status_code=422, detail=f"Status must be one of: {', '.join(valid)}")
    oids = []
    for s in body.order_ids:
        try:
            oids.append(get_object_id(s))
        except HTTPException:
            pass
    if not oids:
        raise HTTPException(status_code=400, detail="No valid order IDs provided.")
    result = db.orders.update_many(
        {"_id": {"$in": oids}},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"success": True, "data": {"updated": result.modified_count}}


@admin_router.get("/admin/export-orders")
def admin_export_orders_csv(
    status: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    import csv
    import io
    from fastapi.responses import StreamingResponse

    query: dict = {}
    if status:
        query["status"] = status

    docs = list(db.orders.find(query).sort("created_at", -1).limit(2000))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Order Number", "Customer", "Phone", "Status", "Payment", "Total (₹)", "Items", "Date"])
    for doc in docs:
        addr = doc.get("delivery_address", {})
        created = doc.get("created_at")
        writer.writerow([
            doc.get("order_number", ""),
            addr.get("full_name", ""),
            addr.get("phone", ""),
            doc.get("status", ""),
            doc.get("payment_status", ""),
            doc.get("total", 0),
            len(doc.get("items", [])),
            created.strftime("%Y-%m-%d") if created else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders.csv"},
    )


class ReturnResolveRequest(BaseModel):
    note: Optional[str] = ""


class ReturnManualApproveRequest(BaseModel):
    reference: str
    note: Optional[str] = ""


@admin_router.get("/admin/returns")
def admin_list_returns(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return return_service.admin_list_returns(db, page, limit, status, search)


@admin_router.get("/admin/returns/{return_id}")
def admin_get_return(
    return_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return return_service.admin_get_return(db, return_id)


@admin_router.put("/admin/returns/{return_id}/approve")
def admin_approve_return(
    return_id: str,
    body: ReturnResolveRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return return_service.admin_approve_return(db, return_id, body.note or "")


@admin_router.put("/admin/returns/{return_id}/approve-manual")
def admin_approve_return_manual(
    return_id: str,
    body: ReturnManualApproveRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return return_service.admin_approve_return_manual(db, return_id, body.reference, body.note or "")


@admin_router.put("/admin/returns/{return_id}/reject")
def admin_reject_return(
    return_id: str,
    body: ReturnResolveRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return return_service.admin_reject_return(db, return_id, body.note or "")
