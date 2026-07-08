"""
Abandoned-cart reminder job tests (app/services/cart_service.py).

This job isn't exposed over HTTP — it's driven by the scheduler — so these
tests call find_and_remind_abandoned_carts(db) directly rather than through
the test client.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from tests.conftest import insert_user, insert_category, insert_product

from app.services import cart_service

_ITEM = {"productId": "p1", "name": "Salmon Fillet", "price": 999.0, "quantity": 2, "image": "", "maxQuantity": 10}


def _insert_cart(db, user_id, items=None, hours_since_update=3, reminder_sent_at=None):
    updated_at = datetime.now(timezone.utc) - timedelta(hours=hours_since_update)
    db.carts.insert_one({
        "user_id": user_id,
        "items": items if items is not None else [_ITEM],
        "updated_at": updated_at,
        "reminder_sent_at": reminder_sent_at,
    })


def test_reminds_abandoned_cart(db):
    uid = insert_user(db)
    _insert_cart(db, uid, hours_since_update=3)

    with patch("app.services.email_service.send_async") as mock_send:
        sent = cart_service.find_and_remind_abandoned_carts(db)

    assert sent == 1
    assert mock_send.call_count == 1
    cart = db.carts.find_one({"user_id": uid})
    assert cart["reminder_sent_at"] is not None


def test_does_not_remind_recent_cart(db):
    uid = insert_user(db)
    _insert_cart(db, uid, hours_since_update=1)  # under the 2-hour window

    with patch("app.services.email_service.send_async") as mock_send:
        sent = cart_service.find_and_remind_abandoned_carts(db)

    assert sent == 0
    assert mock_send.call_count == 0


def test_does_not_remind_already_reminded_cart(db):
    uid = insert_user(db)
    already = datetime.now(timezone.utc) - timedelta(hours=1)
    _insert_cart(db, uid, hours_since_update=3, reminder_sent_at=already)

    with patch("app.services.email_service.send_async") as mock_send:
        sent = cart_service.find_and_remind_abandoned_carts(db)

    assert sent == 0
    assert mock_send.call_count == 0


def test_does_not_remind_empty_cart(db):
    uid = insert_user(db)
    _insert_cart(db, uid, items=[], hours_since_update=3)

    sent = cart_service.find_and_remind_abandoned_carts(db)
    assert sent == 0


def test_second_scan_does_not_double_send(db):
    """Approximates the cross-worker-safety property: once a cart is claimed
    (reminder_sent_at set), a second scan of the same unchanged cart must not
    send again — this is what actually prevents duplicate sends if two
    gunicorn workers run the job at the same time."""
    uid = insert_user(db)
    _insert_cart(db, uid, hours_since_update=3)

    with patch("app.services.email_service.send_async") as mock_send:
        first = cart_service.find_and_remind_abandoned_carts(db)
        second = cart_service.find_and_remind_abandoned_carts(db)

    assert first == 1
    assert second == 0
    assert mock_send.call_count == 1


def test_reminds_multiple_eligible_carts(db):
    uid1 = insert_user(db, email="user1@test.com")
    uid2 = insert_user(db, email="user2@test.com")
    _insert_cart(db, uid1, hours_since_update=3)
    _insert_cart(db, uid2, hours_since_update=5)

    with patch("app.services.email_service.send_async") as mock_send:
        sent = cart_service.find_and_remind_abandoned_carts(db)

    assert sent == 2
    assert mock_send.call_count == 2


def test_skips_cart_for_deleted_user(db):
    uid = insert_user(db)
    _insert_cart(db, uid, hours_since_update=3)
    db.users.delete_one({"_id": uid})

    with patch("app.services.email_service.send_async") as mock_send:
        sent = cart_service.find_and_remind_abandoned_carts(db)

    assert sent == 0
    assert mock_send.call_count == 0
    # Still claimed (reminder_sent_at set) so it isn't retried forever on every scan.
    cart = db.carts.find_one({"user_id": uid})
    assert cart["reminder_sent_at"] is not None
