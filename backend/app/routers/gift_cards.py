"""
Gift cards router — admin issue/list/manage. Redemption at checkout happens
inside order_service (via gift_card_service.find_redeemable/commit_redemption),
not here; there is no public endpoint for looking up a gift card's balance
outside of a checkout attempt, to avoid turning this into a code-guessing oracle.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from pymongo.database import Database

from app.dependencies import get_db, require_admin
from app.services import gift_card_service

router = APIRouter(prefix="/admin/gift-cards", tags=["Gift Cards"])


class GiftCardIssueBody(BaseModel):
    value: float
    code: Optional[str] = None
    issued_to_email: Optional[str] = None
    notes: Optional[str] = None
    expires_at: Optional[datetime] = None


class GiftCardUpdateBody(BaseModel):
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    expires_at: Optional[datetime] = None


@router.post("")
def issue_gift_card(
    body: GiftCardIssueBody,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return gift_card_service.admin_issue(db, body.model_dump())


@router.get("")
def list_gift_cards(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    return gift_card_service.admin_list(db, page, limit)


@router.put("/{gift_card_id}")
def update_gift_card(
    gift_card_id: str,
    body: GiftCardUpdateBody,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    payload = body.model_dump(exclude_none=True)
    return gift_card_service.admin_update(db, gift_card_id, payload)
