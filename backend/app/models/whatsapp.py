"""
WhatsApp integration schema.

Fields are camelCase to match the frontend directly (same convention as
SettingsUpdateRequest in app/routers/admin.py) — no snake_case translation
layer, since whatsapp_service's config dict is itself stored camelCase.

Two independent layers, both admin-configurable:
  1. Click-to-chat "Share on WhatsApp" buttons — just need `phoneNumber` and
     the message templates below. No Meta API involved.
  2. The Cloud API auto-reply webhook (see app/routers/whatsapp.py) — needs
     the WHATSAPP_* env vars in app/config.py in addition to `enabled` here.
"""

from typing import Optional

from pydantic import BaseModel, Field


class WhatsAppConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    phoneNumber: Optional[str] = Field(None, min_length=8, max_length=15, pattern=r"^\d+$")
    productMessageTemplate: Optional[str] = Field(None, min_length=10, max_length=1000)
    cartMessageTemplate: Optional[str] = Field(None, min_length=10, max_length=1000)
    orderMessageTemplate: Optional[str] = Field(None, min_length=10, max_length=1000)


class TrackShareRequest(BaseModel):
    productId: str = Field(..., min_length=1)
    productName: str = Field(..., min_length=1, max_length=200)
    source: str = Field(..., pattern="^(product_card|product_detail|cart|order)$")
