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

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger("app.scheduler")

_scheduler = BackgroundScheduler()


def add_interval_job(func, minutes: int, job_id: str) -> None:
    _scheduler.add_job(func, IntervalTrigger(minutes=minutes), id=job_id, replace_existing=True)


def start() -> None:
    if not _scheduler.running:
        _scheduler.start()
        logger.info("Background scheduler started")


def shutdown() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Background scheduler stopped")
