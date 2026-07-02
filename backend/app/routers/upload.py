"""
Image upload endpoint — Cloudinary CDN.

POST /upload/image
  - Admin-only (requires require_admin dependency)
  - Accepts multipart/form-data with a single file field named "file"
  - Validates MIME type (JPEG / PNG / WebP) and size (≤ 5 MB)
  - Uploads to Cloudinary under the "divyafoods/products" folder
  - Applies automatic resizing to 800×800 and quality optimisation
  - Returns { url, publicId, width, height }

If Cloudinary is not configured, returns 503 with a clear message —
the admin panel gracefully shows that message instead of crashing.
"""

from io import BytesIO

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import settings
from app.dependencies import require_admin

router = APIRouter(prefix="/upload", tags=["Upload"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/image", summary="Upload product image to Cloudinary CDN")
async def upload_image(
    file: UploadFile = File(...),
    _admin: dict = Depends(require_admin),
):
    # Guard: Cloudinary must be configured
    if not all([settings.CLOUDINARY_CLOUD_NAME, settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET]):
        raise HTTPException(
            status_code=503,
            detail=(
                "Image upload is not configured. "
                "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET "
                "as Railway environment variables."
            ),
        )

    # Validate MIME type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: JPEG, PNG, WebP.",
        )

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(contents) // 1024} KB). Maximum allowed size is 5 MB.",
        )

    try:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )

        result = cloudinary.uploader.upload(
            BytesIO(contents),
            folder="divyafoods/products",
            resource_type="image",
            transformation=[
                {"width": 800, "height": 800, "crop": "fill", "gravity": "auto"},
                {"quality": "auto:good", "fetch_format": "auto"},
            ],
        )

        return {
            "success": True,
            "url": result["secure_url"],
            "publicId": result["public_id"],
            "width": result.get("width", 800),
            "height": result.get("height", 800),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc
