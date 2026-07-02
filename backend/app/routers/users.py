"""
Users router — profile management and wishlist.

Wishlist is stored as `wishlist_product_ids: [str]` on the user document.
$addToSet / $pull ensure atomic, duplicate-free updates.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from pymongo.database import Database
from bson import ObjectId

from app.dependencies import get_db, get_current_user
from app.services.product_service import _to_list_item

router = APIRouter(prefix="/users", tags=["Users"])


# ─── Wishlist ─────────────────────────────────────────────────────────────────

class WishlistAddRequest(BaseModel):
    product_id: str


@router.get("/wishlist")
def get_wishlist(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Return the logged-in user's wishlist as full product objects.
    The wishlist is stored on the user document as a list of product_id strings.
    """
    wishlist_ids = current_user.get("wishlist_product_ids", [])

    if not wishlist_ids:
        return {"success": True, "data": []}

    # Convert strings to ObjectIds, silently skipping any that are malformed
    oids = []
    for pid in wishlist_ids:
        try:
            oids.append(ObjectId(pid))
        except Exception:
            pass

    if not oids:
        return {"success": True, "data": []}

    docs = list(db.products.find({"_id": {"$in": oids}}))
    return {"success": True, "data": [_to_list_item(d) for d in docs]}


@router.post("/wishlist", status_code=status.HTTP_200_OK)
def add_to_wishlist(
    body: WishlistAddRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Add a product to the wishlist. Idempotent — adding twice is a no-op."""
    # Verify the product exists
    try:
        oid = ObjectId(body.product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID.")

    if not db.products.find_one({"_id": oid}):
        raise HTTPException(status_code=404, detail="Product not found.")

    db.users.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"wishlist_product_ids": body.product_id}},
    )
    return {"success": True, "message": "Added to wishlist."}


@router.delete("/wishlist/{product_id}", status_code=status.HTTP_200_OK)
def remove_from_wishlist(
    product_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Remove a product from the wishlist."""
    db.users.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"wishlist_product_ids": product_id}},
    )
    return {"success": True, "message": "Removed from wishlist."}
