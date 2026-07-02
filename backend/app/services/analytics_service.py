"""
Analytics service — MongoDB aggregation pipelines for the admin dashboard.
All queries hit paid orders only for revenue figures.
"""

from datetime import datetime, timezone, timedelta

from pymongo.database import Database


def get_analytics(db: Database) -> dict:
    now             = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # ── 1. Daily revenue + order count for last 30 days ───────────────────────
    daily_revenue = list(db.orders.aggregate([
        {"$match": {"payment_status": "paid", "created_at": {"$gte": thirty_days_ago}}},
        {"$group": {
            "_id":     {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "revenue": {"$sum": "$total"},
            "orders":  {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]))

    # ── 2. Order count by status ──────────────────────────────────────────────
    orders_by_status = list(db.orders.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))

    # ── 3. Top 10 products by units sold (paid orders only) ───────────────────
    top_products = list(db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$unwind": "$items"},
        {"$group": {
            "_id":     "$items.product_id",
            "name":    {"$first": "$items.name"},
            "units":   {"$sum": "$items.quantity"},
            "revenue": {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}},
        }},
        {"$sort": {"units": -1}},
        {"$limit": 10},
    ]))

    # ── 4. Revenue by category ────────────────────────────────────────────────
    revenue_by_category = list(db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$unwind": "$items"},
        # Join items → products
        {"$lookup": {
            "from":         "products",
            "localField":   "items.product_id",
            "foreignField": "_id",
            "as":           "product",
        }},
        {"$unwind": {"path": "$product", "preserveNullAndEmptyArrays": True}},
        # Join products → categories
        {"$lookup": {
            "from":         "categories",
            "localField":   "product.category_id",
            "foreignField": "_id",
            "as":           "category",
        }},
        {"$unwind": {"path": "$category", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id":     "$category.name",
            "revenue": {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}},
            "units":   {"$sum": "$items.quantity"},
        }},
        {"$sort": {"revenue": -1}},
    ]))

    # ── 5. Key metrics ────────────────────────────────────────────────────────
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)

    this_month_orders  = db.orders.count_documents({"created_at": {"$gte": this_month_start}})
    last_month_orders  = db.orders.count_documents(
        {"created_at": {"$gte": last_month_start, "$lt": this_month_start}}
    )
    this_month_revenue_agg = list(db.orders.aggregate([
        {"$match": {"payment_status": "paid", "created_at": {"$gte": this_month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]))
    this_month_revenue = round(this_month_revenue_agg[0]["total"], 2) if this_month_revenue_agg else 0.0

    avg_agg = list(db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "avg": {"$avg": "$total"}}},
    ]))
    avg_order_value = round(avg_agg[0]["avg"], 2) if avg_agg else 0.0

    return {
        "success": True,
        "data": {
            "dailyRevenue": [
                {"date": d["_id"], "revenue": round(d["revenue"], 2), "orders": d["orders"]}
                for d in daily_revenue
            ],
            "ordersByStatus": [
                {"status": d["_id"], "count": d["count"]}
                for d in orders_by_status
            ],
            "topProducts": [
                {"name": p["name"][:28], "units": p["units"], "revenue": round(p["revenue"], 2)}
                for p in top_products
            ],
            "revenueByCategory": [
                {"category": d["_id"] or "Uncategorised", "revenue": round(d["revenue"], 2)}
                for d in revenue_by_category
            ],
            "metrics": {
                "avgOrderValue":     avg_order_value,
                "thisMonthOrders":   this_month_orders,
                "lastMonthOrders":   last_month_orders,
                "thisMonthRevenue":  this_month_revenue,
            },
        },
    }
