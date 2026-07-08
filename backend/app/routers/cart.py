"""
Cart router — server-side cart sync for authenticated users.

One cart document per user in the `carts` collection.
The frontend Redux cart is the single source of truth while browsing;
this API is called on login to merge/restore the saved cart.

Endpoints:
  GET  /cart                      → fetch saved cart
  POST /cart/sync                 → replace server cart with current client cart
  POST /cart/items                → add or update a single item
  PUT  /cart/items/{product_id}   → update item quantity
  DELETE /cart/items/{product_id} → remove one item
  DELETE /cart                    → clear cart
"""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from pymongo.database import Database
from bson import ObjectId

from app.dependencies import get_db, get_current_user

router = APIRouter(prefix="/cart", tags=["Cart"])


# ─── Request schemas ──────────────────────────────────────────────────────────

class CartItemIn(BaseModel):
    productId: str
    name: str
    price: float
    quantity: int = Field(..., ge=1)
    image: Optional[str] = None
    maxQuantity: int = 10


class CartSyncRequest(BaseModel):
    """Replaces the full server cart with the client cart on login."""
    items: List[CartItemIn]


class UpdateQtyRequest(BaseModel):
    quantity: int = Field(..., ge=1)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _cart_response(cart_doc: dict) -> dict:
    items = cart_doc.get("items", [])
    total_items = sum(i["quantity"] for i in items)
    total_price = sum(i["price"] * i["quantity"] for i in items)
    return {
        "success": True,
        "data": {
            "items": items,
            "totalItems": total_items,
            "totalPrice": round(total_price, 2),
        },
    }


def _get_or_create_cart(db: Database, user_id: ObjectId) -> dict:
    cart = db.carts.find_one({"user_id": user_id})
    if not cart:
        cart = {"user_id": user_id, "items": [], "updated_at": _utcnow(), "reminder_sent_at": None}
        db.carts.insert_one(cart)
    return cart


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("")
def get_cart(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Fetch the server-side cart for the logged-in user."""
    cart = _get_or_create_cart(db, current_user["_id"])
    return _cart_response(cart)


@router.post("/sync", status_code=status.HTTP_200_OK)
def sync_cart(
    body: CartSyncRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Called immediately after login to merge the client (Redux) cart with the
    server cart. Strategy: client cart wins — server cart is overwritten.
    This preserves items added while browsing as a guest.
    """
    items = [item.model_dump() for item in body.items]
    db.carts.update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"items": items, "updated_at": _utcnow(), "reminder_sent_at": None}},
        upsert=True,
    )
    return {"success": True, "message": "Cart synced."}


@router.post("/items", status_code=status.HTTP_200_OK)
def add_item(
    item: CartItemIn,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Add an item or increase its quantity.
    If the product is already in the cart, increments the quantity (capped at maxQuantity).
    """
    cart = _get_or_create_cart(db, current_user["_id"])
    items: list = cart.get("items", [])

    existing = next((i for i in items if i["productId"] == item.productId), None)
    if existing:
        existing["quantity"] = min(existing["quantity"] + item.quantity, item.maxQuantity)
    else:
        items.append(item.model_dump())

    db.carts.update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"items": items, "updated_at": _utcnow(), "reminder_sent_at": None}},
    )
    updated = db.carts.find_one({"user_id": current_user["_id"]})
    return _cart_response(updated)


@router.put("/items/{product_id}", status_code=status.HTTP_200_OK)
def update_item_quantity(
    product_id: str,
    body: UpdateQtyRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Set the quantity of a specific cart item."""
    cart = _get_or_create_cart(db, current_user["_id"])
    items: list = cart.get("items", [])

    for item in items:
        if item["productId"] == product_id:
            item["quantity"] = min(body.quantity, item.get("maxQuantity", 99))
            break
    else:
        raise HTTPException(status_code=404, detail="Item not in cart.")

    db.carts.update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"items": items, "updated_at": _utcnow(), "reminder_sent_at": None}},
    )
    updated = db.carts.find_one({"user_id": current_user["_id"]})
    return _cart_response(updated)


@router.delete("/items/{product_id}", status_code=status.HTTP_200_OK)
def remove_item(
    product_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Remove a single item from the cart."""
    cart = _get_or_create_cart(db, current_user["_id"])
    items = [i for i in cart.get("items", []) if i["productId"] != product_id]

    db.carts.update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"items": items, "updated_at": _utcnow(), "reminder_sent_at": None}},
    )
    updated = db.carts.find_one({"user_id": current_user["_id"]})
    return _cart_response(updated)


@router.delete("", status_code=status.HTTP_200_OK)
def clear_cart(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Remove all items from the cart."""
    db.carts.update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"items": [], "updated_at": _utcnow()}},
        upsert=True,
    )
    return {"success": True, "data": {"items": [], "totalItems": 0, "totalPrice": 0}}
