"""
Payment gateway webhooks — public, unauthenticated (verified by signature
instead of a JWT). This is the authoritative, server-to-server confirmation
path for Razorpay events; see order_service.handle_razorpay_webhook for the
event-by-event logic.

POST /webhooks/razorpay → Razorpay event delivery
"""

import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pymongo.database import Database

from app.dependencies import get_db
from app.services import order_service

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(default=""),
    db: Database = Depends(get_db),
):
    # Signature is computed over the exact raw bytes Razorpay sent — must read
    # the body before any parsing, and must not re-serialize it for verification.
    raw_body = await request.body()

    if not order_service.verify_webhook_signature(raw_body, x_razorpay_signature):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature.")

    try:
        event = json.loads(raw_body)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed webhook payload.")

    return order_service.handle_razorpay_webhook(db, event)
