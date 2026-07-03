"""
Flash sales router — time-limited discounted products.

GET /flash-sales  → products with an active sale_price + sale_ends_at in the future
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.dependencies import get_db

router = APIRouter(prefix="/flash-sales", tags=["Flash Sales"])


def _sale_item(doc: dict) -> dict:
    return {
        "id":          str(doc["_id"]),
        "name":        doc["name"],
        "slug":        doc["slug"],
        "price":       doc["price"],
        "salePrice":   doc.get("sale_price"),
        "saleEndsAt":  doc["sale_ends_at"].isoformat() if doc.get("sale_ends_at") else None,
        "images":      doc.get("images", []),
        "brand":       doc.get("brand"),
        "rating":      round(doc.get("rating", 0.0), 1),
        "reviewCount": doc.get("review_count", 0),
        "inStock":     doc.get("in_stock", True),
        "stockQuantity": doc.get("stock_quantity", 0),
    }


@router.get("")
def list_flash_sales(db: Database = Depends(get_db)):
    now = datetime.now(timezone.utc)
    docs = list(
        db.products.find(
            {
                "sale_price":   {"$exists": True, "$ne": None},
                "sale_ends_at": {"$gt": now},
                "in_stock":     True,
            }
        ).sort("sale_ends_at", 1)
    )
    return {"success": True, "data": [_sale_item(d) for d in docs]}
