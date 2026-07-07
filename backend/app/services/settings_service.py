"""Site settings service — a single document holding legal/company info (GST, FSSAI, etc.),
admin-configurable image-upload limits, and the configurable delivery-provider list."""

from datetime import datetime, timezone

from pymongo.database import Database

_SETTINGS_ID = "site_settings"

_DEFAULTS = {
    "businessName": "Divya Luxury Seafoods",
    "gstNumber": "07CEZPJ6770F1ZU",
    "fssaiNumber": "13323010000427",
}

# Image-upload limits — admin-only, not exposed via the public endpoint.
# Defaults match the hardcoded values the /upload endpoints used before this
# became configurable, so existing behaviour is unchanged until an admin edits them.
_UPLOAD_DEFAULTS = {
    "maxUploadSizeMB":    5,
    "maxImageDimension":  6000,       # longest side, in px, before an aspect-ratio-preserving downscale
    "compressionQuality": "auto:good",  # Cloudinary quality string: auto:eco | auto:good | auto:best
    "allowedFormats":     ["jpeg", "png", "webp"],
    "enableWebP":         True,
    "enableAVIF":         True,
    "thumbnailSizes":     [150, 400, 800],
}


def _to_dict(doc: dict) -> dict:
    return {
        "businessName": doc.get("businessName", _DEFAULTS["businessName"]),
        "gstNumber":    doc.get("gstNumber", _DEFAULTS["gstNumber"]),
        "fssaiNumber":  doc.get("fssaiNumber", _DEFAULTS["fssaiNumber"]),
    }


# Delivery — admin-only. The provider list is configurable so new logistics
# companies (Porter, Dunzo, in-house riders, ...) can be added without a code change.
_DELIVERY_DEFAULTS = {
    "deliveryProviders": ["Porter", "Dunzo", "In-house", "Other"],
}

# Membership tiers — computed from a customer's lifetime paid spend. Thresholds and
# perks are admin-configurable so they can be tuned without a code change.
_MEMBERSHIP_DEFAULTS = {
    "goldThreshold":         10000.0,   # lifetime paid spend (INR) to reach Gold
    "platinumThreshold":     30000.0,   # lifetime paid spend (INR) to reach Platinum
    "goldFreeDeliveryAbove": 499.0,     # Gold members get free delivery above this order value
    "platinumFreeDelivery":  True,      # Platinum members always get free delivery
}


def _to_admin_dict(doc: dict) -> dict:
    base = _to_dict(doc)
    for field, default in {**_UPLOAD_DEFAULTS, **_DELIVERY_DEFAULTS, **_MEMBERSHIP_DEFAULTS}.items():
        base[field] = doc.get(field, default)
    return base


def get_public(db: Database) -> dict:
    """Public settings — safe to expose to any visitor (Footer, About, Checkout)."""
    doc = db.settings.find_one({"_id": _SETTINGS_ID}) or {}
    return {"success": True, "data": _to_dict(doc)}


def admin_get(db: Database) -> dict:
    """Public fields plus admin-only image-upload configuration."""
    doc = db.settings.find_one({"_id": _SETTINGS_ID}) or {}
    return {"success": True, "data": _to_admin_dict(doc)}


_EDITABLE_FIELDS = {*_DEFAULTS.keys(), *_UPLOAD_DEFAULTS.keys(), *_DELIVERY_DEFAULTS.keys(), *_MEMBERSHIP_DEFAULTS.keys()}


def admin_update(db: Database, payload: dict) -> dict:
    update = {k: v for k, v in payload.items() if k in _EDITABLE_FIELDS and v is not None}

    db.settings.update_one(
        {"_id": _SETTINGS_ID},
        {"$set": {**update, "updatedAt": datetime.now(timezone.utc)}},
        upsert=True,
    )
    doc = db.settings.find_one({"_id": _SETTINGS_ID})
    return {"success": True, "data": _to_admin_dict(doc)}


def get_upload_settings(db: Database) -> dict:
    """Used internally by the /upload endpoints — resolved image-upload limits with defaults applied."""
    doc = db.settings.find_one({"_id": _SETTINGS_ID}) or {}
    return {field: doc.get(field, default) for field, default in _UPLOAD_DEFAULTS.items()}


def get_membership_settings(db: Database) -> dict:
    """Used internally by loyalty/order services — resolved membership thresholds/perks."""
    doc = db.settings.find_one({"_id": _SETTINGS_ID}) or {}
    return {field: doc.get(field, default) for field, default in _MEMBERSHIP_DEFAULTS.items()}
