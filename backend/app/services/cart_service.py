"""
Cart service — abandoned-cart reminder job.

Cart mutations themselves stay in app/routers/cart.py, as before — this
service only adds the periodic reminder scan, wired into app.utils.scheduler
from main.py's lifespan.
"""

import logging
from datetime import datetime, timedelta, timezone

from pymongo.database import Database

from app.database import get_database
from app.services import email_service

logger = logging.getLogger("app.cart")

ABANDONED_CART_HOURS = 2


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def find_and_remind_abandoned_carts(db: Database) -> int:
    """
    Finds carts with items, untouched for ABANDONED_CART_HOURS, that haven't
    already been reminded since their last change — sends one reminder email
    each. Returns how many reminders were actually sent.

    Every cart.py mutation resets reminder_sent_at back to None, so a customer
    who returns and abandons again after a reminder is eligible for a fresh one.

    Atomically claims each cart (find_one_and_update gated on
    reminder_sent_at=None) before sending, so this running in more than one
    gunicorn worker process at once — there's no cross-worker coordination —
    can't send two reminders for the same cart.
    """
    cutoff = _utcnow() - timedelta(hours=ABANDONED_CART_HOURS)
    candidates = list(db.carts.find({
        "items.0": {"$exists": True},
        "updated_at": {"$lt": cutoff},
        "reminder_sent_at": None,
    }))

    sent = 0
    for cart in candidates:
        claimed = db.carts.find_one_and_update(
            {"_id": cart["_id"], "reminder_sent_at": None},
            {"$set": {"reminder_sent_at": _utcnow()}},
        )
        if not claimed:
            continue  # a concurrent worker process already claimed this cart

        user = db.users.find_one({"_id": cart["user_id"]}, {"email": 1, "name": 1})
        if not user or not user.get("email"):
            continue

        email_service.abandoned_cart_reminder(cart["items"], user.get("name", ""), user["email"])
        sent += 1

    return sent


def run_abandoned_cart_job() -> None:
    """Scheduler entry point — resolves the live db handle at execution time
    (not schedule-setup time), matching how the request-time get_db()
    dependency works. Broad except so one failed run can't kill the
    scheduler thread; the next scheduled run tries again."""
    try:
        sent = find_and_remind_abandoned_carts(get_database())
        if sent:
            logger.info("Sent %d abandoned-cart reminder(s)", sent)
    except Exception:  # noqa: BLE001
        logger.exception("Abandoned-cart reminder job failed")
