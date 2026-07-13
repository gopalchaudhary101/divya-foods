"""
Cache-Control middleware for public, non-personalized GET endpoints — lets
the browser (and any future CDN) skip a round trip for a short window
instead of hitting MongoDB on literally every request from every visitor.
"""
from fastapi import Request

# GET-only, public, no per-user variance, and rarely change — deliberately a
# narrow allowlist: nothing personalized (orders/cart/users/admin/...) is
# ever included here.
_CACHEABLE_GET_PREFIXES = ("/categories", "/banners", "/products/featured", "/products/best-sellers", "/products", "/recipes", "/whatsapp/config")


async def cache_control_headers(request: Request, call_next):
    response = await call_next(request)
    if request.method == "GET" and request.url.path.startswith(_CACHEABLE_GET_PREFIXES):
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return response
