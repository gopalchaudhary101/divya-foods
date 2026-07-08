import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, ping_database
from app.limiter import limiter
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

_MONGO_OP = re.compile(r'\$[a-zA-Z]')


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application startup and shutdown.
    Everything before `yield` runs on startup; everything after runs on shutdown.
    This replaces the deprecated @app.on_event("startup") pattern.
    """
    connect_to_mongo()
    yield
    close_mongo_connection()


app = FastAPI(
    title="Divya Luxury Seafoods API",
    description=(
        "Premium Seafood & Global Gourmet Platform — REST API\n\n"
        "Built with FastAPI + MongoDB Atlas. "
        "All endpoints follow REST conventions with structured JSON responses."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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


# ─── Health Endpoints ─────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "message": "Divya Luxury Seafoods API is running",
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
