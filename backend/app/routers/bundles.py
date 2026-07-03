"""
Bundles router — customer-facing combo deal endpoints.

GET /bundles       → list all active bundles with resolved product details
GET /bundles/{id}  → single bundle
"""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from app.dependencies import get_db

router = APIRouter(prefix="/bundles", tags=["Bundles"])


def _resolve(doc: dict, db: Database) -> dict:
    items = []
    for item in doc.get("items", []):
        try:
            p = db.products.find_one(
                {"_id": ObjectId(item["product_id"])},
                {"name": 1, "images": 1, "price": 1, "slug": 1},
            )
        except Exception:
            p = None
        items.append({
            "productId": item["product_id"],
            "quantity":  item.get("quantity", 1),
            "name":      p["name"] if p else "Unknown",
            "image":     (p.get("images") or [None])[0] if p else None,
            "price":     p.get("price", 0) if p else 0,
            "slug":      p.get("slug", "") if p else "",
        })
    created = doc.get("created_at")
    return {
        "id":          str(doc["_id"]),
        "name":        doc.get("name", ""),
        "description": doc.get("description", ""),
        "image":       doc.get("image"),
        "bundlePrice": doc.get("bundle_price", 0),
        "isActive":    doc.get("is_active", True),
        "items":       items,
        "createdAt":   created.isoformat() if created else "",
    }


@router.get("")
def list_bundles(db: Database = Depends(get_db)):
    docs = list(db.bundles.find({"is_active": True}).sort("created_at", -1))
    return {"success": True, "data": [_resolve(d, db) for d in docs]}


@router.get("/{bundle_id}")
def get_bundle(bundle_id: str, db: Database = Depends(get_db)):
    try:
        oid = ObjectId(bundle_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid bundle ID.")
    doc = db.bundles.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Bundle not found.")
    return {"success": True, "data": _resolve(doc, db)}
