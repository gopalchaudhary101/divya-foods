"""
Address collection schema.

Key design decision:
  Addresses are stored in a SEPARATE collection (not embedded in the user document)
  because a user can have multiple addresses and manages them independently.

  HOWEVER — when an order is placed, we EMBED a snapshot of the address INTO
  the order document. This means even if the user later edits or deletes the
  address, the order always shows what address it was shipped to.

  This pattern — separate collection for management, embedded snapshot for
  immutable records — is a standard MongoDB design pattern.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.base import MongoBaseModel, PyObjectId, utcnow


# ─── Embedded snapshot (used inside Order documents) ──────────────────────────

class AddressSnapshot(BaseModel):
    """
    Frozen copy of an address captured at order-creation time.
    Not a full MongoDB document — no _id, no user_id.
    """
    label: str
    full_name: str
    phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    pincode: str


# ─── Request Schemas ──────────────────────────────────────────────────────────

class AddressCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=50, examples=["Home", "Office"])
    full_name: str = Field(..., min_length=2)
    phone: str = Field(..., pattern=r"^\+?[0-9]{10,15}$")
    address_line1: str = Field(..., min_length=5)
    address_line2: Optional[str] = None
    city: str
    state: str
    pincode: str = Field(..., pattern=r"^[0-9]{6}$")
    is_default: bool = False


class AddressUpdate(BaseModel):
    label: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    is_default: Optional[bool] = None


# ─── Database Schema ──────────────────────────────────────────────────────────

class AddressInDB(MongoBaseModel):
    user_id: PyObjectId
    label: str
    full_name: str
    phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    pincode: str
    is_default: bool = False
    created_at: datetime = Field(default_factory=utcnow)


# ─── Response Schema ──────────────────────────────────────────────────────────

class AddressResponse(MongoBaseModel):
    user_id: PyObjectId
    label: str
    full_name: str
    phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    pincode: str
    is_default: bool
    created_at: datetime
