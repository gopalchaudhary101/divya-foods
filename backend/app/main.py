import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.config import settings

# Without this, Python's root logger has no handler until the "last resort"
# stderr fallback kicks in at WARNING — every logger.info() in this codebase
# (Mongo connect, scheduler start/stop, "email sent", etc.) would be invisible
# in Railway/Fly logs, and logger.error()/exception() calls would print with
# no timestamp or module name.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
# Only OUR OWN loggers (all named "app.*") get bumped to DEBUG in local dev —
# the root stays at INFO so third-party libraries (pymongo, httpx, passlib...)
# don't flood the console with wire-protocol/internals chatter.
logging.getLogger("app").setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment="debug" if settings.DEBUG else "production",
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
    )
from app.database import connect_to_mongo, close_mongo_connection, ping_database
from app.limiter import limiter
from app.middleware.security import block_mongo_injection, security_headers
from app.middleware.caching import cache_control_headers
from app.services import cart_service, product_service
from app.utils import scheduler
from app.routers import (
    auth, products, categories, orders, cart,
    users, coupons, banners, reviews,
)
from app.routers import notifications, chat, upload, referrals, bundles
from app.routers import loyalty, flash_sales, qa, subscriptions, settings as settings_router
from app.routers import sitemap
from app.routers import bulk_orders
from app.routers import gift_cards
from app.routers import driver
from app.routers import webhooks
from app.routers import contact
from app.routers import recipes
from app.routers import whatsapp
from app.routers import admin_products, admin_analytics


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application startup and shutdown.
    Everything before `yield` runs on startup; everything after runs on shutdown.
    This replaces the deprecated @app.on_event("startup") pattern.
    """
    connect_to_mongo()
    scheduler.add_interval_job(cart_service.run_abandoned_cart_job, minutes=30, job_id="abandoned_cart_reminders")
    scheduler.add_daily_job(product_service.run_low_stock_digest_job, hour=9, minute=0, job_id="low_stock_digest")
    scheduler.start()
    yield
    scheduler.shutdown()
    close_mongo_connection()


app = FastAPI(
    title="Divya Foods API",
    description=(
        "Premium Seafood & Global Gourmet Platform — REST API\n\n"
        "Built with FastAPI + MongoDB Atlas. "
        "All endpoints follow REST conventions with structured JSON responses."
    ),
    version="1.0.0",
    # Swagger/ReDoc hand out the full API schema (every route, every field name)
    # as reconnaissance material — only serve them outside production.
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compresses any response over 1KB (JSON product listings, sitemap.xml) — same
# effect as the gzip/brotli Vercel already applies to the frontend's own assets.
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Registered in this exact order — Starlette layers each @middleware("http")
# equivalent innermost-last, so this preserves the original request/response
# pipeline: Mongo-injection guard first, then security headers, then caching.
app.middleware("http")(block_mongo_injection)
app.middleware("http")(security_headers)
app.middleware("http")(cache_control_headers)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(categories.router)
app.include_router(orders.router)
app.include_router(orders.admin_router)
app.include_router(cart.router)
app.include_router(users.router)
app.include_router(users.admin_router)
app.include_router(coupons.router)
app.include_router(coupons.admin_router)
app.include_router(banners.router)
app.include_router(banners.admin_router)
app.include_router(reviews.router)
app.include_router(notifications.router)
app.include_router(chat.router)
app.include_router(upload.router)
app.include_router(referrals.router)
app.include_router(bundles.router)
app.include_router(bundles.admin_router)
app.include_router(loyalty.router)
app.include_router(flash_sales.router)
app.include_router(qa.router)
app.include_router(qa.admin_router)
app.include_router(subscriptions.router)
app.include_router(subscriptions.admin_router)
app.include_router(settings_router.router)
app.include_router(settings_router.admin_router)
app.include_router(sitemap.router)
app.include_router(bulk_orders.router)
app.include_router(gift_cards.router)
app.include_router(driver.router)
app.include_router(driver.admin_router)
app.include_router(webhooks.router)
app.include_router(contact.router)
app.include_router(recipes.router)
app.include_router(recipes.admin_router)
app.include_router(whatsapp.router)
app.include_router(whatsapp.admin_router)
app.include_router(admin_products.router)
app.include_router(admin_analytics.router)


# ─── Health Endpoints ─────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "message": "Divya Foods API is running",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health_check():
    """
    Returns API + database status.
    Used by deployment platforms (Render, Railway) to confirm the service is live.
    """
    db_ok = ping_database()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "version": "1.0.0",
    }
