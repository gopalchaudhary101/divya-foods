"""
Image upload endpoints — Cloudinary CDN, with an automatic optimization pipeline.

POST /upload/image
  - Admin-only (requires require_admin dependency)
  - Accepts multipart/form-data with a single file field named "file"
  - Returns { url, publicId, width, height, duplicate }

POST /upload/images
  - Same pipeline, for up to 30 files at once (field "files")
  - Returns { data: [{ filename, url, publicId, width, height, duplicate } | { filename, error }] }
  - Per-file failures don't abort the batch — each result reports its own outcome

Pipeline (runs on every upload, single or batch), limits from settings_service.get_upload_settings:
  1. Reject unsupported MIME types / oversized files (admin-configurable list + limit)
  2. SHA-256 the raw bytes — if an identical file was uploaded before, reuse its Cloudinary
     URL instead of re-uploading (response has "duplicate": true)
  3. Decode with Pillow and verify the file isn't corrupted / isn't a mismatched extension
  4. Auto-correct orientation from EXIF, then re-encode (which drops all other metadata —
     GPS, camera info, etc. — since Pillow doesn't carry it over unless asked to)
  5. Downscale to fit within the configured max dimension, aspect ratio preserved
     (Pillow also enforces its own decompression-bomb guard on absurd pixel counts)
  6. Upload the cleaned bytes to Cloudinary, which then serves adaptive quality and
     auto WebP/AVIF/JPEG per browser, cached at the CDN edge — no local pipeline
     duplicates that part of the job.

If Cloudinary is not configured, returns 503 with a clear message —
the admin panel gracefully shows that message instead of crashing.
"""

import hashlib
from datetime import datetime, timezone
from io import BytesIO

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pymongo.database import Database

from app.config import settings
from app.dependencies import get_db, require_admin
from app.limiter import limiter
from app.services import settings_service

router = APIRouter(prefix="/upload", tags=["Upload"])

MAX_BATCH_FILES = 30

_FORMAT_MIME = {"jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
_FORMAT_LABEL = {"jpeg": "JPEG", "png": "PNG", "webp": "WebP"}


def _require_cloudinary_configured() -> None:
    if not all([settings.CLOUDINARY_CLOUD_NAME, settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET]):
        raise HTTPException(
            status_code=503,
            detail=(
                "Image upload is not configured. "
                "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET "
                "as Railway environment variables."
            ),
        )


def _configure_cloudinary() -> None:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def _process_image(contents: bytes, max_dimension: int) -> bytes:
    """
    Validates + cleans an uploaded image. Raises HTTPException(400) if the file is
    corrupted, unreadable, or an absurd pixel count (Pillow's decompression-bomb guard).
    Returns re-encoded bytes: EXIF-orientation-corrected, metadata stripped, downscaled
    to fit max_dimension on the longest side (aspect ratio preserved, never upscaled).
    """
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

    if max(img.size) > max_dimension:
        img.thumbnail((max_dimension, max_dimension), Image.LANCZOS)

    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    out = BytesIO()
    if has_alpha:
        img.convert("RGBA").save(out, format="PNG", optimize=True)
    else:
        img.convert("RGB").save(out, format="JPEG", quality=95, optimize=True)
    return out.getvalue()


def _hash_bytes(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()


def _upload_bytes(contents: bytes, upload_settings: dict) -> dict:
    fetch_format = "auto" if (upload_settings["enableWebP"] or upload_settings["enableAVIF"]) else "jpg"
    result = cloudinary.uploader.upload(
        BytesIO(contents),
        folder="divyafoods/products",
        resource_type="image",
        transformation=[
            {"width": 800, "height": 800, "crop": "fill", "gravity": "auto"},
            {"quality": upload_settings["compressionQuality"], "fetch_format": fetch_format},
        ],
    )
    return {
        "url": result["secure_url"],
        "publicId": result["public_id"],
        "width": result.get("width", 800),
        "height": result.get("height", 800),
    }


def _validate_and_upload(contents: bytes, content_type: str, upload_settings: dict, db: Database) -> dict:
    """Full pipeline for one file: type/size guard → dedup lookup → process → upload → record hash."""
    allowed_mimes = {_FORMAT_MIME[f] for f in upload_settings["allowedFormats"] if f in _FORMAT_MIME}
    if content_type not in allowed_mimes:
        labels = ", ".join(_FORMAT_LABEL.get(f, f.upper()) for f in upload_settings["allowedFormats"])
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{content_type}'. Allowed: {labels}.")

    max_bytes = upload_settings["maxUploadSizeMB"] * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(contents) // 1024} KB). Maximum allowed size is {upload_settings['maxUploadSizeMB']} MB.",
        )

    file_hash = _hash_bytes(contents)
    existing = db.image_hashes.find_one({"_id": file_hash})
    if existing:
        return {
            "url": existing["url"], "publicId": existing["publicId"],
            "width": existing["width"], "height": existing["height"],
            "duplicate": True,
        }

    processed = _process_image(contents, upload_settings["maxImageDimension"])
    uploaded = _upload_bytes(processed, upload_settings)
    db.image_hashes.update_one(
        {"_id": file_hash},
        {"$setOnInsert": {**uploaded, "createdAt": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {**uploaded, "duplicate": False}


@router.post("/image", summary="Upload product image to Cloudinary CDN")
@limiter.limit("20/minute")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    _require_cloudinary_configured()
    upload_settings = settings_service.get_upload_settings(db)
    contents = await file.read()

    try:
        _configure_cloudinary()
        result = _validate_and_upload(contents, file.content_type, upload_settings, db)
        return {"success": True, **result}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc


@router.post("/images", summary="Upload multiple product images to Cloudinary CDN")
@limiter.limit("10/minute")
async def upload_images(
    request: Request,
    files: list[UploadFile] = File(...),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    _require_cloudinary_configured()
    upload_settings = settings_service.get_upload_settings(db)

    if len(files) > MAX_BATCH_FILES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_BATCH_FILES} files per batch.")

    _configure_cloudinary()

    results = []
    for f in files:
        contents = await f.read()
        try:
            result = _validate_and_upload(contents, f.content_type, upload_settings, db)
            results.append({"filename": f.filename, **result})
        except HTTPException as exc:
            results.append({"filename": f.filename, "error": exc.detail})
        except Exception as exc:
            results.append({"filename": f.filename, "error": f"Upload failed: {exc}"})

    return {"success": True, "data": results}
