"""
Small MongoDB-adjacent helpers shared across services.

get_object_id() centralizes a pattern that used to be copy-pasted
independently in ~10 service files (banner_service, bulk_order_service,
driver_service, gift_card_service, order_service, product_service,
recipe_service, return_service, user_admin_service): validate a string is a
real ObjectId, or raise a 400 with a friendly message if it isn't.
"""

from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status


def get_object_id(id_str: str, label: str = "resource") -> ObjectId:
    """Converts a string to an ObjectId, raising HTTP 400 if it isn't a valid one."""
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {label} ID.")


def get_optional_object_id(id_str: Optional[str], label: str = "resource") -> Optional[ObjectId]:
    """Same as get_object_id, but passes through None/empty untouched instead
    of raising — for optional fields like an update payload's categoryId."""
    if not id_str:
        return None
    return get_object_id(id_str, label)
