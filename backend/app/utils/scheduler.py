"""
Background job scheduler — in-process APScheduler, started/stopped from
main.py's lifespan.

Runs inside every gunicorn worker process (render.yaml runs `-w 2`) — there's
no cross-worker coordination, so any job registered here that touches shared
state (Mongo) must be safe to run concurrently across workers on its own
(e.g. via an atomic find_one_and_update "claim" per document, as
cart_service.find_and_remind_abandoned_carts does).

BackgroundScheduler (thread-based) rather than AsyncIOScheduler — every job
in this app is a plain synchronous function over synchronous pymongo, same
as every route handler, so there's no need to coordinate with an asyncio
event loop.
"""

import logging
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

logger = logging.getLogger("app.scheduler")

_scheduler = BackgroundScheduler()


def add_interval_job(func, minutes: int, job_id: str) -> None:
    _scheduler.add_job(func, IntervalTrigger(minutes=minutes), id=job_id, replace_existing=True)


def add_daily_job(func, hour: int, minute: int, job_id: str, timezone: str = "Asia/Kolkata") -> None:
    _scheduler.add_job(func, CronTrigger(hour=hour, minute=minute, timezone=timezone), id=job_id, replace_existing=True)


def claim_daily_run(db: Database, job_id: str) -> bool:
    """
    For a daily job with no natural per-document lock to grab (unlike
    cart_service's per-cart claim) — returns True if the caller should
    proceed with today's run of `job_id`, False if another worker process
    (gunicorn -w 2, each running its own scheduler) already claimed it today.

    Tracked in a tiny `scheduled_jobs` collection keyed by job_id, storing
    only the date it last ran. insert_one only ever succeeds once, on the
    very first run ever for a given job_id; every run after that (including
    the next day) goes through the plain conditional update_one, which is
    atomic per document — exactly one worker's claim can succeed per day.
    """
    today = date.today().isoformat()
    try:
        db.scheduled_jobs.insert_one({"_id": job_id, "last_run_date": today})
        return True
    except DuplicateKeyError:
        pass

    result = db.scheduled_jobs.update_one(
        {"_id": job_id, "last_run_date": {"$ne": today}},
        {"$set": {"last_run_date": today}},
    )
    return result.modified_count == 1


def start() -> None:
    if not _scheduler.running:
        _scheduler.start()
        logger.info("Background scheduler started")


def shutdown() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Background scheduler stopped")
