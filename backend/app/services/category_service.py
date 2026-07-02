"""Category service — business logic for category queries."""

from fastapi import HTTPException, status
from pymongo.database import Database


def _to_dict(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "slug": doc["slug"],
        "description": doc.get("description"),
        "image": doc.get("image", ""),
        "parentId": str(doc["parent_id"]) if doc.get("parent_id") else None,
        "productCount": doc.get("product_count", 0),
        "order": doc.get("order", 0),
        "isActive": doc.get("is_active", True),
    }


def get_all(db: Database) -> dict:
    """All active categories sorted by display order."""
    docs = list(db.categories.find({"is_active": True}).sort([("order", 1), ("name", 1)]))
    return {"success": True, "data": [_to_dict(d) for d in docs]}


def get_by_slug(db: Database, slug: str) -> dict:
    doc = db.categories.find_one({"slug": slug, "is_active": True})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Category '{slug}' not found.")
    return {"success": True, "data": _to_dict(doc)}
