"""
Admin analytics — the full analytics report plus quick dashboard header stats.
Split out of the former monolithic admin.py; kept as its own file since
neither section has an existing public-facing counterpart to live alongside.

GET /admin/analytics → full analytics report (revenue trends, top products, ...)
GET /admin/stats     → dashboard header cards (counts + revenue + recent orders + low stock)
"""

from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.dependencies import get_db, require_admin
from app.services import analytics_service, order_service, product_service

router = APIRouter(tags=["Admin"])


@router.get("/admin/analytics")
def admin_analytics(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return analytics_service.get_analytics(db)


@router.get("/admin/stats")
def admin_stats(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    """Quick stats for the admin dashboard header cards."""
    total_orders    = db.orders.count_documents({})
    pending_orders  = db.orders.count_documents({"status": "pending"})
    total_products  = db.products.count_documents({})
    total_customers = db.users.count_documents({"role": "customer"})

    # Revenue from paid orders only
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "revenue": {"$sum": "$total"}}},
    ]
    rev_result = list(db.orders.aggregate(pipeline))
    total_revenue = rev_result[0]["revenue"] if rev_result else 0.0

    # Recent 5 orders
    recent = list(
        db.orders.find({})
        .sort([("created_at", -1)])
        .limit(5)
    )

    # Low-stock products — each product's own low_stock_threshold (or the
    # default of 10 if unset), not a hardcoded cutoff. Same definition the
    # daily low-stock digest email uses (product_service.get_low_stock_products).
    low_stock_raw = product_service.get_low_stock_products(db, limit=10)
    low_stock_products = [
        {
            "id":            str(p["_id"]),
            "name":          p["name"],
            "slug":          p.get("slug", ""),
            "stockQuantity": p.get("stock_quantity", 0),
            "inStock":       p.get("in_stock", True),
            "image":         (p.get("images") or [None])[0],
        }
        for p in low_stock_raw
    ]

    return {
        "success": True,
        "data": {
            "totalOrders":       total_orders,
            "pendingOrders":     pending_orders,
            "totalProducts":     total_products,
            "totalCustomers":    total_customers,
            "totalRevenue":      round(total_revenue, 2),
            "recentOrders":      [order_service._order_to_dict(o) for o in recent],
            "lowStockProducts":  low_stock_products,
        },
    }
