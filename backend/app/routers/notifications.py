"""
Notifications router.

Push subscriptions:
  POST   /notifications/subscribe        → save browser PushSubscription
  DELETE /notifications/subscribe        → remove subscription

In-app notifications:
  GET    /notifications                  → list user's notifications (latest 20)
  GET    /notifications/unread-count     → count of unread
  POST   /notifications/read-all        → mark all as read
"""

from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from pymongo.database import Database

from app.dependencies import get_db, get_current_user
from app.utils import push_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ─── Push subscription endpoints ─────────────────────────────────────────────

class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: SubscriptionKeys
    expirationTime: Optional[float] = None


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.post("/subscribe", status_code=204)
def subscribe_push(
    body: PushSubscribeRequest,
    request: Request,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_agent = request.headers.get("user-agent", "")
    push_service.save_subscription(
        db,
        user_id=current_user["_id"],
        endpoint=body.endpoint,
        keys={"p256dh": body.keys.p256dh, "auth": body.keys.auth},
        user_agent=user_agent,
    )


@router.delete("/subscribe", status_code=204)
def unsubscribe_push(
    body: UnsubscribeRequest,
    db: Database = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    push_service.remove_subscription(db, body.endpoint)


# ─── In-app notification endpoints ───────────────────────────────────────────

def _notif_to_dict(doc: dict) -> dict:
    return {
        "id":         str(doc["_id"]),
        "type":       doc.get("type", "system"),
        "title":      doc.get("title", ""),
        "message":    doc.get("message", ""),
        "is_read":    doc.get("is_read", False),
        "data":       doc.get("data", {}),
        "created_at": doc.get("created_at", datetime.now(timezone.utc)).isoformat(),
    }


@router.get("")
def list_notifications(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    docs = list(
        db.notifications
        .find({"user_id": current_user["_id"]})
        .sort("created_at", -1)
        .limit(20)
    )
    return {"success": True, "data": [_notif_to_dict(d) for d in docs]}


@router.get("/unread-count")
def unread_count(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    count = db.notifications.count_documents(
        {"user_id": current_user["_id"], "is_read": False}
    )
    return {"success": True, "data": count}


@router.post("/read-all", status_code=204)
def mark_all_read(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    db.notifications.update_many(
        {"user_id": current_user["_id"], "is_read": False},
        {"$set": {"is_read": True}},
    )
