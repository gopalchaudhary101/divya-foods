import logging
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
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
from app.services import cart_service, product_service
from app.utils import scheduler
from app.routers import (
    auth, products, categories, orders, cart,
    users, coupons, banners, reviews, admin,
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

_MONGO_OP = re.compile(r'\$[a-zA-Z]')


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


@app.middleware("http")
async def block_mongo_injection(request: Request, call_next):
    """Reject requests whose query params contain MongoDB operator characters ($word)."""
    for key, val in request.query_params.items():
        if _MONGO_OP.search(key) or _MONGO_OP.search(val):
            return JSONResponse(
                status_code=422,
                content={"detail": "Invalid characters in request parameters."},
            )
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """
    Same defense-in-depth headers already applied to the frontend at Vercel's
    edge (see vercel.json) — added here too since this API is a separate
    origin that browsers/tools can hit directly (e.g. /docs, /redoc).
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    # Only in production — /docs is disabled there anyway (see docs_url above),
    # so this API only ever serves JSON and can be locked all the way down.
    # Skipped when DEBUG=True so the local Swagger UI (which loads its own
    # CDN-hosted JS/CSS) keeps working exactly as before in dev.
    if not settings.DEBUG:
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response


# GET-only, public, no per-user variance, and rarely change — safe to let the
# browser (and any future CDN) skip a round trip for a short window instead of
# hitting MongoDB on literally every request from every visitor. Deliberately
# a narrow allowlist: nothing personalized (orders/cart/users/admin/...) is
# ever included here.
_CACHEABLE_GET_PREFIXES = ("/categories", "/banners", "/products/featured", "/products/best-sellers", "/products", "/recipes")


@app.middleware("http")
async def cache_control_headers(request: Request, call_next):
    response = await call_next(request)
    if request.method == "GET" and request.url.path.startswith(_CACHEABLE_GET_PREFIXES):
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return response

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(categories.router)
app.include_router(orders.router)
app.include_router(cart.router)
app.include_router(users.router)
app.include_router(coupons.router)
app.include_router(banners.router)
app.include_router(reviews.router)
app.include_router(admin.router)
app.include_router(notifications.router)
app.include_router(chat.router)
app.include_router(upload.router)
app.include_router(referrals.router)
app.include_router(bundles.router)
app.include_router(loyalty.router)
app.include_router(flash_sales.router)
app.include_router(qa.router)
app.include_router(subscriptions.router)
app.include_router(settings_router.router)
app.include_router(sitemap.router)
app.include_router(bulk_orders.router)
app.include_router(gift_cards.router)
app.include_router(driver.router)
app.include_router(webhooks.router)
app.include_router(contact.router)
app.include_router(recipes.router)


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
