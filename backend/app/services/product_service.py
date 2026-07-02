"""
Product service — all product business logic.

Converts MongoDB snake_case documents to camelCase dicts that match the
frontend's TypeScript Product type exactly. No Pydantic alias magic needed.
"""

import math
import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.database import Database


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
    sort_by: str = "newest",
    search: Optional[str] = None,
) -> dict:
    """
    Paginated + filtered product list.
    Returns a dict that matches the frontend's PaginatedResponse<Product>.
    """
    query: dict = {}

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
    """Single product by URL slug. Raises 404 if not found."""
    doc = db.products.find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product '{slug}' not found.")
    return {"success": True, "data": _to_detail(doc)}


def get_featured(db: Database, limit: int = 8) -> dict:
    """Products marked is_featured=True, sorted newest first."""
    docs = list(
        db.products.find({"is_featured": True, "in_stock": True})
        .sort([("created_at", -1)])
        .limit(limit)
    )
    return {"success": True, "data": [_to_list_item(d) for d in docs]}


def get_best_sellers(db: Database, limit: int = 8) -> dict:
    """Products marked is_best_seller=True, sorted by review_count."""
    docs = list(
        db.products.find({"is_best_seller": True, "in_stock": True})
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
            {"$text": {"$search": expanded}},
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
            {"$text": {"$search": expanded}},
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
    return {
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
        "tags":          doc.get("tags", []),
        "isFeatured":    doc.get("is_featured", False),
        "isBestSeller":  doc.get("is_best_seller", False),
        "description":   doc.get("description", ""),
        "createdAt":     doc["created_at"].isoformat() if doc.get("created_at") else None,
    }


def _build_cat_map(db: Database) -> dict:
    docs = list(db.categories.find({}, {"_id": 1, "name": 1}))
    return {str(d["_id"]): d["name"] for d in docs}


def admin_list_products(
    db: Database,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    category_id: Optional[str] = None,
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
    total = db.products.count_documents(query)
    skip  = (page - 1) * limit
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
        "tags":           data.get("tags", []),
        "images":         data.get("images", []),
        "in_stock":       bool(data.get("inStock", True)),
        "stock_quantity": int(data.get("stockQuantity") or 0),
        "rating":         0.0,
        "review_count":   0,
        "is_featured":    bool(data.get("isFeatured", False)),
        "is_best_seller": bool(data.get("isBestSeller", False)),
        "created_at":     now,
        "updated_at":     now,
    }
    result   = db.products.insert_one(doc)
    doc["_id"] = result.inserted_id
    cat_map  = _build_cat_map(db)
    return {"success": True, "data": _to_admin_item(doc, cat_map)}


def admin_update_product(db: Database, product_id: str, data: dict) -> dict:
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")

    if not db.products.find_one({"_id": oid}):
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
    if "isFeatured"    in data: upd["is_featured"]    = bool(data["isFeatured"])
    if "isBestSeller"  in data: upd["is_best_seller"] = bool(data["isBestSeller"])

    db.products.update_one({"_id": oid}, {"$set": upd})
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


def admin_get_categories(db: Database) -> dict:
    docs = list(db.categories.find({}).sort([("name", 1)]))
    return {
        "success": True,
        "data": [{"id": str(d["_id"]), "name": d["name"], "slug": d.get("slug", "")} for d in docs],
    }


# ─── Public queries ───────────────────────────────────────────────────────────

def get_related(db: Database, product_id: str, limit: int = 6) -> dict:
    """
    Products in the same category as product_id, excluding that product.
    Falls back to newest products if no related found.
    """
    try:
        oid = ObjectId(product_id)
    except Exception:
        return {"success": True, "data": []}

    source = db.products.find_one({"_id": oid}, {"category_id": 1})
    if not source:
        return {"success": True, "data": []}

    docs = list(
        db.products.find(
            {"category_id": source["category_id"], "_id": {"$ne": oid}, "in_stock": True}
        )
        .sort([("rating", -1)])
        .limit(limit)
    )

    if len(docs) < limit:
        # Top up with newest products from any category
        existing_ids = {d["_id"] for d in docs} | {oid}
        extras = list(
            db.products.find({"_id": {"$nin": list(existing_ids)}, "in_stock": True})
            .sort([("created_at", -1)])
            .limit(limit - len(docs))
        )
        docs.extend(extras)

    return {"success": True, "data": [_to_list_item(d) for d in docs]}
