"""
Admin router — protected by require_admin dependency.

Orders:
  GET  /admin/orders               → all orders with filters + pagination
  GET  /admin/orders/{id}          → single order full detail
  PUT  /admin/orders/{id}/status   → update order status + tracking note

Products:
  GET    /admin/products            → paginated list with search / category filter
  POST   /admin/products            → create product
  PUT    /admin/products/{id}       → update product
  DELETE /admin/products/{id}       → delete product

Categories:
  GET  /admin/categories            → list all categories (for dropdowns)

Coupons:
  GET    /admin/coupons             → list all coupons
  POST   /admin/coupons             → create coupon
  PUT    /admin/coupons/{id}        → update coupon
  DELETE /admin/coupons/{id}        → delete coupon

Stats:
  GET  /admin/stats                → dashboard stats (counts + revenue)
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from pymongo.database import Database
from pydantic import BaseModel

from app.dependencies import get_db, require_admin
from app.services import order_service, product_service, analytics_service

router = APIRouter(prefix="/admin", tags=["Admin"])


class StatusUpdateRequest(BaseModel):
    status: str
    note: Optional[str] = ""


class ProductUpsertRequest(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    categoryId: Optional[str] = None
    price: Optional[float] = None
    originalPrice: Optional[float] = None
    stockQuantity: Optional[int] = None
    weight: Optional[str] = None
    origin: Optional[str] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list] = None
    images: Optional[list] = None
    inStock: Optional[bool] = None
    isFeatured: Optional[bool] = None
    isBestSeller: Optional[bool] = None


# ─── Products ────────────────────────────────────────────────────────────────

@router.get("/products")
def admin_list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None, alias="categoryId"),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_list_products(db, page, limit, search, category_id)


@router.post("/products")
def admin_create_product(
    body: ProductUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_create_product(db, body.model_dump(exclude_none=False))


@router.put("/products/{product_id}")
def admin_update_product(
    product_id: str,
    body: ProductUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_update_product(db, product_id, body.model_dump(exclude_unset=True))


@router.delete("/products/{product_id}")
def admin_delete_product(
    product_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_delete_product(db, product_id)


# ─── Categories ───────────────────────────────────────────────────────────────

@router.get("/categories")
def admin_list_categories(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_get_categories(db)


# ─── Orders ───────────────────────────────────────────────────────────────────

@router.get("/orders")
def admin_list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return order_service.admin_list_orders(db, page, limit, status, search)


@router.get("/orders/{order_id}")
def admin_get_order(
    order_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return order_service.admin_get_order(db, order_id)


@router.put("/orders/{order_id}/status")
def admin_update_order_status(
    order_id: str,
    body: StatusUpdateRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return order_service.admin_update_status(db, order_id, body.status, body.note or "")


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics")
def admin_analytics(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return analytics_service.get_analytics(db)


# ─── Dashboard stats ──────────────────────────────────────────────────────────

@router.get("/stats")
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

    # Low-stock products (stock_quantity <= 5, still marked in_stock)
    LOW_STOCK_THRESHOLD = 5
    low_stock_raw = list(
        db.products.find(
            {"stock_quantity": {"$lte": LOW_STOCK_THRESHOLD}},
            {"name": 1, "slug": 1, "stock_quantity": 1, "images": 1, "in_stock": 1},
        )
        .sort("stock_quantity", 1)
        .limit(10)
    )
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


# ─── Coupons ──────────────────────────────────────────────────────────────────

class CouponUpsertRequest(BaseModel):
    code: str
    discountType: str           # "percentage" | "flat"
    discountValue: float
    minOrderValue: float = 0.0
    maxDiscount: Optional[float] = None
    isActive: bool = True
    expiresAt: Optional[str] = None   # ISO-8601 string or null
    usageLimit: Optional[int] = None


def _coupon_to_dict(c: dict) -> dict:
    return {
        "id":             str(c["_id"]),
        "code":           c["code"],
        "discountType":   c["discount_type"],
        "discountValue":  c["discount_value"],
        "minOrderValue":  c.get("min_order_value", 0),
        "maxDiscount":    c.get("max_discount"),
        "isActive":       c.get("is_active", True),
        "expiresAt":      c["expires_at"].isoformat() if c.get("expires_at") else None,
        "usageLimit":     c.get("usage_limit"),
        "usedCount":      c.get("used_count", 0),
        "createdAt":      c["created_at"].isoformat(),
    }


@router.get("/coupons")
def admin_list_coupons(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    docs = list(db.coupons.find({}).sort("created_at", -1))
    return {"success": True, "data": [_coupon_to_dict(c) for c in docs]}


@router.post("/coupons")
def admin_create_coupon(
    body: CouponUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    code = body.code.upper().strip()
    if db.coupons.find_one({"code": code}):
        raise HTTPException(status_code=409, detail=f"Coupon '{code}' already exists.")

    expires = None
    if body.expiresAt:
        try:
            expires = datetime.fromisoformat(body.expiresAt.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid expiresAt date format.")

    now = datetime.now(timezone.utc)
    doc = {
        "code":            code,
        "discount_type":   body.discountType,
        "discount_value":  body.discountValue,
        "min_order_value": body.minOrderValue,
        "max_discount":    body.maxDiscount,
        "is_active":       body.isActive,
        "expires_at":      expires,
        "usage_limit":     body.usageLimit,
        "used_count":      0,
        "created_at":      now,
        "updated_at":      now,
    }
    result = db.coupons.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"success": True, "data": _coupon_to_dict(doc)}


@router.put("/coupons/{coupon_id}")
def admin_update_coupon(
    coupon_id: str,
    body: CouponUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    try:
        oid = ObjectId(coupon_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid coupon ID.")

    expires = None
    if body.expiresAt:
        try:
            expires = datetime.fromisoformat(body.expiresAt.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid expiresAt date format.")

    update = {
        "$set": {
            "code":            body.code.upper().strip(),
            "discount_type":   body.discountType,
            "discount_value":  body.discountValue,
            "min_order_value": body.minOrderValue,
            "max_discount":    body.maxDiscount,
            "is_active":       body.isActive,
            "expires_at":      expires,
            "usage_limit":     body.usageLimit,
            "updated_at":      datetime.now(timezone.utc),
        }
    }
    result = db.coupons.update_one({"_id": oid}, update)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found.")

    doc = db.coupons.find_one({"_id": oid})
    return {"success": True, "data": _coupon_to_dict(doc)}


@router.delete("/coupons/{coupon_id}")
def admin_delete_coupon(
    coupon_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    try:
        oid = ObjectId(coupon_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid coupon ID.")

    result = db.coupons.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found.")
    return {"success": True, "data": {"deleted": True}}


# ─── Bundles ──────────────────────────────────────────────────────────────────

class BundleItemInput(BaseModel):
    productId: str
    quantity: int = 1


class BundleUpsertRequest(BaseModel):
    name: str
    description: str = ""
    image: Optional[str] = None
    bundlePrice: float
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


@router.get("/bundles")
def admin_list_bundles(db: Database = Depends(get_db), _admin: dict = Depends(require_admin)):
    docs = list(db.bundles.find({}).sort("created_at", -1))
    return {"success": True, "data": [_bundle_list_item(d, db) for d in docs]}


@router.post("/bundles", status_code=201)
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


@router.put("/bundles/{bundle_id}")
def admin_update_bundle(
    bundle_id: str,
    body: BundleUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    try:
        oid = ObjectId(bundle_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid bundle ID.")
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


@router.delete("/bundles/{bundle_id}", status_code=204)
def admin_delete_bundle(
    bundle_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    try:
        oid = ObjectId(bundle_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid bundle ID.")
    db.bundles.delete_one({"_id": oid})


# ─── Bulk order actions ───────────────────────────────────────────────────────

class BulkStatusRequest(BaseModel):
    order_ids: list[str]
    status: str


@router.put("/bulk-order-status")
def admin_bulk_order_status(
    body: BulkStatusRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    valid = {"confirmed", "processing", "shipped", "delivered", "cancelled"}
    if body.status not in valid:
        raise HTTPException(status_code=422, detail=f"Status must be one of: {', '.join(valid)}")
    oids = []
    for s in body.order_ids:
        try:
            oids.append(ObjectId(s))
        except Exception:
            pass
    if not oids:
        raise HTTPException(status_code=400, detail="No valid order IDs provided.")
    result = db.orders.update_many(
        {"_id": {"$in": oids}},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"success": True, "data": {"updated": result.modified_count}}


@router.get("/export-orders")
def admin_export_orders_csv(
    status: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    import csv
    import io
    from fastapi.responses import StreamingResponse

    query: dict = {}
    if status:
        query["status"] = status

    docs = list(db.orders.find(query).sort("created_at", -1).limit(2000))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Order Number", "Customer", "Phone", "Status", "Payment", "Total (₹)", "Items", "Date"])
    for doc in docs:
        addr = doc.get("delivery_address", {})
        created = doc.get("created_at")
        writer.writerow([
            doc.get("order_number", ""),
            addr.get("full_name", ""),
            addr.get("phone", ""),
            doc.get("status", ""),
            doc.get("payment_status", ""),
            doc.get("total", 0),
            len(doc.get("items", [])),
            created.strftime("%Y-%m-%d") if created else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders.csv"},
    )


# ─── Flash sales ──────────────────────────────────────────────────────────────

class FlashSaleRequest(BaseModel):
    salePrice: Optional[float] = None
    saleEndsAt: Optional[str] = None


@router.put("/products/{product_id}/flash-sale")
def admin_set_flash_sale(
    product_id: str,
    body: FlashSaleRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID.")

    if body.salePrice is None:
        db.products.update_one({"_id": oid}, {"$unset": {"sale_price": "", "sale_ends_at": ""}})
        return {"success": True, "data": {"cleared": True}}

    sale_ends = None
    if body.saleEndsAt:
        try:
            sale_ends = datetime.fromisoformat(body.saleEndsAt.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid saleEndsAt date.")

    db.products.update_one(
        {"_id": oid},
        {"$set": {"sale_price": body.salePrice, "sale_ends_at": sale_ends}},
    )
    return {"success": True, "data": {"salePrice": body.salePrice}}


# ─── Q&A moderation ───────────────────────────────────────────────────────────

class QAAnswerRequest(BaseModel):
    answer: str


@router.put("/qa/{qa_id}")
def admin_answer_question(
    qa_id: str,
    body: QAAnswerRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    try:
        oid = ObjectId(qa_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Q&A ID.")
    db.qa.update_one(
        {"_id": oid},
        {"$set": {"answer": body.answer.strip(), "answered_at": datetime.now(timezone.utc)}},
    )
    return {"success": True}


@router.delete("/qa/{qa_id}", status_code=204)
def admin_delete_question(
    qa_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    try:
        oid = ObjectId(qa_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Q&A ID.")
    db.qa.delete_one({"_id": oid})


@router.get("/qa")
def admin_list_qa(
    unanswered: bool = Query(False),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    query = {"answer": None} if unanswered else {}
    docs = list(db.qa.find(query).sort("created_at", -1).limit(100))
    return {
        "success": True,
        "data": [
            {
                "id":         str(d["_id"]),
                "productId":  d.get("product_id", ""),
                "userName":   d.get("user_name", ""),
                "question":   d.get("question", ""),
                "answer":     d.get("answer"),
                "createdAt":  d["created_at"].isoformat() if d.get("created_at") else "",
            }
            for d in docs
        ],
    }


# ─── Subscriptions (admin view) ───────────────────────────────────────────────

@router.get("/subscriptions")
def admin_list_subscriptions(
    status: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    query: dict = {}
    if status:
        query["status"] = status
    docs = list(db.subscriptions.find(query).sort("created_at", -1).limit(200))
    return {
        "success": True,
        "data": [
            {
                "id":          str(d["_id"]),
                "userId":      d.get("user_id", ""),
                "productName": d.get("product_name", ""),
                "quantity":    d.get("quantity", 1),
                "frequency":   d.get("frequency", "monthly"),
                "status":      d.get("status", "active"),
                "nextDelivery": d["next_delivery"].isoformat() if d.get("next_delivery") else None,
            }
            for d in docs
        ],
    }
