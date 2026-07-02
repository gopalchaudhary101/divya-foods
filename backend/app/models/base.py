"""
Base classes shared by every Pydantic model in this project.

PyObjectId: converts MongoDB's ObjectId (a binary type) into a plain string
so it can be sent in JSON responses and accepted in request bodies.

MongoBaseModel: every collection's schema inherits from this.
It maps MongoDB's "_id" field to Python's "id" attribute.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Optional

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _coerce_object_id(v: Any) -> str:
    """Accept either an ObjectId or a 24-char hex string; return a string."""
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str) and ObjectId.is_valid(v):
        return v
    raise ValueError(f"Invalid ObjectId value: {v!r}")


# Reusable annotated type — use as a field type anywhere you need an ObjectId
PyObjectId = Annotated[str, BeforeValidator(_coerce_object_id)]


class MongoBaseModel(BaseModel):
    """
    Base model for all MongoDB documents.

    - populate_by_name=True  → accept both "id" and "_id" in input data
    - arbitrary_types_allowed → allows ObjectId as a value during processing
    - json_encoders           → serialises ObjectId → str when returning JSON
    """

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str},
    )

    id: Optional[PyObjectId] = Field(default=None, validation_alias="_id")


def utcnow() -> datetime:
    """Return current UTC time. Centralised so it's easy to mock in tests."""
    from datetime import timezone
    return datetime.now(timezone.utc)
