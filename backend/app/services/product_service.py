"""
Product service — all product business logic.

Converts MongoDB snake_case documents to camelCase dicts that match the
frontend's TypeScript Product type exactly. No Pydantic alias magic needed.
"""

import logging
import math
import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.database import Database

from app.database import get_database
from app.services import email_service
from app.utils import scheduler

logger = logging.getLogger("app.product")


# ─── Converters ──────────────────────────────────────────────────────────────

def _to_list_item(doc: dict) -> dict:
    """Lightweight product dict for listing pages."""
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "slug": doc["slug"],
        "price": doc["price"],
        "originalPrice": doc.get("original_price"),
        "images": doc.get("images", []),
        "category": str(doc.get("category_id", "")),
        "brand": doc.get("brand"),
        "origin": doc.get("origin"),
        "weight": doc.get("weight"),
        "inStock": doc.get("in_stock", True),
        "stockQuantity": doc.get("stock_quantity", 0),
        "rating": round(doc.get("rating", 0.0), 1),
        "reviewCount": doc.get("review_count", 0),
        "tags": doc.get("tags", []),
        "isFeatured": doc.get("is_featured", False),
        "isBestSeller": doc.get("is_best_seller", False),
        "createdAt": doc["created_at"].isoformat() if doc.get("created_at") else None,
    }


def _to_detail(doc: dict) -> dict:
    """Full product dict for the detail page."""
    base = _to_list_item(doc)
    base.update({
        "description": doc.get("description", ""),
        "subcategory": doc.get("subcategory"),
        "metaTitle": doc.get("meta_title"),
        "metaDescription": doc.get("meta_description"),
        "attributes": doc.get("attributes", {}),
    })
    return base


# ─── Queries ─────────────────────────────────────────────────────────────────

def get_products(
    db: Database,
    *,
    page: int = 1,
    limit: int = 12,
    category: Optional[str] = None,   # category slug
    origin: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    in_stock: Optional[bool] = None,
    min_rating: Optional[float] = None,
    sort_by: str = "newest",
    search: Optional[str] = None,
) -> dict:
    """
    Paginated + filtered product list.
    Returns a dict that matches the frontend's PaginatedResponse<Product>.
    """
    query: dict = {"is_published": {"$ne": False}}

    if search:
        query["$text"] = {"$search": search}

    if category:
        cat_doc = db.categories.find_one({"slug": category, "is_active": True})
        if cat_doc:
            query["category_id"] = cat_doc["_id"]
        else:
            # Unknown category → return empty result set
            return {"success": True, "data": [], "total": 0, "page": page, "limit": limit, "totalPages": 0}

    if origin:
        query["origin"] = origin

    price_filter: dict = {}
    if min_price is not None:
        price_filter["$gte"] = min_price
    if max_price is not None:
        price_filter["$lte"] = max_price
    if price_filter:
        query["price"] = price_filter

    if in_stock:
        query["in_stock"] = True

    if min_rating is not None:
        query["rating"] = {"$gte": min_rating}

    sort_map = {
        "price_asc":  [("price", 1)],
        "price_desc": [("price", -1)],
        "rating":     [("rating", -1)],
        "newest":     [("created_at", -1)],
        "popular":    [("review_count", -1)],
    }
    sort = sort_map.get(sort_by, [("created_at", -1)])

    total = db.products.count_documents(query)
    skip = (page - 1) * limit
    docs = list(db.products.find(query).sort(sort).skip(skip).limit(limit))

    return {
        "success": True,
        "data": [_to_list_item(d) for d in docs],
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": math.ceil(total / limit) if total else 0,
    }


def get_by_slug(db: Database, slug: str) -> dict:
    """Single product by URL slug. Raises 404 if not found. Counts as a page view
    for the 'Most/Least Viewed Products' analytics — incremented here since this is
    the only place a customer-facing product detail fetch happens."""
    doc = db.products.find_one({"slug": slug, "is_published": {"$ne": False}})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product '{slug}' not found.")
    db.products.update_one({"_id": doc["_id"]}, {"$inc": {"view_count": 1}})
    doc["view_count"] = doc.get("view_count", 0) + 1
    return {"success": True, "data": _to_detail(doc)}


def get_qr_code_png(db: Database, product_id: str) -> tuple[bytes, str]:
    """
    Generates a scannable QR code PNG pointing at the product's public page
    (for print materials, packaging, or in-store "scan to order" signage).
    Returns (png_bytes, slug) so the caller can build a friendly filename.

    Uses the `qrcode` package rather than reportlab's QrCodeWidget (which is used
    for the invoice PDF's embedded QR) because rasterizing a standalone PNG via
    reportlab's renderPM requires a Cairo backend that isn't available here —
    qrcode renders straight to a Pillow image, which is already a dependency.
    """
    from io import BytesIO

    import qrcode

    from app.config import settings

    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product ID.")

    doc = db.products.find_one({"_id": oid}, {"slug": 1})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    url = f"{settings.FRONTEND_URL.rstrip('/')}/products/{doc['slug']}"

    img = qrcode.make(url, box_size=10, border=2)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue(), doc["slug"]


def get_featured(db: Database, limit: int = 8) -> dict:
    """Products marked is_featured=True, sorted newest first."""
    docs = list(
        db.products.find({"is_featured": True, "in_stock": True, "is_published": {"$ne": False}})
        .sort([("created_at", -1)])
        .limit(limit)
    )
    return {"success": True, "data": [_to_list_item(d) for d in docs]}


def get_best_sellers(db: Database, limit: int = 8) -> dict:
    """Products marked is_best_seller=True, sorted by review_count."""
    docs = list(
        db.products.find({"is_best_seller": True, "in_stock": True, "is_published": {"$ne": False}})
        .sort([("review_count", -1)])
        .limit(limit)
    )
    return {"success": True, "data": [_to_list_item(d) for d in docs]}


# ─── Synonym map ─────────────────────────────────────────────────────────────
# When a user types one of these words we silently expand the $text query
# so the MongoDB full-text engine also scores documents containing synonyms.

_SYNONYMS: dict[str, list[str]] = {
    "fish":      ["salmon", "tuna", "fish"],
    "seafood":   ["salmon", "tuna", "prawn", "crab", "lobster", "squid"],
    "shrimp":    ["prawns", "shrimp", "vannamei", "tiger"],
    "prawn":     ["prawns", "prawn", "shrimp"],
    "calamari":  ["squid", "calamari"],
    "squid":     ["squid", "calamari"],
    "seaweed":   ["nori", "seaweed"],
    "soy":       ["soy sauce", "shoyu", "kikkoman"],
    "mayo":      ["mayonnaise", "kewpie"],
    "stock":     ["dashi", "stock", "broth"],
    "broth":     ["dashi", "stock"],
    "rice wine": ["mirin", "sake"],
    "miso":      ["miso"],
    "japanese":  ["japanese", "miso", "mirin", "nori", "dashi", "shoyu"],
    "frozen":    ["frozen", "seafood"],
    "sashimi":   ["sashimi", "salmon", "tuna", "bluefin"],
}


def _expand_query(raw: str) -> str:
    """
    Returns a whitespace-separated string of terms for $text: $search.
    Includes the original query plus any synonym expansions.
    MongoDB $text treats whitespace-separated tokens as OR-joined,
    so extra terms widen the result set and improve recall.
    """
    lower = raw.lower().strip()
    extra: set[str] = set()
    for trigger, expansions in _SYNONYMS.items():
        if trigger in lower:
            extra.update(expansions)
    if extra:
        return f"{raw} {' '.join(extra)}"
    return raw


def search_products(db: Database, query: str, limit: int = 20) -> dict:
    """
    Full-text search using the MongoDB text index.
    Field weights: name(10) > tags(5) > brand(3) > description(1).
    Synonym expansion widens recall for common aliases (fish → salmon/tuna, etc.)
    """
    if not query or len(query.strip()) < 2:
        return {"success": True, "data": []}

    expanded = _expand_query(query)
    docs = list(
        db.products.find(
            {"$text": {"$search": expanded}, "is_published": {"$ne": False}},
            {"score": {"$meta": "textScore"}},
        )
        .sort([("score", {"$meta": "textScore"})])
        .limit(limit)
    )
    return {"success": True, "data": [_to_list_item(d) for d in docs]}


def get_suggestions(db: Database, query: str, limit: int = 6) -> dict:
    """
    Lightweight autocomplete: returns only the fields the search dropdown needs.
    Uses the same synonym-expanded $text query but returns a stripped-down dict
    so the payload is tiny and the round-trip is fast.
    """
    if not query or len(query.strip()) < 1:
        return {"success": True, "data": []}

    expanded = _expand_query(query)
    docs = list(
        db.products.find(
            {"$text": {"$search": expanded}, "is_published": {"$ne": False}},
            {
                "_id": 1, "name": 1, "slug": 1,
                "price": 1, "images": 1, "brand": 1,
                "score": {"$meta": "textScore"},
            },
        )
        .sort([("score", {"$meta": "textScore"})])
        .limit(limit)
    )
    return {
        "success": True,
        "data": [
            {
                "id":    str(d["_id"]),
                "name":  d["name"],
                "slug":  d["slug"],
                "price": d["price"],
                "image": d.get("images", [None])[0],
                "brand": d.get("brand"),
            }
            for d in docs
        ],
    }


# ─── Admin helpers ───────────────────────────────────────────────────────────

def _slugify(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug.strip())
    return re.sub(r'-+', '-', slug)


def _to_admin_item(doc: dict, cat_map: dict) -> dict:
    """Full product dict for admin table — includes categoryId + categoryName."""
    cat_id = doc.get("category_id")
    item = {
        "id":            str(doc["_id"]),
        "name":          doc["name"],
        "slug":          doc["slug"],
        "price":         doc["price"],
        "originalPrice": doc.get("original_price"),
        "images":        doc.get("images", []),
        "categoryId":    str(cat_id) if cat_id else "",
        "categoryName":  cat_map.get(str(cat_id), "") if cat_id else "",
        "brand":         doc.get("brand"),
        "origin":        doc.get("origin"),
        "weight":        doc.get("weight"),
        "inStock":       doc.get("in_stock", True),
        "stockQuantity": doc.get("stock_quantity", 0),
        "rating":        round(doc.get("rating", 0.0), 1),
        "reviewCount":   doc.get("review_count", 0),
        "viewCount":     doc.get("view_count", 0),
        "tags":          doc.get("tags", []),
        "isFeatured":    doc.get("is_featured", False),
        "isBestSeller":  doc.get("is_best_seller", False),
        "isPublished":   doc.get("is_published", True),
        "description":   doc.get("description", ""),
        "createdAt":     doc["created_at"].isoformat() if doc.get("created_at") else None,
    }
    item.update(_inventory_fields(doc))
    return item


def _build_cat_map(db: Database) -> dict:
    docs = list(db.categories.find({}, {"_id": 1, "name": 1}))
    return {str(d["_id"]): d["name"] for d in docs}


# ─── Inventory ────────────────────────────────────────────────────────────────
# Stock fields beyond stock_quantity/in_stock (which already existed and are left
# untouched) — all admin-only, computed/tracked without changing the meaning of
# the two original fields. See "─── Order lifecycle: stock reserve/commit/release ───"
# below for how reserved_stock is actually kept in sync.

_INVENTORY_DEFAULTS = {
    "reserved_stock":     0,
    "incoming_stock":     0,
    "damaged_stock":      0,
    "returned_stock":     0,
    "low_stock_threshold": 10,
}


def _inventory_fields(doc: dict) -> dict:
    stock_quantity = doc.get("stock_quantity", 0)
    reserved       = doc.get("reserved_stock", 0)
    threshold      = doc.get("low_stock_threshold", _INVENTORY_DEFAULTS["low_stock_threshold"])
    available      = stock_quantity - reserved

    if available <= 0:
        stock_status = "out_of_stock"
    elif available <= threshold:
        stock_status = "low_stock"
    else:
        stock_status = "in_stock"

    return {
        "reservedStock":     reserved,
        "incomingStock":     doc.get("incoming_stock", 0),
        "damagedStock":      doc.get("damaged_stock", 0),
        "returnedStock":     doc.get("returned_stock", 0),
        "lowStockThreshold": threshold,
        "availableStock":    available,
        "stockStatus":       stock_status,
    }


def get_low_stock_products(db: Database, limit: Optional[int] = None) -> list:
    """
    Products whose available stock (stock_quantity - reserved_stock) has
    dropped to or below their own low_stock_threshold (or the default of 10
    if unset) — includes out-of-stock products too, since available<=0 is
    always <= any non-negative threshold. Shared by the admin dashboard's
    low-stock widget and the daily low-stock digest email below, so both
    always agree on which products actually count as low stock.
    """
    pipeline = [
        {"$addFields": {
            "_available": {"$subtract": ["$stock_quantity", {"$ifNull": ["$reserved_stock", 0]}]},
            "_threshold": {"$ifNull": ["$low_stock_threshold", _INVENTORY_DEFAULTS["low_stock_threshold"]]},
        }},
        {"$match": {"$expr": {"$lte": ["$_available", "$_threshold"]}}},
        {"$sort": {"_available": 1}},
    ]
    if limit:
        pipeline.append({"$limit": limit})
    return list(db.products.aggregate(pipeline))


def run_low_stock_digest_job() -> None:
    """
    Scheduler entry point (once daily) — resolves the live db handle at
    execution time, matching how the request-time get_db() dependency works.

    Cross-worker dedup: render.yaml runs 2 gunicorn workers, each running its
    own copy of this scheduler with no coordination between them, so a plain
    daily cron trigger would send the digest twice. scheduler.claim_daily_run
    handles this the same way cart_service's abandoned-cart job handles it
    (atomic Mongo claim) — just keyed by day instead of by document, since a
    digest has no natural per-item lock to grab.
    """
    db = get_database()
    if not scheduler.claim_daily_run(db, "low_stock_digest"):
        return
    try:
        products = get_low_stock_products(db)
        if products:
            email_service.admin_low_stock_digest(products)
    except Exception:  # noqa: BLE001
        logger.exception("Low-stock digest job failed")


def log_stock_movement(
    db: Database,
    product_id: ObjectId,
    movement_type: str,
    quantity_delta: int,
    resulting_stock: int,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    note: Optional[str] = None,
) -> None:
    """Append-only inventory history entry. Never edited, only ever inserted."""
    db.stock_movements.insert_one({
        "product_id":      product_id,
        "type":            movement_type,
        "quantity_delta":  quantity_delta,
        "resulting_stock": resulting_stock,
        "reference_type":  reference_type,
        "reference_id":    reference_id,
        "note":            note,
        "created_at":      datetime.now(timezone.utc),
    })


def _movement_to_dict(doc: dict) -> dict:
    return {
        "id":             str(doc["_id"]),
        "productId":      str(doc["product_id"]),
        "type":           doc["type"],
        "quantityDelta":  doc["quantity_delta"],
        "resultingStock": doc["resulting_stock"],
        "referenceType":  doc.get("reference_type"),
        "referenceId":    doc.get("reference_id"),
        "note":           doc.get("note"),
        "createdAt":      doc["created_at"].isoformat(),
    }


def admin_get_stock_history(db: Database, product_id: Optional[str] = None, page: int = 1, limit: int = 50) -> dict:
    query: dict = {}
    if product_id:
        try:
            query["product_id"] = ObjectId(product_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid product ID")

    skip  = (page - 1) * limit
    total = db.stock_movements.count_documents(query)
    docs  = list(db.stock_movements.find(query).sort([("created_at", -1)]).skip(skip).limit(limit))
    return {
        "success":    True,
        "data":       [_movement_to_dict(d) for d in docs],
        "total":      total,
        "page":       page,
        "totalPages": math.ceil(total / limit) if total else 0,
    }


def admin_adjust_stock(db: Database, product_id: str, adjustment_type: str, quantity: int, note: Optional[str] = None) -> dict:
    """Manual stock add/remove/damaged adjustment — the 'Stock Added'/'Stock Removed' triggers."""
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero.")
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")

    product = db.products.find_one({"_id": oid})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if adjustment_type == "add":
        new_stock = product.get("stock_quantity", 0) + quantity
        db.products.update_one({"_id": oid}, {"$set": {"stock_quantity": new_stock, "updated_at": datetime.now(timezone.utc)}})
        log_stock_movement(db, oid, "stock_added", quantity, new_stock, note=note)
    elif adjustment_type == "remove":
        current = product.get("stock_quantity", 0)
        if quantity > current:
            raise HTTPException(status_code=400, detail=f"Cannot remove {quantity} units — only {current} in stock.")
        new_stock = current - quantity
        db.products.update_one({"_id": oid}, {"$set": {"stock_quantity": new_stock, "updated_at": datetime.now(timezone.utc)}})
        log_stock_movement(db, oid, "stock_removed", -quantity, new_stock, note=note)
    elif adjustment_type == "damaged":
        current = product.get("stock_quantity", 0)
        if quantity > current:
            raise HTTPException(status_code=400, detail=f"Cannot mark {quantity} units damaged — only {current} in stock.")
        new_stock = current - quantity
        new_damaged = product.get("damaged_stock", 0) + quantity
        db.products.update_one(
            {"_id": oid},
            {"$set": {"stock_quantity": new_stock, "damaged_stock": new_damaged, "updated_at": datetime.now(timezone.utc)}},
        )
        log_stock_movement(db, oid, "damaged", -quantity, new_stock, note=note)
    else:
        raise HTTPException(status_code=400, detail="type must be one of: add, remove, damaged")

    updated = db.products.find_one({"_id": oid})
    cat_map = _build_cat_map(db)
    return {"success": True, "data": _to_admin_item(updated, cat_map)}


def admin_record_return(
    db: Database,
    product_id: str,
    quantity: int,
    restock: bool,
    note: Optional[str] = None,
    order_id: Optional[str] = None,
) -> dict:
    """Records a customer return — the 'Return Received' trigger. Restocking is a
    separate decision from logging the return, since a damaged returned item shouldn't
    silently become sellable stock again."""
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero.")
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")

    product = db.products.find_one({"_id": oid})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    upd = {
        "returned_stock": product.get("returned_stock", 0) + quantity,
        "updated_at":     datetime.now(timezone.utc),
    }
    new_stock = product.get("stock_quantity", 0)
    if restock:
        new_stock += quantity
        upd["stock_quantity"] = new_stock

    db.products.update_one({"_id": oid}, {"$set": upd})
    log_stock_movement(
        db, oid, "return_received", quantity if restock else 0, new_stock,
        reference_type="order" if order_id else None, reference_id=order_id,
        note=note or ("Restocked" if restock else "Not restocked (damaged/unsellable)"),
    )

    updated = db.products.find_one({"_id": oid})
    cat_map = _build_cat_map(db)
    return {"success": True, "data": _to_admin_item(updated, cat_map)}


# ─── Purchase orders (supplier / batch / expiry tracking) ─────────────────────
# A purchase moves through "ordered" (adds to the product's incoming_stock, not yet
# sellable) → "received" (incoming_stock moves into stock_quantity, logged as a
# stock movement) or "cancelled" (releases the incoming_stock reservation).

def _parse_date(value: Optional[str], field_name: str):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail=f"Invalid {field_name} date.")


def _purchase_to_dict(doc: dict) -> dict:
    return {
        "id":            str(doc["_id"]),
        "productId":     str(doc["product_id"]),
        "supplierName":  doc["supplier_name"],
        "purchaseDate":  doc["purchase_date"].isoformat() if doc.get("purchase_date") else None,
        "unitCost":      doc["unit_cost"],
        "quantity":      doc["quantity"],
        "totalCost":     round(doc["unit_cost"] * doc["quantity"], 2),
        "invoiceNumber": doc.get("invoice_number"),
        "batchNumber":   doc.get("batch_number"),
        "expiryDate":    doc["expiry_date"].isoformat() if doc.get("expiry_date") else None,
        "notes":         doc.get("notes"),
        "status":        doc["status"],
        "createdAt":     doc["created_at"].isoformat(),
        "updatedAt":     doc["updated_at"].isoformat(),
    }


def admin_list_purchases(
    db: Database,
    page: int = 1,
    limit: int = 20,
    product_id: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> dict:
    query: dict = {}
    if product_id:
        try:
            query["product_id"] = ObjectId(product_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid product ID")
    if status_filter:
        query["status"] = status_filter

    skip  = (page - 1) * limit
    total = db.purchases.count_documents(query)
    docs  = list(db.purchases.find(query).sort([("created_at", -1)]).skip(skip).limit(limit))
    return {
        "success":    True,
        "data":       [_purchase_to_dict(d) for d in docs],
        "total":      total,
        "page":       page,
        "totalPages": math.ceil(total / limit) if total else 0,
    }


def admin_create_purchase(db: Database, data: dict) -> dict:
    try:
        product_oid = ObjectId(data["productId"])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    if not db.products.find_one({"_id": product_oid}):
        raise HTTPException(status_code=404, detail="Product not found")

    supplier_name = (data.get("supplierName") or "").strip()
    if not supplier_name:
        raise HTTPException(status_code=400, detail="Supplier name is required")

    quantity = int(data.get("quantity") or 0)
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero.")

    now = datetime.now(timezone.utc)
    doc = {
        "product_id":     product_oid,
        "supplier_name":  supplier_name,
        "purchase_date":  _parse_date(data.get("purchaseDate"), "purchaseDate") or now,
        "unit_cost":      float(data.get("unitCost") or 0),
        "quantity":       quantity,
        "invoice_number": data.get("invoiceNumber") or None,
        "batch_number":   data.get("batchNumber") or None,
        "expiry_date":    _parse_date(data.get("expiryDate"), "expiryDate"),
        "notes":          data.get("notes") or None,
        "status":         "ordered",
        "created_at":     now,
        "updated_at":     now,
    }
    result = db.purchases.insert_one(doc)
    doc["_id"] = result.inserted_id

    db.products.update_one(
        {"_id": product_oid},
        {"$inc": {"incoming_stock": quantity}, "$set": {"updated_at": now}},
    )

    return {"success": True, "data": _purchase_to_dict(doc)}


def admin_update_purchase(db: Database, purchase_id: str, data: dict) -> dict:
    try:
        oid = ObjectId(purchase_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid purchase ID")

    purchase = db.purchases.find_one({"_id": oid})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if purchase["status"] != "ordered":
        raise HTTPException(status_code=400, detail=f"Cannot edit a purchase that is already '{purchase['status']}'.")

    upd: dict = {"updated_at": datetime.now(timezone.utc)}
    if "supplierName" in data and data["supplierName"] is not None:
        upd["supplier_name"] = data["supplierName"].strip()
    if "purchaseDate" in data and data["purchaseDate"] is not None:
        upd["purchase_date"] = _parse_date(data["purchaseDate"], "purchaseDate")
    if "unitCost" in data and data["unitCost"] is not None:
        upd["unit_cost"] = float(data["unitCost"])
    if "invoiceNumber" in data:
        upd["invoice_number"] = data["invoiceNumber"] or None
    if "batchNumber" in data:
        upd["batch_number"] = data["batchNumber"] or None
    if "expiryDate" in data:
        upd["expiry_date"] = _parse_date(data.get("expiryDate"), "expiryDate")
    if "notes" in data:
        upd["notes"] = data["notes"] or None

    # Quantity changes adjust the product's incoming_stock by the delta
    if "quantity" in data and data["quantity"] is not None:
        new_quantity = int(data["quantity"])
        if new_quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than zero.")
        delta = new_quantity - purchase["quantity"]
        upd["quantity"] = new_quantity
        if delta:
            db.products.update_one({"_id": purchase["product_id"]}, {"$inc": {"incoming_stock": delta}})

    db.purchases.update_one({"_id": oid}, {"$set": upd})
    updated = db.purchases.find_one({"_id": oid})
    return {"success": True, "data": _purchase_to_dict(updated)}


def admin_receive_purchase(db: Database, purchase_id: str) -> dict:
    try:
        oid = ObjectId(purchase_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid purchase ID")

    purchase = db.purchases.find_one({"_id": oid})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if purchase["status"] != "ordered":
        raise HTTPException(status_code=400, detail=f"Purchase is already '{purchase['status']}'.")

    now = datetime.now(timezone.utc)
    product = db.products.find_one({"_id": purchase["product_id"]})
    new_stock = product.get("stock_quantity", 0) + purchase["quantity"]
    new_incoming = max(0, product.get("incoming_stock", 0) - purchase["quantity"])

    db.products.update_one(
        {"_id": purchase["product_id"]},
        {"$set": {"stock_quantity": new_stock, "incoming_stock": new_incoming, "updated_at": now}},
    )
    log_stock_movement(
        db, purchase["product_id"], "purchase_received", purchase["quantity"], new_stock,
        reference_type="purchase", reference_id=str(oid),
        note=f"Received from {purchase['supplier_name']}" + (f" (batch {purchase['batch_number']})" if purchase.get("batch_number") else ""),
    )

    db.purchases.update_one({"_id": oid}, {"$set": {"status": "received", "updated_at": now}})
    updated = db.purchases.find_one({"_id": oid})
    return {"success": True, "data": _purchase_to_dict(updated)}


def admin_cancel_purchase(db: Database, purchase_id: str) -> dict:
    try:
        oid = ObjectId(purchase_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid purchase ID")

    purchase = db.purchases.find_one({"_id": oid})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if purchase["status"] != "ordered":
        raise HTTPException(status_code=400, detail=f"Cannot cancel a purchase that is already '{purchase['status']}'.")

    db.products.update_one(
        {"_id": purchase["product_id"]},
        [{"$set": {"incoming_stock": {"$max": [0, {"$subtract": [{"$ifNull": ["$incoming_stock", 0]}, purchase["quantity"]]}]}}}],
    )
    db.purchases.update_one({"_id": oid}, {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}})
    return {"success": True, "message": "Purchase order cancelled"}


def admin_list_products(
    db: Database,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    stock_status: Optional[str] = None,
) -> dict:
    query: dict = {}
    if search:
        query["$or"] = [
            {"name":        {"$regex": search, "$options": "i"}},
            {"slug":        {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if category_id:
        try:
            query["category_id"] = ObjectId(category_id)
        except Exception:
            pass

    cat_map = _build_cat_map(db)
    skip = (page - 1) * limit

    if stock_status:
        # stockStatus is computed (not stored), so filtering it needs an aggregation
        # that derives available_stock/threshold before matching, unlike the plain
        # find() path below used when no stock-status filter is requested.
        pipeline = [
            {"$match": query},
            {"$addFields": {
                "_available": {"$subtract": ["$stock_quantity", {"$ifNull": ["$reserved_stock", 0]}]},
                "_threshold": {"$ifNull": ["$low_stock_threshold", _INVENTORY_DEFAULTS["low_stock_threshold"]]},
            }},
            {"$addFields": {
                "_status": {
                    "$switch": {
                        "branches": [
                            {"case": {"$lte": ["$_available", 0]}, "then": "out_of_stock"},
                            {"case": {"$lte": ["$_available", "$_threshold"]}, "then": "low_stock"},
                        ],
                        "default": "in_stock",
                    }
                },
            }},
            {"$match": {"_status": stock_status}},
            {"$sort": {"created_at": -1}},
        ]
        all_matches = list(db.products.aggregate(pipeline))
        total = len(all_matches)
        docs = all_matches[skip: skip + limit]
    else:
        total = db.products.count_documents(query)
        docs  = list(db.products.find(query).sort([("created_at", -1)]).skip(skip).limit(limit))

    return {
        "success":    True,
        "data":       [_to_admin_item(d, cat_map) for d in docs],
        "total":      total,
        "page":       page,
        "totalPages": math.ceil(total / limit) if total else 0,
    }


def admin_create_product(db: Database, data: dict) -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Product name is required")

    slug = (data.get("slug") or "").strip() or _slugify(name)
    base, counter = slug, 1
    while db.products.find_one({"slug": slug}):
        slug = f"{base}-{counter}"
        counter += 1

    category_id = None
    if data.get("categoryId"):
        try:
            category_id = ObjectId(data["categoryId"])
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid category ID")

    now = datetime.now(timezone.utc)
    initial_stock = int(data.get("stockQuantity") or 0)
    doc = {
        "name":           name,
        "slug":           slug,
        "price":          float(data.get("price") or 0),
        "original_price": float(data["originalPrice"]) if data.get("originalPrice") else None,
        "category_id":    category_id,
        "brand":          data.get("brand") or None,
        "origin":         data.get("origin") or None,
        "weight":         data.get("weight") or None,
        "description":    data.get("description", ""),
        "tags":           data.get("tags") or [],
        "images":         data.get("images") or [],
        "in_stock":       True if data.get("inStock") is None else bool(data["inStock"]),
        "stock_quantity": initial_stock,
        "reserved_stock":      0,
        "incoming_stock":      0,
        "damaged_stock":       0,
        "returned_stock":      0,
        "low_stock_threshold": int(data["lowStockThreshold"]) if data.get("lowStockThreshold") else _INVENTORY_DEFAULTS["low_stock_threshold"],
        "rating":         0.0,
        "review_count":   0,
        "is_featured":    bool(data.get("isFeatured", False)),
        "is_best_seller": bool(data.get("isBestSeller", False)),
        "is_published":   True if data.get("isPublished") is None else bool(data["isPublished"]),
        "created_at":     now,
        "updated_at":     now,
    }
    result   = db.products.insert_one(doc)
    doc["_id"] = result.inserted_id
    log_stock_movement(db, doc["_id"], "product_created", initial_stock, initial_stock, note="Initial stock on product creation")
    cat_map  = _build_cat_map(db)
    return {"success": True, "data": _to_admin_item(doc, cat_map)}


def admin_update_product(db: Database, product_id: str, data: dict) -> dict:
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")

    existing = db.products.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    upd: dict = {"updated_at": datetime.now(timezone.utc)}

    if "name" in data:
        upd["name"] = (data["name"] or "").strip()
    if "slug" in data:
        new_slug = (data["slug"] or "").strip()
        if new_slug and db.products.find_one({"slug": new_slug, "_id": {"$ne": oid}}):
            raise HTTPException(status_code=400, detail=f"Slug '{new_slug}' is already in use")
        upd["slug"] = new_slug
    if "price" in data:
        upd["price"] = float(data["price"])
    if "originalPrice" in data:
        upd["original_price"] = float(data["originalPrice"]) if data["originalPrice"] else None
    if "categoryId" in data:
        try:
            upd["category_id"] = ObjectId(data["categoryId"]) if data["categoryId"] else None
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid category ID")
    if "brand"         in data: upd["brand"]          = data["brand"] or None
    if "origin"        in data: upd["origin"]         = data["origin"] or None
    if "weight"        in data: upd["weight"]         = data["weight"] or None
    if "description"   in data: upd["description"]    = data["description"]
    if "tags"          in data: upd["tags"]           = data["tags"]
    if "images"        in data: upd["images"]         = data["images"]
    if "inStock"       in data: upd["in_stock"]       = bool(data["inStock"])
    if "stockQuantity" in data: upd["stock_quantity"] = int(data["stockQuantity"] or 0)
    if "lowStockThreshold" in data: upd["low_stock_threshold"] = int(data["lowStockThreshold"] or 0)
    if "isFeatured"    in data: upd["is_featured"]    = bool(data["isFeatured"])
    if "isBestSeller"  in data: upd["is_best_seller"] = bool(data["isBestSeller"])
    if "isPublished"   in data: upd["is_published"]   = bool(data["isPublished"])

    db.products.update_one({"_id": oid}, {"$set": upd})

    # "Product Updated" inventory trigger — only log when stock_quantity actually changed
    if "stock_quantity" in upd and upd["stock_quantity"] != existing.get("stock_quantity", 0):
        delta = upd["stock_quantity"] - existing.get("stock_quantity", 0)
        log_stock_movement(db, oid, "manual_adjustment", delta, upd["stock_quantity"], note="Changed via product edit form")

    updated = db.products.find_one({"_id": oid})
    cat_map = _build_cat_map(db)
    return {"success": True, "data": _to_admin_item(updated, cat_map)}


def admin_delete_product(db: Database, product_id: str) -> dict:
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    result = db.products.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True, "message": "Product deleted"}


def _to_object_ids(product_ids: list[str]) -> list[ObjectId]:
    oids = []
    for s in product_ids:
        try:
            oids.append(ObjectId(s))
        except Exception:
            pass
    if not oids:
        raise HTTPException(status_code=400, detail="No valid product IDs provided.")
    return oids


def admin_bulk_update_products(db: Database, product_ids: list[str], data: dict) -> dict:
    """Applies the same partial update to many products at once (checkbox toggles, category move)."""
    oids = _to_object_ids(product_ids)

    upd: dict = {"updated_at": datetime.now(timezone.utc)}
    if "inStock"      in data: upd["in_stock"]      = bool(data["inStock"])
    if "isFeatured"   in data: upd["is_featured"]   = bool(data["isFeatured"])
    if "isBestSeller" in data: upd["is_best_seller"] = bool(data["isBestSeller"])
    if "categoryId"   in data:
        try:
            upd["category_id"] = ObjectId(data["categoryId"]) if data["categoryId"] else None
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid category ID")

    result = db.products.update_many({"_id": {"$in": oids}}, {"$set": upd})
    return {"success": True, "data": {"matched": result.matched_count, "updated": result.modified_count}}


def admin_bulk_delete_products(db: Database, product_ids: list[str]) -> dict:
    oids = _to_object_ids(product_ids)
    result = db.products.delete_many({"_id": {"$in": oids}})
    return {"success": True, "data": {"deleted": result.deleted_count}}


def admin_bulk_import_products(db: Database, rows: list[dict]) -> dict:
    """
    Creates many products from parsed CSV rows.
    Expected headers (case-sensitive): name, slug, category, price, originalPrice,
    stockQuantity, weight, origin, brand, tags, images, inStock, isFeatured,
    isBestSeller, description — same header order the /admin/products/export CSV uses,
    so an exported file can be edited and reimported directly.
    `category` matches against an existing category's name or slug (case-insensitive);
    unknown categories fail that row rather than silently creating an uncategorised product.
    """
    cat_docs = list(db.categories.find({}, {"_id": 1, "name": 1, "slug": 1}))
    cat_by_name = {c["name"].strip().lower(): c["_id"] for c in cat_docs}
    cat_by_slug = {c["slug"].strip().lower(): c["_id"] for c in cat_docs if c.get("slug")}

    def _truthy(val: Optional[str]) -> bool:
        return (val or "").strip().lower() in {"true", "1", "yes"}

    created = 0
    errors: list[dict] = []
    now = datetime.now(timezone.utc)

    for i, row in enumerate(rows, start=2):  # row 1 is the header line
        name = (row.get("name") or "").strip()
        if not name:
            errors.append({"row": i, "reason": "Missing product name"})
            continue

        try:
            price = float(row.get("price") or 0)
        except ValueError:
            errors.append({"row": i, "reason": f"Invalid price '{row.get('price')}'"})
            continue

        category_id = None
        category_key = (row.get("category") or "").strip().lower()
        if category_key:
            category_id = cat_by_name.get(category_key) or cat_by_slug.get(category_key)
            if not category_id:
                errors.append({"row": i, "reason": f"Unknown category '{row.get('category')}'"})
                continue

        slug = (row.get("slug") or "").strip() or _slugify(name)
        base, counter = slug, 1
        while db.products.find_one({"slug": slug}):
            slug = f"{base}-{counter}"
            counter += 1

        try:
            original_price = float(row["originalPrice"]) if row.get("originalPrice") else None
        except ValueError:
            errors.append({"row": i, "reason": f"Invalid originalPrice '{row.get('originalPrice')}'"})
            continue

        try:
            stock_quantity = int(row["stockQuantity"]) if row.get("stockQuantity") else 0
        except ValueError:
            errors.append({"row": i, "reason": f"Invalid stockQuantity '{row.get('stockQuantity')}'"})
            continue

        doc = {
            "name":            name,
            "slug":            slug,
            "price":           price,
            "original_price":  original_price,
            "category_id":     category_id,
            "brand":           row.get("brand") or None,
            "origin":          row.get("origin") or None,
            "weight":          row.get("weight") or None,
            "description":     row.get("description") or "",
            "tags":            [t.strip() for t in (row.get("tags") or "").split(",") if t.strip()],
            "images":          [u.strip() for u in (row.get("images") or "").split(",") if u.strip()],
            "in_stock":        _truthy(row.get("inStock")) if row.get("inStock") is not None and row.get("inStock") != "" else True,
            "stock_quantity":  stock_quantity,
            "rating":          0.0,
            "review_count":    0,
            "is_featured":     _truthy(row.get("isFeatured")),
            "is_best_seller":  _truthy(row.get("isBestSeller")),
            "created_at":      now,
            "updated_at":      now,
        }
        db.products.insert_one(doc)
        created += 1

    return {"success": True, "data": {"created": created, "skipped": len(errors), "errors": errors}}


def admin_get_categories(db: Database) -> dict:
    docs = list(db.categories.find({}).sort([("name", 1)]))
    return {
        "success": True,
        "data": [{"id": str(d["_id"]), "name": d["name"], "slug": d.get("slug", "")} for d in docs],
    }


# ─── Public queries ───────────────────────────────────────────────────────────

def _get_co_purchased_ids(db: Database, oid: ObjectId, limit: int) -> list:
    """
    Product IDs that most often appear in the same order as `oid`, ranked by
    how many distinct paid orders they co-occurred in — a real "customers who
    bought this also bought that" signal. Only paid orders count; an item
    sitting in the same abandoned/failed cart as another isn't a purchase
    signal, just coincidence.
    """
    pipeline = [
        {"$match": {"payment_status": "paid", "items.product_id": oid}},
        {"$unwind": "$items"},
        {"$match": {"items.product_id": {"$ne": oid}}},
        {"$group": {"_id": "$items.product_id", "orders": {"$sum": 1}}},
        {"$sort": {"orders": -1}},
        {"$limit": limit},
    ]
    return [row["_id"] for row in db.orders.aggregate(pipeline)]


def get_related(db: Database, product_id: str, limit: int = 6) -> dict:
    """
    Recommendations for a product page, blending three signals in priority
    order, deduplicated and capped at `limit` total:
      1. Frequently bought together — real behavioral signal from paid orders.
      2. Same category (content-based).
      3. Newest products site-wide — last-resort fallback.
    A product with no purchase history yet (e.g. brand new) falls straight
    through to (2) then (3), exactly as before this signal was added.
    """
    try:
        oid = ObjectId(product_id)
    except Exception:
        return {"success": True, "data": []}

    source = db.products.find_one({"_id": oid}, {"category_id": 1})
    if not source:
        return {"success": True, "data": []}

    seen = {oid}
    docs = []

    # 1. Frequently bought together
    co_ids = _get_co_purchased_ids(db, oid, limit)
    if co_ids:
        co_docs_by_id = {
            d["_id"]: d for d in db.products.find(
                {"_id": {"$in": co_ids}, "in_stock": True, "is_published": {"$ne": False}}
            )
        }
        for pid in co_ids:  # preserve co-purchase frequency order, not $in's arbitrary order
            if pid in co_docs_by_id:
                docs.append(co_docs_by_id[pid])
                seen.add(pid)

    # 2. Same category, topping up whatever slots are left
    if len(docs) < limit:
        category_docs = list(
            db.products.find(
                {"category_id": source["category_id"], "_id": {"$nin": list(seen)}, "in_stock": True, "is_published": {"$ne": False}}
            )
            .sort([("rating", -1)])
            .limit(limit - len(docs))
        )
        docs.extend(category_docs)
        seen.update(d["_id"] for d in category_docs)

    # 3. Newest site-wide, last-resort fallback
    if len(docs) < limit:
        extras = list(
            db.products.find({"_id": {"$nin": list(seen)}, "in_stock": True, "is_published": {"$ne": False}})
            .sort([("created_at", -1)])
            .limit(limit - len(docs))
        )
        docs.extend(extras)

    return {"success": True, "data": [_to_list_item(d) for d in docs[:limit]]}
