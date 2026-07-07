"""
Cart collection schema.

Design: ONE cart document per user (one-to-one relationship).
Items are fully embedded — no need to look up products separately to render the cart.

When checkout begins, we re-validate prices and stock against the products
collection to ensure nothing has changed since items were added.
"""

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field

from app.models.base import MongoBaseModel, PyObjectId, utcnow


class CartItemModel(BaseModel):
    product_id: PyObjectId
    name: str
    price: float
    quantity: int = Field(..., ge=1)
    image: str
    max_quantity: int    # current stock — used to cap quantity in the UI


class CartAddItem(BaseModel):
    product_id: PyObjectId
    quantity: int = Field(..., ge=1)


class CartUpdateItem(BaseModel):
    product_id: PyObjectId
    quantity: int = Field(..., ge=1)


class CartInDB(MongoBaseModel):
    user_id: PyObjectId                             # unique index — one cart per user
    items: List[CartItemModel] = []
    updated_at: datetime = Field(default_factory=utcnow)


class CartResponse(MongoBaseModel):
    user_id: PyObjectId
    items: List[CartItemModel]
    total_items: int = 0
    total_price: float = 0.0
    updated_at: datetime

    @classmethod
    def from_db(cls, cart: CartInDB) -> "CartResponse":
        total_items = sum(i.quantity for i in cart.items)
        total_price = sum(i.price * i.quantity for i in cart.items)
        data = cart.model_dump(by_alias=True)
        data["total_items"] = total_items
        data["total_price"] = round(total_price, 2)
        return cls(**data)
