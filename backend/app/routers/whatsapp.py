"""
WhatsApp integration — public endpoints + Cloud API webhook.

GET  /whatsapp/config       → click-to-chat button config (phone + templates)
POST /whatsapp/track-share  → log a share-button click for admin analytics
GET  /whatsapp/webhook      → Meta's one-time webhook verification handshake
POST /whatsapp/webhook      → inbound customer messages (signature-verified)

Admin config/analytics routes are in admin_router below, under /admin/whatsapp.
"""

import json
import logging
import threading

from fastapi import APIRouter, Depends, Query, Request, Response, status
from pymongo.database import Database

from app.dependencies import get_db, require_admin
from app.limiter import limiter
from app.models.whatsapp import TrackShareRequest, WhatsAppConfigUpdate
from app.services import whatsapp_service

logger = logging.getLogger("app.whatsapp")

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


@router.get("/config")
def get_config(db: Database = Depends(get_db)):
    return whatsapp_service.get_public_config(db)


@router.post("/track-share")
@limiter.limit("30/minute")
def track_share(request: Request, body: TrackShareRequest, db: Database = Depends(get_db)):
    return whatsapp_service.track_share(db, body.productId, body.productName, body.source)


@router.get("/webhook")
def verify_webhook(
    hub_mode: str = Query(default="", alias="hub.mode"),
    hub_verify_token: str = Query(default="", alias="hub.verify_token"),
    hub_challenge: str = Query(default="", alias="hub.challenge"),
):
    challenge = whatsapp_service.verify_webhook_challenge(hub_mode, hub_verify_token, hub_challenge)
    if challenge is None:
        return Response(status_code=status.HTTP_403_FORBIDDEN)
    return Response(content=challenge, media_type="text/plain")


@router.post("/webhook")
async def receive_webhook(request: Request, db: Database = Depends(get_db)):
    # Signature is computed over the exact raw bytes Meta sent — same care as
    # the Razorpay webhook (see app/routers/webhooks.py).
    raw_body = await request.body()
    signature = request.headers.get("x-hub-signature-256", "")

    if not whatsapp_service.verify_webhook_signature(raw_body, signature):
        # Meta expects a fast, plain 200 even for traffic we choose not to
        # trust, so it doesn't retry — we just don't act on unverified payloads.
        logger.warning("Rejected WhatsApp webhook with invalid/missing signature.")
        return {"success": True}

    try:
        payload = json.loads(raw_body)
    except ValueError:
        return {"success": True}

    for from_number, text in whatsapp_service.parse_incoming_messages(payload):
        # Respond to Meta immediately; the actual Graph API reply call is slow
        # network I/O, dispatched the same way outbound emails are (see
        # email_service.send_async) — a daemon thread sharing the process-wide
        # MongoClient, which pymongo explicitly supports across threads.
        threading.Thread(
            target=whatsapp_service.handle_incoming_message,
            args=(db, from_number, text),
            daemon=True,
        ).start()

    return {"success": True}


# ─── Admin ────────────────────────────────────────────────────────────────────
# Separate no-prefix router — lives under /admin/whatsapp. Moved here from the
# former monolithic admin.py.

admin_router = APIRouter(tags=["Admin"])


@admin_router.get("/admin/whatsapp/config")
def admin_get_whatsapp_config(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return whatsapp_service.admin_get_config(db)


@admin_router.put("/admin/whatsapp/config")
def admin_update_whatsapp_config(
    body: WhatsAppConfigUpdate,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return whatsapp_service.admin_update_config(db, body.model_dump(exclude_unset=True))


@admin_router.get("/admin/whatsapp/analytics")
def admin_get_whatsapp_analytics(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return whatsapp_service.get_share_analytics(db)
