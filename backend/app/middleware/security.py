"""
Security-focused HTTP middleware: blocks MongoDB operator injection in query
params, and adds the same defense-in-depth headers Vercel's edge already
applies to the frontend (see vercel.json) — this API is a separate origin
that browsers/tools can hit directly (e.g. /docs, /redoc), so it needs its
own copy.
"""
import re

from fastapi import Request
from fastapi.responses import JSONResponse

from app.config import settings

_MONGO_OP = re.compile(r'\$[a-zA-Z]')


async def block_mongo_injection(request: Request, call_next):
    """Reject requests whose query params contain MongoDB operator characters ($word)."""
    for key, val in request.query_params.items():
        if _MONGO_OP.search(key) or _MONGO_OP.search(val):
            return JSONResponse(
                status_code=422,
                content={"detail": "Invalid characters in request parameters."},
            )
    return await call_next(request)


async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    # Only in production — /docs is disabled there anyway (see docs_url in
    # main.py), so this API only ever serves JSON and can be locked all the
    # way down. Skipped when DEBUG=True so the local Swagger UI (which loads
    # its own CDN-hosted JS/CSS) keeps working exactly as before in dev.
    if not settings.DEBUG:
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response
