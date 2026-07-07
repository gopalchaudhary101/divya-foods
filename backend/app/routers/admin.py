"""
Admin router — protected by require_admin dependency.

Orders:
  GET  /admin/orders               → all orders with filters + pagination (status, deliveryStatus, search)
  GET  /admin/orders/{id}          → single order full detail
  PUT  /admin/orders/{id}/status   → update order status + tracking note
  PUT  /admin/orders/{id}/delivery → assign/edit delivery partner + tracking, update delivery status
  GET  /admin/orders/{id}/invoice  → download any order's invoice PDF
  POST /admin/orders/{id}/invoice/email → email any order's invoice PDF to its customer

Products:
  GET    /admin/products            → paginated list with search / category filter
  POST   /admin/products            → create product
  PUT    /admin/products/{id}       → update product
  DELETE /admin/products/{id}       → delete product
  PUT    /admin/products/bulk-update → apply the same field changes to many products
  POST   /admin/products/bulk-delete → delete many products at once
  POST   /admin/products/bulk-import → create many products from an uploaded CSV
  GET    /admin/products/export      → download all products as CSV

Inventory:
  POST /admin/products/{id}/stock-adjustment → manually add/remove/damage stock
  POST /admin/products/{id}/returns          → record a customer return (restock optional)
  GET  /admin/products/{id}/stock-history    → inventory history for one product
  GET  /admin/stock-history                  → inventory history across all products

Digital Marketing:
  POST /admin/products/{id}/marketing → generate SEO title/description, social
                                          caption, and hashtags for a product

Purchases (supplier / batch / expiry tracking):
  GET    /admin/purchases                → list purchase orders
  POST   /admin/purchases                → create a purchase order (adds to incoming stock)
  PUT    /admin/purchases/{id}           → edit a purchase order (only while "ordered")
  PUT    /admin/purchases/{id}/receive   → mark received (incoming stock → stock_quantity)
  DELETE /admin/purchases/{id}           → cancel a purchase order (only while "ordered")

Categories:
  GET  /admin/categories            → list all categories (for dropdowns)

Coupons:
  GET    /admin/coupons             → list all coupons
  POST   /admin/coupons             → create coupon
  PUT    /admin/coupons/{id}        → update coupon
  DELETE /admin/coupons/{id}        → delete coupon

Banners:
  GET    /admin/banners             → list all banners
  POST   /admin/banners             → create banner
  PUT    /admin/banners/{id}        → update banner
  DELETE /admin/banners/{id}        → delete banner

Settings:
  GET  /admin/settings             → current site settings (business name, GST, FSSAI,
                                      plus image-upload limits used by /upload)
  PUT  /admin/settings             → update site settings

Stats:
  GET  /admin/stats                → dashboard stats (counts + revenue)
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from bson import ObjectId
from pymongo.database import Database
from pydantic import BaseModel, EmailStr

from app.dependencies import get_db, require_admin
from app.services import order_service, product_service, analytics_service, banner_service, settings_service, marketing_service, driver_service, user_admin_service

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
    isPublished: Optional[bool] = None
    lowStockThreshold: Optional[int] = None


# ─── Products ────────────────────────────────────────────────────────────────

@router.get("/products")
def admin_list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None, alias="categoryId"),
    stock_status: Optional[str] = Query(None, alias="stockStatus"),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_list_products(db, page, limit, search, category_id, stock_status)


@router.post("/products")
def admin_create_product(
    body: ProductUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_create_product(db, body.model_dump(exclude_none=False))


class BulkProductUpdateRequest(BaseModel):
    productIds: list[str]
    inStock: Optional[bool] = None
    isFeatured: Optional[bool] = None
    isBestSeller: Optional[bool] = None
    categoryId: Optional[str] = None


class BulkProductDeleteRequest(BaseModel):
    productIds: list[str]


@router.put("/products/bulk-update")
def admin_products_bulk_update(
    body: BulkProductUpdateRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    updates = body.model_dump(exclude={"productIds"}, exclude_none=True)
    return product_service.admin_bulk_update_products(db, body.productIds, updates)


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


@router.post("/products/bulk-delete")
def admin_products_bulk_delete(
    body: BulkProductDeleteRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_bulk_delete_products(db, body.productIds)


@router.post("/products/bulk-import")
async def admin_products_bulk_import(
    file: UploadFile = File(...),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    import csv
    import io

    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file.")

    contents = await file.read()
    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded.")

    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty.")

    return product_service.admin_bulk_import_products(db, rows)


@router.get("/products/export")
def admin_products_export_csv(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    import csv
    import io
    from fastapi.responses import StreamingResponse

    cat_map = {c["id"]: c["name"] for c in product_service.admin_get_categories(db)["data"]}
    docs = list(db.products.find({}).sort([("created_at", -1)]))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "name", "slug", "category", "price", "originalPrice", "stockQuantity",
        "weight", "origin", "brand", "tags", "images", "inStock", "isFeatured",
        "isBestSeller", "description",
    ])
    for doc in docs:
        cat_id = doc.get("category_id")
        writer.writerow([
            doc.get("name", ""),
            doc.get("slug", ""),
            cat_map.get(str(cat_id), "") if cat_id else "",
            doc.get("price", 0),
            doc.get("original_price") or "",
            doc.get("stock_quantity", 0),
            doc.get("weight") or "",
            doc.get("origin") or "",
            doc.get("brand") or "",
            ",".join(doc.get("tags") or []),
            ",".join(doc.get("images") or []),
            doc.get("in_stock", True),
            doc.get("is_featured", False),
            doc.get("is_best_seller", False),
            doc.get("description", ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products.csv"},
    )


# ─── Inventory ────────────────────────────────────────────────────────────────

class StockAdjustmentRequest(BaseModel):
    type: str  # "add" | "remove" | "damaged"
    quantity: int
    note: Optional[str] = None


class ReturnRequest(BaseModel):
    quantity: int
    restock: bool = False
    note: Optional[str] = None
    orderId: Optional[str] = None


@router.post("/products/{product_id}/stock-adjustment")
def admin_adjust_stock(
    product_id: str,
    body: StockAdjustmentRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_adjust_stock(db, product_id, body.type, body.quantity, body.note)


@router.post("/products/{product_id}/returns")
def admin_record_return(
    product_id: str,
    body: ReturnRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_record_return(db, product_id, body.quantity, body.restock, body.note, body.orderId)


@router.get("/products/{product_id}/stock-history")
def admin_product_stock_history(
    product_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_get_stock_history(db, product_id, page, limit)


@router.get("/stock-history")
def admin_all_stock_history(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_get_stock_history(db, None, page, limit)


# ─── Digital marketing ──────────────────────────────────────────────────────────

@router.post("/products/{product_id}/marketing")
def admin_generate_marketing(
    product_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    try:
        oid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID")
    product = db.products.find_one({"_id": oid})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    content = marketing_service.generate_marketing_content(product)
    return {"success": True, "data": content}


@router.get("/products/{product_id}/qr-code")
def admin_get_product_qr_code(
    product_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    png_bytes, slug = product_service.get_qr_code_png(db, product_id)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="qr-{slug}.png"'},
    )


# ─── Purchase orders ────────────────────────────────────────────────────────────

class PurchaseCreateRequest(BaseModel):
    productId: str
    supplierName: str
    purchaseDate: Optional[str] = None
    unitCost: float
    quantity: int
    invoiceNumber: Optional[str] = None
    batchNumber: Optional[str] = None
    expiryDate: Optional[str] = None
    notes: Optional[str] = None


class PurchaseUpdateRequest(BaseModel):
    supplierName: Optional[str] = None
    purchaseDate: Optional[str] = None
    unitCost: Optional[float] = None
    quantity: Optional[int] = None
    invoiceNumber: Optional[str] = None
    batchNumber: Optional[str] = None
    expiryDate: Optional[str] = None
    notes: Optional[str] = None


@router.get("/purchases")
def admin_list_purchases(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    product_id: Optional[str] = Query(None, alias="productId"),
    status: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_list_purchases(db, page, limit, product_id, status)


@router.post("/purchases")
def admin_create_purchase(
    body: PurchaseCreateRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_create_purchase(db, body.model_dump())


@router.put("/purchases/{purchase_id}")
def admin_update_purchase(
    purchase_id: str,
    body: PurchaseUpdateRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_update_purchase(db, purchase_id, body.model_dump(exclude_unset=True))


@router.put("/purchases/{purchase_id}/receive")
def admin_receive_purchase(
    purchase_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_receive_purchase(db, purchase_id)


@router.delete("/purchases/{purchase_id}")
def admin_cancel_purchase(
    purchase_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_cancel_purchase(db, purchase_id)


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
    delivery_status: Optional[str] = Query(None, alias="deliveryStatus"),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return order_service.admin_list_orders(db, page, limit, status, search, delivery_status)


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


class DeliveryUpsertRequest(BaseModel):
    provider: Optional[str] = None
    trackingId: Optional[str] = None
    bookingId: Optional[str] = None
    partnerName: Optional[str] = None
    driverId: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    vehicleNumber: Optional[str] = None
    vehicleType: Optional[str] = None
    deliveryCharge: Optional[float] = None
    notes: Optional[str] = None
    proofOfDeliveryUrl: Optional[str] = None
    estimatedDeliveryAt: Optional[str] = None
    deliveryStatus: Optional[str] = None
    statusNote: Optional[str] = None


@router.put("/orders/{order_id}/delivery")
def admin_upsert_delivery(
    order_id: str,
    body: DeliveryUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return order_service.admin_upsert_delivery(db, order_id, body.model_dump(exclude_unset=True))


@router.get("/orders/{order_id}/invoice")
def admin_get_invoice(
    order_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    pdf_bytes, order_number = order_service.get_invoice_pdf(db, order_id, None)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="invoice-{order_number}.pdf"'},
    )


@router.post("/orders/{order_id}/invoice/email")
def admin_email_invoice(
    order_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return order_service.email_invoice(db, order_id, None)


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


# ─── Banners ──────────────────────────────────────────────────────────────────

class BannerUpsertRequest(BaseModel):
    title: str
    subtitle: Optional[str] = None
    image: str
    link: Optional[str] = None
    isActive: bool = True
    order: int = 0


@router.get("/banners")
def admin_list_banners(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return banner_service.admin_list(db)


@router.post("/banners")
def admin_create_banner(
    body: BannerUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return banner_service.admin_create(db, {
        "title":     body.title,
        "subtitle":  body.subtitle,
        "image":     body.image,
        "link":      body.link,
        "is_active": body.isActive,
        "order":     body.order,
    })


@router.put("/banners/{banner_id}")
def admin_update_banner(
    banner_id: str,
    body: BannerUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return banner_service.admin_update(db, banner_id, {
        "title":     body.title,
        "subtitle":  body.subtitle,
        "image":     body.image,
        "link":      body.link,
        "is_active": body.isActive,
        "order":     body.order,
    })


@router.delete("/banners/{banner_id}")
def admin_delete_banner(
    banner_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return banner_service.admin_delete(db, banner_id)


# ─── Settings ─────────────────────────────────────────────────────────────────

class SettingsUpdateRequest(BaseModel):
    businessName: Optional[str] = None
    gstNumber: Optional[str] = None
    fssaiNumber: Optional[str] = None
    # Image-upload limits (see app/services/settings_service.py for defaults)
    maxUploadSizeMB: Optional[int] = None
    maxImageDimension: Optional[int] = None
    compressionQuality: Optional[str] = None
    allowedFormats: Optional[list[str]] = None
    enableWebP: Optional[bool] = None
    enableAVIF: Optional[bool] = None
    thumbnailSizes: Optional[list[int]] = None
    # Configurable delivery providers (see app/services/settings_service.py)
    deliveryProviders: Optional[list[str]] = None


@router.get("/settings")
def admin_get_settings(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return settings_service.admin_get(db)


@router.put("/settings")
def admin_update_settings(
    body: SettingsUpdateRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return settings_service.admin_update(db, body.model_dump(exclude_none=True))


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


# ─── Driver accounts ──────────────────────────────────────────────────────────

class DriverCreateRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str


class DriverActiveRequest(BaseModel):
    is_active: bool


@router.post("/drivers")
def admin_create_driver(
    body: DriverCreateRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return driver_service.admin_create_driver(db, body.model_dump())


@router.get("/drivers")
def admin_list_drivers(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return driver_service.admin_list_drivers(db)


@router.put("/drivers/{driver_id}/active")
def admin_set_driver_active(
    driver_id: str,
    body: DriverActiveRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return driver_service.admin_set_driver_active(db, driver_id, body.is_active)


# ─── User role management ─────────────────────────────────────────────────────

class RoleUpdateRequest(BaseModel):
    role: str


@router.get("/users")
def admin_list_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return user_admin_service.admin_list_users(db, search, role, page, limit)


@router.put("/users/{user_id}/role")
def admin_update_user_role(
    user_id: str,
    body: RoleUpdateRequest,
    db: Database = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    return user_admin_service.admin_update_role(db, admin["_id"], user_id, body.role)
