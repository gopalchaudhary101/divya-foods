"""
Bundles router — customer-facing combo deal endpoints.

GET /bundles       → list all active bundles with resolved product details
GET /bundles/{id}  → single bundle
"""
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.dependencies import get_db, require_admin
from app.utils.mongo import get_object_id

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
    oid = get_object_id(bundle_id, "bundle")
    doc = db.bundles.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Bundle not found.")
    return {"success": True, "data": _resolve(doc, db)}


# ─── Admin ────────────────────────────────────────────────────────────────────
# Separate no-prefix router — lives under /admin/bundles. Moved here from the
# former monolithic admin.py.

admin_router = APIRouter(tags=["Admin"])


class BundleItemInput(BaseModel):
    productId: str
    quantity: int = Field(1, gt=0)


class BundleUpsertRequest(BaseModel):
    name: str
    description: str = ""
    image: Optional[str] = None
    bundlePrice: float = Field(..., gt=0)
    isActive: bool = True
    items: list[BundleItemInput]


def _bundle_list_item(doc: dict, db) -> dict:
    items = []
    for item in doc.get("items", []):
        try:
            p = db.products.find_one({"_id": ObjectId(item["product_id"])}, {"name": 1})
            name = p["name"] if p else "Unknown"
        except Exception:
            name = "Unknown"
        items.append({"productId": item["product_id"], "quantity": item["quantity"], "name": name})
    return {
        "id":          str(doc["_id"]),
        "name":        doc.get("name", ""),
        "description": doc.get("description", ""),
        "image":       doc.get("image"),
        "bundlePrice": doc.get("bundle_price", 0),
        "isActive":    doc.get("is_active", True),
        "items":       items,
    }


@admin_router.get("/admin/bundles")
def admin_list_bundles(db: Database = Depends(get_db), _admin: dict = Depends(require_admin)):
    docs = list(db.bundles.find({}).sort("created_at", -1))
    return {"success": True, "data": [_bundle_list_item(d, db) for d in docs]}


@admin_router.post("/admin/bundles", status_code=201)
def admin_create_bundle(
    body: BundleUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    doc = {
        "name":         body.name,
        "description":  body.description,
        "image":        body.image,
        "bundle_price": body.bundlePrice,
        "is_active":    body.isActive,
        "items":        [{"product_id": i.productId, "quantity": i.quantity} for i in body.items],
        "created_at":   datetime.now(timezone.utc),
    }
    result = db.bundles.insert_one(doc)
    return {"success": True, "data": {"id": str(result.inserted_id)}}


@admin_router.put("/admin/bundles/{bundle_id}")
def admin_update_bundle(
    bundle_id: str,
    body: BundleUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    oid = get_object_id(bundle_id, "bundle")
    db.bundles.update_one({"_id": oid}, {"$set": {
        "name":         body.name,
        "description":  body.description,
        "image":        body.image,
        "bundle_price": body.bundlePrice,
        "is_active":    body.isActive,
        "items":        [{"product_id": i.productId, "quantity": i.quantity} for i in body.items],
        "updated_at":   datetime.now(timezone.utc),
    }})
    return {"success": True, "data": {"id": bundle_id}}


@admin_router.delete("/admin/bundles/{bundle_id}", status_code=204)
def admin_delete_bundle(
    bundle_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    oid = get_object_id(bundle_id, "bundle")
    db.bundles.delete_one({"_id": oid})
