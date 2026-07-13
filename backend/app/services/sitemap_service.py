"""
Dynamic sitemap.xml — replaces the old hand-written static file (which only listed
4 hardcoded URLs) with one generated from the live product/category catalog on
every request, including per-product image entries (the "image sitemap" via the
standard image namespace, embedded rather than a separate file).

The frontend is a static SPA on Vercel; this API is the only place that knows the
current product/category list, so the sitemap is served from here and Vercel proxies
/sitemap.xml to this endpoint (see vercel.json) so it still resolves on the site's
own domain for search engines.
"""

from datetime import datetime, timezone
from xml.sax.saxutils import escape

from pymongo.database import Database

from app.config import settings

_STATIC_PAGES = [
    ("", "daily", "1.0"),
    ("products", "daily", "0.9"),
    ("japanese-grocery", "weekly", "0.8"),
    ("recipes", "weekly", "0.7"),
    ("about", "monthly", "0.5"),
    ("bundles", "weekly", "0.6"),
    ("contact", "monthly", "0.4"),
    ("privacy-policy", "yearly", "0.2"),
    ("terms-and-conditions", "yearly", "0.2"),
    ("refund-policy", "yearly", "0.2"),
    ("shipping-policy", "yearly", "0.2"),
    ("cancellation-policy", "yearly", "0.2"),
    ("cookies-policy", "yearly", "0.2"),
]


def _url_entry(loc: str, lastmod: str = "", changefreq: str = "weekly", priority: str = "0.5", image: dict | None = None) -> str:
    parts = [f"<loc>{escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"<lastmod>{lastmod}</lastmod>")
    parts.append(f"<changefreq>{changefreq}</changefreq>")
    parts.append(f"<priority>{priority}</priority>")
    if image and image.get("url"):
        title = f"<image:title>{escape(image['title'])}</image:title>" if image.get("title") else ""
        parts.append(f"<image:image><image:loc>{escape(image['url'])}</image:loc>{title}</image:image>")
    return f"<url>{''.join(parts)}</url>"


def generate_sitemap_xml(db: Database) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    entries = []

    for path, freq, priority in _STATIC_PAGES:
        loc = f"{base}/{path}" if path else f"{base}/"
        entries.append(_url_entry(loc, today, freq, priority))

    categories = list(db.categories.find({"is_active": True}, {"slug": 1}))
    for cat in categories:
        slug = cat.get("slug")
        if not slug:
            continue
        entries.append(_url_entry(f"{base}/products?category={slug}", today, "weekly", "0.6"))

    # All products, regardless of current stock status — an out-of-stock product
    # page is still valid content and shouldn't drop out of the index temporarily.
    products = list(db.products.find({}, {"slug": 1, "images": 1, "name": 1, "updated_at": 1}))
    for p in products:
        slug = p.get("slug")
        if not slug:
            continue
        lastmod = p["updated_at"].strftime("%Y-%m-%d") if p.get("updated_at") else today
        image = None
        first_image = (p.get("images") or [None])[0]
        if first_image:
            image = {"url": first_image, "title": p.get("name", "")}
        entries.append(_url_entry(f"{base}/products/{slug}", lastmod, "weekly", "0.8", image))

    # Published recipes only — a draft recipe isn't real content yet and
    # shouldn't be offered to search engines.
    recipes = list(
        db.recipes.find({"is_published": {"$ne": False}}, {"slug": 1, "image": 1, "title": 1, "updated_at": 1})
    )
    for r in recipes:
        slug = r.get("slug")
        if not slug:
            continue
        lastmod = r["updated_at"].strftime("%Y-%m-%d") if r.get("updated_at") else today
        image = {"url": r["image"], "title": r.get("title", "")} if r.get("image") else None
        entries.append(_url_entry(f"{base}/recipes/{slug}", lastmod, "weekly", "0.6", image))

    body = "".join(entries)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
        f"{body}"
        "</urlset>"
    )
