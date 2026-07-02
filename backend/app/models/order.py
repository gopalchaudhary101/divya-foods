"""
Order collection schema — the most complex document in the system.

Key design decisions:

1. ORDER_NUMBER: human-readable ID like "DF-2024-001234" stored alongside
   the ObjectId. Customers see this in emails and tracking pages.

2. EMBEDDED ITEMS: product info (name, price, image) is embedded in the order
   document — NOT referenced. If the product is deleted or its price changes
   later, the order still shows exactly what was ordered at what price.
   This is the "point-in-time snapshot" pattern.

3. EMBEDDED DELIVERY_ADDRESS: same reason as items — the address is frozen at
   order time. The user may edit their addresses later; the order shouldn't change.

4. TRACKING_TIMELINE: an array of status events appended over time.
   Each entry is immutable — we only ever append, never edit.
   e.g. [
     {"status": "confirmed",  "timestamp": ..., "note": "Payment received"},
     {"status": "shipped",    "timestamp": ..., "note": "Dispatched via BlueDart"},
     {"status": "delivered",  "timestamp": ..., "note": "Delivered"},
   ]

5. PAYMENT fields: both Razorpay IDs are stored so we can reconcile payments
   in the admin panel and handle refunds.
"""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.address import AddressSnapshot
from app.models.base import MongoBaseModel, PyObjectId, utcnow


# ─── Supporting types ─────────────────────────────────────────────────────────

OrderStatus = Literal[
    "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"
]
PaymentStatus = Literal["pending", "paid", "failed", "refunded"]
PaymentMethod = Literal["razorpay", "cod"]


class OrderItem(BaseModel):
    """Snapshot of a product at purchase time — embedded in the order."""
    product_id: PyObjectId
    name: str
    price: float          # price at time of purchase
    quantity: int
    image: str


class TrackingEvent(BaseModel):
    """Immutable event appended to the timeline when order status changes."""
    status: str
    timestamp: datetime = Field(default_factory=utcnow)
    note: Optional[str] = None


# ─── Request Schemas ──────────────────────────────────────────────────────────

class OrderCreate(BaseModel):
    delivery_address_id: PyObjectId   # user picks a saved address
    payment_method: PaymentMethod
    coupon_code: Optional[str] = None
    notes: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    note: Optional[str] = None


# ─── Database Schema ──────────────────────────────────────────────────────────

class OrderInDB(MongoBaseModel):
    order_number: str                        # "DF-2024-001234"
    user_id: PyObjectId
    items: List[OrderItem]
    status: OrderStatus = "pending"
    payment_status: PaymentStatus = "pending"
    payment_method: PaymentMethod
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    delivery_address: AddressSnapshot        # frozen snapshot
    subtotal: float
    delivery_charge: float
    discount: float = 0.0
    total: float
    coupon_code: Optional[str] = None
    notes: Optional[str] = None
    tracking_timeline: List[TrackingEvent] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


# ─── Response Schemas ─────────────────────────────────────────────────────────

class OrderResponse(MongoBaseModel):
    order_number: str
    user_id: PyObjectId
    items: List[OrderItem]
    status: OrderStatus
    payment_status: PaymentStatus
    payment_method: PaymentMethod
    delivery_address: AddressSnapshot
    subtotal: float
    delivery_charge: float
    discount: float
    total: float
    coupon_code: Optional[str] = None
    notes: Optional[str] = None
    tracking_timeline: List[TrackingEvent]
    created_at: datetime
    updated_at: datetime


# ─── Razorpay Schemas ─────────────────────────────────────────────────────────

class RazorpayVerifyRequest(BaseModel):
    """Sent from the frontend after Razorpay payment is completed."""
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    order_id: PyObjectId     # our internal order ObjectId
