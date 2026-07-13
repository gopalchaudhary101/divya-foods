"""
Users router — profile management, addresses, and wishlist.

Wishlist is stored as `wishlist_product_ids: [str]` on the user document.
Addresses are stored in the separate `addresses` collection, indexed by user_id.
"""

from io import BytesIO
from typing import Optional

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field
from pymongo.database import Database
from bson import ObjectId

from app.config import settings
from app.dependencies import get_db, get_current_user, require_admin
from app.limiter import limiter
from app.models.base import utcnow
from app.services import user_admin_service
from app.services.product_service import _to_list_item
from app.utils.mongo import get_object_id

router = APIRouter(prefix="/users", tags=["Users"])


# ─── Profile ──────────────────────────────────────────────────────────────────

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, pattern=r"^\+?[0-9]{10,15}$")
    date_of_birth: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")


@router.get("/profile")
def get_profile(current_user: dict = Depends(get_current_user)):
    from app.services.auth_service import _user_to_response
    return {"success": True, "data": _user_to_response(current_user)}


@router.put("/profile")
def update_profile(
    body: ProfileUpdateRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    update: dict = {"updated_at": utcnow()}
    if body.name is not None:
        update["name"] = body.name
    if body.phone is not None:
        update["phone"] = body.phone
    if body.date_of_birth is not None:
        update["date_of_birth"] = body.date_of_birth

    db.users.update_one({"_id": current_user["_id"]}, {"$set": update})
    updated = db.users.find_one({"_id": current_user["_id"]})
    from app.services.auth_service import _user_to_response
    return {"success": True, "data": _user_to_response(updated)}


_AVATAR_ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp"}
_AVATAR_MAX_BYTES = 5 * 1024 * 1024  # 5MB


@router.post("/avatar", summary="Upload a profile picture")
@limiter.limit("10/minute")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Uploads a new avatar to Cloudinary and saves it on the caller's own
    profile in one step. Deliberately simpler than app/routers/upload.py's
    product-image pipeline (which is admin-only, batch-capable, dedups by
    content hash, and respects admin-configurable size/format limits) — this
    is always one small image for yourself. Reuploading always overwrites the
    same Cloudinary public_id (the user's own id), so it never accumulates
    orphaned images the way a fresh public_id per upload would.
    """
    if not all([settings.CLOUDINARY_CLOUD_NAME, settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET]):
        raise HTTPException(status_code=503, detail="Image upload is not configured.")

    if file.content_type not in _AVATAR_ALLOWED_MIMES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: JPEG, PNG, WebP.",
        )

    contents = await file.read()
    if len(contents) > _AVATAR_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Avatar image must be under 5MB.")

    try:
        probe = Image.open(BytesIO(contents))
        probe.verify()
    except Image.DecompressionBombError as exc:
        raise HTTPException(status_code=400, detail="Image is too large to process safely.") from exc
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="File is not a valid image or is corrupted.") from exc

    # verify() leaves the file object unusable for further operations — reopen it.
    img = Image.open(BytesIO(contents))
    img = ImageOps.exif_transpose(img)  # bakes in correct rotation, drops the orientation tag
    img.thumbnail((512, 512), Image.LANCZOS)
    out = BytesIO()
    img.convert("RGB").save(out, format="JPEG", quality=90, optimize=True)

    try:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        result = cloudinary.uploader.upload(
            BytesIO(out.getvalue()),
            folder="divyafoods/avatars",
            public_id=str(current_user["_id"]),
            overwrite=True,
            resource_type="image",
            transformation=[{"width": 256, "height": 256, "crop": "fill", "gravity": "face"}],
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Avatar upload failed: {exc}") from exc

    db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"avatar": result["secure_url"], "updated_at": utcnow()}},
    )
    updated = db.users.find_one({"_id": current_user["_id"]})
    from app.services.auth_service import _user_to_response
    return {"success": True, "data": _user_to_response(updated)}


# ─── Addresses ────────────────────────────────────────────────────────────────

class AddressRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., pattern=r"^\+?[0-9]{10,15}$")
    address_line1: str = Field(..., min_length=5, max_length=200)
    address_line2: Optional[str] = Field(None, max_length=200)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    pincode: str = Field(..., pattern=r"^[0-9]{6}$")
    is_default: bool = False


def _addr_to_dict(doc: dict) -> dict:
    return {
        "id":           str(doc["_id"]),
        "label":        doc.get("label", ""),
        "fullName":     doc.get("full_name", ""),
        "phone":        doc.get("phone", ""),
        "addressLine1": doc.get("address_line1", ""),
        "addressLine2": doc.get("address_line2"),
        "city":         doc.get("city", ""),
        "state":        doc.get("state", ""),
        "pincode":      doc.get("pincode", ""),
        "isDefault":    doc.get("is_default", False),
    }


@router.get("/addresses")
def list_addresses(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    docs = list(db.addresses.find({"user_id": current_user["_id"]}).sort("is_default", -1))
    return {"success": True, "data": [_addr_to_dict(d) for d in docs]}


@router.post("/addresses", status_code=status.HTTP_201_CREATED)
def create_address(
    body: AddressRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if body.is_default:
        db.addresses.update_many(
            {"user_id": current_user["_id"]},
            {"$set": {"is_default": False}},
        )

    doc = {
        "user_id":      current_user["_id"],
        "label":        body.label,
        "full_name":    body.full_name,
        "phone":        body.phone,
        "address_line1": body.address_line1,
        "address_line2": body.address_line2,
        "city":         body.city,
        "state":        body.state,
        "pincode":      body.pincode,
        "is_default":   body.is_default,
        "created_at":   utcnow(),
    }
    result = db.addresses.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"success": True, "data": _addr_to_dict(doc)}


@router.put("/addresses/{address_id}")
def update_address(
    address_id: str,
    body: AddressRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    oid = get_object_id(address_id, "address")

    existing = db.addresses.find_one({"_id": oid, "user_id": current_user["_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found.")

    if body.is_default:
        db.addresses.update_many(
            {"user_id": current_user["_id"]},
            {"$set": {"is_default": False}},
        )

    update = {
        "label":         body.label,
        "full_name":     body.full_name,
        "phone":         body.phone,
        "address_line1": body.address_line1,
        "address_line2": body.address_line2,
        "city":          body.city,
        "state":         body.state,
        "pincode":       body.pincode,
        "is_default":    body.is_default,
    }
    db.addresses.update_one({"_id": oid}, {"$set": update})
    updated = db.addresses.find_one({"_id": oid})
    return {"success": True, "data": _addr_to_dict(updated)}


@router.delete("/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    oid = get_object_id(address_id, "address")

    result = db.addresses.delete_one({"_id": oid, "user_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Address not found.")


@router.put("/addresses/{address_id}/default")
def set_default_address(
    address_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    oid = get_object_id(address_id, "address")

    existing = db.addresses.find_one({"_id": oid, "user_id": current_user["_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found.")

    db.addresses.update_many(
        {"user_id": current_user["_id"]},
        {"$set": {"is_default": False}},
    )
    db.addresses.update_one({"_id": oid}, {"$set": {"is_default": True}})
    return {"success": True, "message": "Default address updated."}


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
    oid = get_object_id(body.product_id, "product")

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


# ─── Admin — user role management ────────────────────────────────────────────
# Separate no-prefix router — lives under /admin/users. Moved here from the
# former monolithic admin.py.

admin_router = APIRouter(tags=["Admin"])


class RoleUpdateRequest(BaseModel):
    role: str


@admin_router.get("/admin/users")
def admin_list_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return user_admin_service.admin_list_users(db, search, role, page, limit)


@admin_router.put("/admin/users/{user_id}/role")
def admin_update_user_role(
    user_id: str,
    body: RoleUpdateRequest,
    db: Database = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    return user_admin_service.admin_update_role(db, admin["_id"], user_id, body.role)
