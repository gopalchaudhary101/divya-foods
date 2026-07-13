"""
Driver accounts — a lightweight staff role (role="driver") created by an admin,
not through public registration. A driver logs in like any other user and only
ever sees/updates orders assigned to them (see order_service.driver_list_orders /
driver_update_delivery_status).
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.utils.mongo import get_object_id

from app.utils.security import hash_password


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_dict(doc: dict) -> dict:
    return {
        "id":        str(doc["_id"]),
        "name":      doc["name"],
        "email":     doc["email"],
        "phone":     doc.get("phone"),
        "isActive":  doc.get("is_active", True),
        "createdAt": doc["created_at"].isoformat(),
    }


def admin_create_driver(db: Database, payload: dict) -> dict:
    email = payload["email"].lower().strip()
    if db.users.find_one({"email": email}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    now = _utcnow()
    doc = {
        "name":                 payload["name"].strip(),
        "email":                email,
        "phone":                payload.get("phone"),
        "password_hash":        hash_password(payload["password"]),
        "role":                 "driver",
        "avatar":               None,
        "is_active":            True,
        "is_email_verified":    False,
        "refresh_token":        None,
        "reset_token":          None,
        "reset_token_expires":  None,
        "created_at":           now,
        "updated_at":           now,
    }
    try:
        result = db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    doc["_id"] = result.inserted_id
    return {"success": True, "data": _to_dict(doc)}


def admin_list_drivers(db: Database) -> dict:
    docs = list(db.users.find({"role": "driver"}).sort([("created_at", -1)]))
    return {"success": True, "data": [_to_dict(d) for d in docs]}


def admin_set_driver_active(db: Database, driver_id: str, is_active: bool) -> dict:
    oid = get_object_id(driver_id, "driver")

    result = db.users.find_one_and_update(
        {"_id": oid, "role": "driver"},
        {"$set": {"is_active": is_active, "updated_at": _utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found.")
    return {"success": True, "data": _to_dict(result)}
