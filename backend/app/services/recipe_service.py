"""
Recipe service — public recipe browsing + admin CRUD/bulk-import.

Product recommendations are resolved at read time via the products
collection's existing full-text index (product_text_search, see db_init.py)
rather than caching product ids on the recipe document — new products that
match a recipe's tags later automatically start showing up without needing
to re-save every recipe that could reference them.
"""

import math
import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument
from pymongo.database import Database


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _slugify(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug.strip())
    return re.sub(r'-+', '-', slug)


def _unique_slug(db: Database, base_slug: str, exclude_id: Optional[ObjectId] = None) -> str:
    slug = base_slug
    counter = 1
    while True:
        query: dict = {"slug": slug}
        if exclude_id:
            query["_id"] = {"$ne": exclude_id}
        if not db.recipes.find_one(query, {"_id": 1}):
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


def _resolve_products(db: Database, product_tags: list[str], limit: int = 4) -> list[dict]:
    """Recommend real, in-catalog products for a recipe's ingredient tags,
    reusing the products collection's existing text-search index."""
    if not product_tags:
        return []
    search_text = " ".join(product_tags)
    cursor = (
        db.products.find(
            {"$text": {"$search": search_text}, "is_published": {"$ne": False}},
            {"name": 1, "slug": 1, "price": 1, "images": 1, "in_stock": 1, "score": {"$meta": "textScore"}},
        )
        .sort([("score", {"$meta": "textScore"})])
        .limit(limit)
    )
    return [
        {
            "id":      str(p["_id"]),
            "name":    p["name"],
            "slug":    p["slug"],
            "price":   p["price"],
            "image":   (p.get("images") or [None])[0],
            "inStock": p.get("in_stock", True),
        }
        for p in cursor
    ]


def _to_dict(doc: dict, db: Optional[Database] = None, with_products: bool = False) -> dict:
    out = {
        "id":               str(doc["_id"]),
        "title":            doc["title"],
        "slug":             doc["slug"],
        "description":      doc["description"],
        "cuisine":          doc["cuisine"],
        "category":         doc["category"],
        "ingredients":      doc.get("ingredients", []),
        "steps":            doc.get("steps", []),
        "prepTimeMinutes":  doc.get("prep_time_minutes", 0),
        "cookTimeMinutes":  doc.get("cook_time_minutes", 0),
        "totalTimeMinutes": doc.get("prep_time_minutes", 0) + doc.get("cook_time_minutes", 0),
        "difficulty":       doc.get("difficulty", "Easy"),
        "servings":         doc.get("servings", 2),
        "emoji":            doc.get("emoji", "🍽️"),
        "image":            doc.get("image"),
        "tags":             doc.get("tags", []),
        "productTags":      doc.get("product_tags", []),
        "metaTitle":        doc.get("meta_title") or doc["title"],
        "metaDescription":  doc.get("meta_description") or doc["description"],
        "searchKeywords":   doc.get("search_keywords", []),
        "isPublished":      doc.get("is_published", True),
        "createdAt":        doc["created_at"].isoformat() if doc.get("created_at") else None,
        "updatedAt":        doc["updated_at"].isoformat() if doc.get("updated_at") else None,
    }
    if with_products and db is not None:
        out["recommendedProducts"] = _resolve_products(db, doc.get("product_tags", []))
    return out


# ─── Public ─────────────────────────────────────────────────────────────────

def list_recipes(
    db: Database,
    page: int = 1,
    limit: int = 12,
    cuisine: Optional[str] = None,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    query: dict = {"is_published": {"$ne": False}}
    if cuisine:
        query["cuisine"] = cuisine
    if category:
        query["category"] = category
    if difficulty:
        query["difficulty"] = difficulty
    if tag:
        query["tags"] = tag
    if search:
        query["$text"] = {"$search": search}

    skip = (page - 1) * limit
    total = db.recipes.count_documents(query)
    sort = [("score", {"$meta": "textScore"})] if search else [("created_at", -1)]
    projection = {"score": {"$meta": "textScore"}} if search else None
    cursor = db.recipes.find(query, projection).sort(sort).skip(skip).limit(limit)

    return {
        "success":    True,
        "data":       [_to_dict(d) for d in cursor],
        "total":      total,
        "page":       page,
        "limit":      limit,
        "totalPages": math.ceil(total / limit) if total else 0,
    }


def get_by_slug(db: Database, slug: str) -> dict:
    doc = db.recipes.find_one({"slug": slug, "is_published": {"$ne": False}})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found.")

    related = list(
        db.recipes.find(
            {
                "_id": {"$ne": doc["_id"]},
                "is_published": {"$ne": False},
                "$or": [{"cuisine": doc["cuisine"]}, {"category": doc["category"]}],
            }
        )
        .sort([("created_at", -1)])
        .limit(4)
    )
    return {
        "success": True,
        "data": {
            **_to_dict(doc, db=db, with_products=True),
            "relatedRecipes": [_to_dict(r) for r in related],
        },
    }


def get_filters(db: Database) -> dict:
    """Distinct cuisines/categories/difficulties currently in use — powers the
    filter UI dynamically so it keeps up automatically as more recipes are added."""
    query = {"is_published": {"$ne": False}}
    return {
        "success": True,
        "data": {
            "cuisines":     sorted(db.recipes.distinct("cuisine", query)),
            "categories":   sorted(db.recipes.distinct("category", query)),
            "difficulties": ["Easy", "Medium", "Hard"],
        },
    }


# ─── Admin ──────────────────────────────────────────────────────────────────

def admin_list_recipes(
    db: Database,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    cuisine: Optional[str] = None,
    category: Optional[str] = None,
    is_published: Optional[bool] = None,
) -> dict:
    query: dict = {}
    if cuisine:
        query["cuisine"] = cuisine
    if category:
        query["category"] = category
    if is_published is not None:
        query["is_published"] = is_published
    if search:
        safe_search = re.escape(search)
        query["title"] = {"$regex": safe_search, "$options": "i"}

    skip = (page - 1) * limit
    total = db.recipes.count_documents(query)
    docs = list(db.recipes.find(query).sort([("created_at", -1)]).skip(skip).limit(limit))

    return {
        "success":    True,
        "data":       [_to_dict(d) for d in docs],
        "total":      total,
        "page":       page,
        "limit":      limit,
        "totalPages": math.ceil(total / limit) if total else 0,
    }


def _get_oid(recipe_id: str) -> ObjectId:
    try:
        return ObjectId(recipe_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid recipe ID.")


def admin_create_recipe(db: Database, payload: dict) -> dict:
    title = payload["title"].strip()

    # Duplicate guard: same title (case-insensitive) already exists
    if db.recipes.find_one({"title": {"$regex": f"^{re.escape(title)}$", "$options": "i"}}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A recipe titled '{title}' already exists.",
        )

    base_slug = (payload.get("slug") or "").strip() or _slugify(title)
    slug = _unique_slug(db, _slugify(base_slug))

    now = _utcnow()
    doc = {
        "title":              title,
        "slug":               slug,
        "description":        payload["description"],
        "cuisine":            payload["cuisine"],
        "category":           payload["category"],
        "ingredients":        payload["ingredients"],
        "steps":              payload["steps"],
        "prep_time_minutes":  payload["prep_time_minutes"],
        "cook_time_minutes":  payload["cook_time_minutes"],
        "difficulty":         payload["difficulty"],
        "servings":           payload["servings"],
        "emoji":              payload.get("emoji") or "🍽️",
        "image":              payload.get("image"),
        "tags":               payload.get("tags") or [],
        "product_tags":       payload.get("product_tags") or [],
        "meta_title":         payload.get("meta_title"),
        "meta_description":   payload.get("meta_description"),
        "search_keywords":    payload.get("search_keywords") or [],
        "is_published":       payload.get("is_published", True),
        "created_at":         now,
        "updated_at":         now,
    }
    result = db.recipes.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"success": True, "data": _to_dict(doc)}


_UPDATE_FIELDS = {
    "title", "description", "cuisine", "category", "ingredients", "steps",
    "prep_time_minutes", "cook_time_minutes", "difficulty", "servings",
    "emoji", "image", "tags", "product_tags", "meta_title", "meta_description",
    "search_keywords", "is_published",
}


def admin_update_recipe(db: Database, recipe_id: str, payload: dict) -> dict:
    oid = _get_oid(recipe_id)
    update = {k: v for k, v in payload.items() if k in _UPDATE_FIELDS and v is not None}

    if "title" in update:
        update["title"] = update["title"].strip()
    if "slug" in payload and payload["slug"]:
        update["slug"] = _unique_slug(db, _slugify(payload["slug"]), exclude_id=oid)
    elif "title" in update:
        # title changed but slug wasn't explicitly given — leave the existing slug alone
        # (changing a live recipe's URL silently would break any external links/SEO)
        pass

    if not update:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")

    update["updated_at"] = _utcnow()
    result = db.recipes.find_one_and_update(
        {"_id": oid}, {"$set": update}, return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found.")
    return {"success": True, "data": _to_dict(result)}


def admin_delete_recipe(db: Database, recipe_id: str) -> dict:
    oid = _get_oid(recipe_id)
    result = db.recipes.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found.")
    return {"success": True, "data": {"deleted": True}}


def admin_bulk_import_recipes(db: Database, rows: list[dict]) -> dict:
    """Creates many recipes at once — the scalable path to a large recipe
    catalog instead of one API call per recipe. Skips (doesn't error on)
    titles that already exist, so the same batch can be safely re-run."""
    created = 0
    skipped: list[dict] = []
    now = _utcnow()

    for i, row in enumerate(rows, start=1):
        title = (row.get("title") or "").strip()
        if not title:
            skipped.append({"row": i, "reason": "Missing title"})
            continue
        if db.recipes.find_one({"title": {"$regex": f"^{re.escape(title)}$", "$options": "i"}}, {"_id": 1}):
            skipped.append({"row": i, "reason": f"'{title}' already exists"})
            continue

        base_slug = (row.get("slug") or "").strip() or _slugify(title)
        slug = _unique_slug(db, _slugify(base_slug))

        doc = {
            "title":              title,
            "slug":               slug,
            "description":        row["description"],
            "cuisine":            row["cuisine"],
            "category":           row["category"],
            "ingredients":        row["ingredients"],
            "steps":              row["steps"],
            "prep_time_minutes":  row["prep_time_minutes"],
            "cook_time_minutes":  row["cook_time_minutes"],
            "difficulty":         row["difficulty"],
            "servings":           row["servings"],
            "emoji":              row.get("emoji") or "🍽️",
            "image":              row.get("image"),
            "tags":               row.get("tags") or [],
            "product_tags":       row.get("product_tags") or [],
            "meta_title":         row.get("meta_title"),
            "meta_description":   row.get("meta_description"),
            "search_keywords":    row.get("search_keywords") or [],
            "is_published":       row.get("is_published", True),
            "created_at":         now,
            "updated_at":         now,
        }
        db.recipes.insert_one(doc)
        created += 1

    return {"success": True, "data": {"created": created, "skipped": len(skipped), "errors": skipped}}
