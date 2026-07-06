"""Banner service — business logic for the homepage carousel and admin CRUD."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument
from pymongo.database import Database


def _to_dict(doc: dict) -> dict:
    return {
        "id":       str(doc["_id"]),
        "title":    doc["title"],
        "subtitle": doc.get("subtitle"),
        "image":    doc["image"],
        "link":     doc.get("link"),
        "isActive": doc.get("is_active", True),
        "order":    doc.get("order", 0),
    }


def get_active(db: Database) -> dict:
    """Active banners sorted by display order, for the homepage carousel."""
    docs = list(db.banners.find({"is_active": True}).sort([("order", 1)]))
    return {"success": True, "data": [_to_dict(d) for d in docs]}


def admin_list(db: Database) -> dict:
    """All banners, active or not, for the admin management screen."""
    docs = list(db.banners.find({}).sort([("order", 1)]))
    return {"success": True, "data": [_to_dict(d) for d in docs]}


def admin_create(db: Database, payload: dict) -> dict:
    now = datetime.now(timezone.utc)
    doc = {
        "title":      payload["title"],
        "subtitle":   payload.get("subtitle"),
        "image":      payload["image"],
        "link":       payload.get("link"),
        "is_active":  payload.get("is_active", True),
        "order":      payload.get("order", 0),
        "created_at": now,
    }
    result = db.banners.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"success": True, "data": _to_dict(doc)}


def _get_oid(banner_id: str) -> ObjectId:
    try:
        return ObjectId(banner_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid banner ID.")


def admin_update(db: Database, banner_id: str, payload: dict) -> dict:
    oid = _get_oid(banner_id)

    field_map = {
        "title": "title", "subtitle": "subtitle", "image": "image",
        "link": "link", "is_active": "is_active", "order": "order",
    }
    update = {field_map[k]: v for k, v in payload.items() if k in field_map}
    if not update:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")

    result = db.banners.find_one_and_update(
        {"_id": oid}, {"$set": update}, return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Banner not found.")
    return {"success": True, "data": _to_dict(result)}


def admin_delete(db: Database, banner_id: str) -> dict:
    oid = _get_oid(banner_id)
    result = db.banners.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Banner not found.")
    return {"success": True, "data": {"deleted": True}}
