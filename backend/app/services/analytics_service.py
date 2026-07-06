"""
Analytics service — MongoDB aggregation pipelines for the admin dashboard.
All queries hit paid orders only for revenue figures.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from pymongo.database import Database


def _period_sales(db: Database, start: Optional[datetime], end: Optional[datetime] = None) -> dict:
    """Revenue + order count for paid orders in [start, end). Both bounds optional (None = unbounded)."""
    match: dict = {"payment_status": "paid"}
    date_filter: dict = {}
    if start:
        date_filter["$gte"] = start
    if end:
        date_filter["$lt"] = end
    if date_filter:
        match["created_at"] = date_filter

    agg = list(db.orders.aggregate([
        {"$match": match},
        {"$group": {"_id": None, "revenue": {"$sum": "$total"}, "orders": {"$sum": 1}}},
    ]))
    if not agg:
        return {"revenue": 0.0, "orders": 0}
    return {"revenue": round(agg[0]["revenue"], 2), "orders": agg[0]["orders"]}


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

    # ── 6. Delivery analytics ─────────────────────────────────────────────────
    delivery_status_counts = list(db.orders.aggregate([
        {"$match": {"delivery.delivery_status": {"$exists": True}}},
        {"$group": {"_id": "$delivery.delivery_status", "count": {"$sum": 1}}},
    ]))
    counts_by_status = {d["_id"]: d["count"] for d in delivery_status_counts}
    active_statuses = {"packed", "ready_for_pickup", "picked_up", "in_transit", "near_delivery"}

    total_deliveries     = sum(counts_by_status.values())
    active_deliveries    = sum(c for s, c in counts_by_status.items() if s in active_statuses)
    completed_deliveries = counts_by_status.get("delivered", 0)
    cancelled_deliveries = counts_by_status.get("cancelled", 0) + counts_by_status.get("failed", 0)

    avg_delivery_agg = list(db.orders.aggregate([
        {"$match": {"delivery.delivery_status": "delivered", "delivery.delivered_at": {"$exists": True}}},
        {"$project": {
            "hours": {"$divide": [
                {"$subtract": ["$delivery.delivered_at", "$delivery.created_at"]},
                1000 * 60 * 60,
            ]},
        }},
        {"$group": {"_id": None, "avg": {"$avg": "$hours"}}},
    ]))
    avg_delivery_time_hours = round(avg_delivery_agg[0]["avg"], 1) if avg_delivery_agg else 0.0

    # ── 7. Sales summary across periods ───────────────────────────────────────
    today_start     = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    week_start      = today_start - timedelta(days=today_start.weekday())  # Monday
    year_start      = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    sales_summary = {
        "today":     _period_sales(db, today_start),
        "yesterday": _period_sales(db, yesterday_start, today_start),
        "thisWeek":  _period_sales(db, week_start),
        "thisMonth": _period_sales(db, this_month_start),
        "thisYear":  _period_sales(db, year_start),
        "allTime":   _period_sales(db, None),
    }

    # ── 8. Estimated profit — cost comes from average *received* purchase cost ──
    # per product, not a dedicated cost-price field (none exists on Product), so
    # this only covers products with at least one received purchase order; the
    # response reports how many of the sold products that covers so it reads as
    # an estimate rather than an authoritative P&L figure.
    avg_cost_agg = list(db.purchases.aggregate([
        {"$match": {"status": "received"}},
        {"$group": {
            "_id":       "$product_id",
            "totalCost": {"$sum": {"$multiply": ["$unit_cost", "$quantity"]}},
            "totalQty":  {"$sum": "$quantity"},
        }},
    ]))
    avg_cost_by_product = {d["_id"]: (d["totalCost"] / d["totalQty"]) for d in avg_cost_agg if d["totalQty"]}

    paid_items_agg = list(db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$unwind": "$items"},
        {"$group": {
            "_id":       "$items.product_id",
            "unitsSold": {"$sum": "$items.quantity"},
            "revenue":   {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}},
        }},
    ]))
    total_revenue_all = sum(d["revenue"] for d in paid_items_agg)
    total_cost_est    = sum(d["unitsSold"] * avg_cost_by_product.get(d["_id"], 0.0) for d in paid_items_agg)
    products_with_cost_data = sum(1 for d in paid_items_agg if d["_id"] in avg_cost_by_product)

    estimated_profit = {
        "totalRevenue":         round(total_revenue_all, 2),
        "estimatedCost":        round(total_cost_est, 2),
        "estimatedProfit":      round(total_revenue_all - total_cost_est, 2),
        "productsWithCostData": products_with_cost_data,
        "totalProductsSold":    len(paid_items_agg),
    }

    # ── 9. Worst sellers — includes zero-sale products, unlike topProducts ──────
    all_sales_agg = list(db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "units": {"$sum": "$items.quantity"}}},
    ]))
    sold_map = {d["_id"]: d["units"] for d in all_sales_agg}

    all_products = list(db.products.find({}, {"name": 1, "stock_quantity": 1}))
    worst_sellers = sorted(
        ({"name": p["name"][:28], "units": sold_map.get(p["_id"], 0)} for p in all_products),
        key=lambda x: x["units"],
    )[:10]

    # ── 10. Fast / slow moving products — sales velocity over the last 30 days ──
    recent_sales_agg = list(db.orders.aggregate([
        {"$match": {"payment_status": "paid", "created_at": {"$gte": thirty_days_ago}}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "units": {"$sum": "$items.quantity"}}},
    ]))
    recent_sold_map = {d["_id"]: d["units"] for d in recent_sales_agg}

    fast_moving = sorted(
        ({"name": p["name"][:28], "unitsLast30Days": recent_sold_map.get(p["_id"], 0)} for p in all_products),
        key=lambda x: x["unitsLast30Days"], reverse=True,
    )[:10]
    # "Slow moving" only means something for products that actually have stock sitting idle
    slow_moving = sorted(
        (
            {"name": p["name"][:28], "unitsLast30Days": recent_sold_map.get(p["_id"], 0)}
            for p in all_products if p.get("stock_quantity", 0) > 0
        ),
        key=lambda x: x["unitsLast30Days"],
    )[:10]

    # ── 11. Most / least viewed products ────────────────────────────────────────
    most_viewed = [
        {"name": p["name"][:28], "views": p.get("view_count", 0)}
        for p in db.products.find({}, {"name": 1, "view_count": 1}).sort([("view_count", -1)]).limit(10)
    ]
    least_viewed = [
        {"name": p["name"][:28], "views": p.get("view_count", 0)}
        for p in db.products.find({}, {"name": 1, "view_count": 1}).sort([("view_count", 1)]).limit(10)
    ]

    # ── 12. Top customers by spend ───────────────────────────────────────────────
    top_customers_agg = list(db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": "$user_id", "totalSpent": {"$sum": "$total"}, "orderCount": {"$sum": 1}}},
        {"$sort": {"totalSpent": -1}},
        {"$limit": 10},
        {"$lookup": {"from": "users", "localField": "_id", "foreignField": "_id", "as": "user"}},
        {"$unwind": {"path": "$user", "preserveNullAndEmptyArrays": True}},
    ]))
    top_customers = [
        {
            "name":       d["user"]["name"] if d.get("user") else "Unknown",
            "email":      d["user"]["email"] if d.get("user") else "",
            "totalSpent": round(d["totalSpent"], 2),
            "orderCount": d["orderCount"],
        }
        for d in top_customers_agg
    ]

    # ── 13. Returning customers ──────────────────────────────────────────────────
    customer_order_counts = list(db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": "$user_id", "orders": {"$sum": 1}}},
    ]))
    customers_with_orders = len(customer_order_counts)
    returning_customers   = sum(1 for c in customer_order_counts if c["orders"] >= 2)
    returning_customers_pct = round(returning_customers / customers_with_orders * 100, 1) if customers_with_orders else 0.0

    # ── 14. Abandoned orders — still pending & unpaid more than 24h after creation
    abandoned_cutoff = now - timedelta(hours=24)
    abandoned_orders_count = db.orders.count_documents({
        "status": "pending", "payment_status": {"$ne": "paid"}, "created_at": {"$lt": abandoned_cutoff},
    })

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
            "deliveryAnalytics": {
                "totalDeliveries":     total_deliveries,
                "activeDeliveries":    active_deliveries,
                "completedDeliveries": completed_deliveries,
                "cancelledDeliveries": cancelled_deliveries,
                "avgDeliveryTimeHours": avg_delivery_time_hours,
            },
            "salesSummary":          sales_summary,
            "estimatedProfit":       estimated_profit,
            "worstSellers":          worst_sellers,
            "fastMoving":            fast_moving,
            "slowMoving":            slow_moving,
            "mostViewed":            most_viewed,
            "leastViewed":           least_viewed,
            "topCustomers":          top_customers,
            "returningCustomersPct": returning_customers_pct,
            "abandonedOrders":       abandoned_orders_count,
        },
    }
