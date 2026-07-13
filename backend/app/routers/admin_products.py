"""
Admin product management — catalogue CRUD, inventory (stock adjustments,
returns, stock history), purchase orders (supplier/batch/expiry tracking),
digital marketing content generation, flash sales, and the category dropdown
list. All product_service/marketing_service-backed, split out of the former
monolithic admin.py; grouped together here (rather than one file per
sub-concern) since they all operate on the same /admin/products/* URL space
and the same underlying service module.

  GET    /admin/products              → paginated list with search / category filter
  POST   /admin/products              → create product
  PUT    /admin/products/{id}         → update product
  DELETE /admin/products/{id}         → delete product
  PUT    /admin/products/bulk-update  → apply the same field changes to many products
  POST   /admin/products/bulk-delete  → delete many products at once
  POST   /admin/products/bulk-import  → create many products from an uploaded CSV
  GET    /admin/products/export       → download all products as CSV

  POST /admin/products/{id}/stock-adjustment → manually add/remove/damage stock
  POST /admin/products/{id}/returns          → record a customer return (restock optional)
  GET  /admin/products/{id}/stock-history    → inventory history for one product
  GET  /admin/stock-history                  → inventory history across all products

  POST /admin/products/{id}/marketing  → generate SEO title/description, social caption, hashtags
  GET  /admin/products/{id}/qr-code    → product QR code PNG

  GET    /admin/purchases              → list purchase orders
  POST   /admin/purchases              → create a purchase order
  PUT    /admin/purchases/{id}         → edit a purchase order (only while "ordered")
  PUT    /admin/purchases/{id}/receive → mark received (incoming stock → stock_quantity)
  DELETE /admin/purchases/{id}         → cancel a purchase order (only while "ordered")

  PUT /admin/products/{id}/flash-sale  → set/clear a time-limited sale price

  GET /admin/categories                → list all categories (for dropdowns)
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from pymongo.database import Database
from pydantic import BaseModel

from app.dependencies import get_db, require_admin
from app.services import product_service, marketing_service
from app.utils.mongo import get_object_id

router = APIRouter(tags=["Admin"])


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

@router.get("/admin/products")
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


@router.post("/admin/products")
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


@router.put("/admin/products/bulk-update")
def admin_products_bulk_update(
    body: BulkProductUpdateRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    updates = body.model_dump(exclude={"productIds"}, exclude_none=True)
    return product_service.admin_bulk_update_products(db, body.productIds, updates)


@router.put("/admin/products/{product_id}")
def admin_update_product(
    product_id: str,
    body: ProductUpsertRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_update_product(db, product_id, body.model_dump(exclude_unset=True))


@router.delete("/admin/products/{product_id}")
def admin_delete_product(
    product_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_delete_product(db, product_id)


@router.post("/admin/products/bulk-delete")
def admin_products_bulk_delete(
    body: BulkProductDeleteRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_bulk_delete_products(db, body.productIds)


@router.post("/admin/products/bulk-import")
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


@router.get("/admin/products/export")
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


@router.post("/admin/products/{product_id}/stock-adjustment")
def admin_adjust_stock(
    product_id: str,
    body: StockAdjustmentRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_adjust_stock(db, product_id, body.type, body.quantity, body.note)


@router.post("/admin/products/{product_id}/returns")
def admin_record_return(
    product_id: str,
    body: ReturnRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_record_return(db, product_id, body.quantity, body.restock, body.note, body.orderId)


@router.get("/admin/products/{product_id}/stock-history")
def admin_product_stock_history(
    product_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_get_stock_history(db, product_id, page, limit)


@router.get("/admin/stock-history")
def admin_all_stock_history(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_get_stock_history(db, None, page, limit)


# ─── Digital marketing ──────────────────────────────────────────────────────────

@router.post("/admin/products/{product_id}/marketing")
def admin_generate_marketing(
    product_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    oid = get_object_id(product_id, "product")
    product = db.products.find_one({"_id": oid})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    content = marketing_service.generate_marketing_content(product)
    return {"success": True, "data": content}


@router.get("/admin/products/{product_id}/qr-code")
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


@router.get("/admin/purchases")
def admin_list_purchases(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    product_id: Optional[str] = Query(None, alias="productId"),
    status: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_list_purchases(db, page, limit, product_id, status)


@router.post("/admin/purchases")
def admin_create_purchase(
    body: PurchaseCreateRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_create_purchase(db, body.model_dump())


@router.put("/admin/purchases/{purchase_id}")
def admin_update_purchase(
    purchase_id: str,
    body: PurchaseUpdateRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_update_purchase(db, purchase_id, body.model_dump(exclude_unset=True))


@router.put("/admin/purchases/{purchase_id}/receive")
def admin_receive_purchase(
    purchase_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_receive_purchase(db, purchase_id)


@router.delete("/admin/purchases/{purchase_id}")
def admin_cancel_purchase(
    purchase_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_cancel_purchase(db, purchase_id)


# ─── Flash sales ──────────────────────────────────────────────────────────────
# Nested under /admin/products/{id}/flash-sale rather than /admin/flash-sales,
# so it lives here rather than in flash_sales.py.

class FlashSaleRequest(BaseModel):
    salePrice: Optional[float] = None
    saleEndsAt: Optional[str] = None


@router.put("/admin/products/{product_id}/flash-sale")
def admin_set_flash_sale(
    product_id: str,
    body: FlashSaleRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    oid = get_object_id(product_id, "product")

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


# ─── Categories ───────────────────────────────────────────────────────────────

@router.get("/admin/categories")
def admin_list_categories(
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return product_service.admin_get_categories(db)
