"""
Digital marketing content generator — SEO title/description, a social caption,
and hashtags for a single product. Uses the same Claude Haiku client already
configured for the site chatbot (app/routers/chat.py); falls back to a simple
template when ANTHROPIC_API_KEY isn't set, same graceful-degradation pattern
already used for Cloudinary/Razorpay elsewhere in this app.

Deliberately does NOT attempt real posting to Instagram/Facebook/LinkedIn/YouTube/
X/WhatsApp/Google Business — none of those platforms' APIs are configured anywhere
in this codebase, and building a fake "post" button that silently fails would be
worse than not having one. The frontend instead builds standard web share-intent
links (facebook.com/sharer, twitter.com/intent, wa.me, linkedin.com/sharing) using
the content generated here — no credentials required, works immediately.
"""

import json
import re
from typing import Optional

from app.config import settings

_FRONTEND_URL = "https://divya-foods.vercel.app"


def _product_url(slug: str) -> str:
    return f"{_FRONTEND_URL}/products/{slug}"


def _generate_fallback(product: dict) -> dict:
    name = product.get("name", "")
    brand = product.get("brand")
    origin = product.get("origin")
    tags = product.get("tags") or []

    seo_title = f"{name} | Buy Online at Divya Luxury Seafoods"[:60]
    origin_bit = f"Premium quality from {origin}. " if origin else ""
    seo_description = f"Shop {name} online at Divya Luxury Seafoods. {origin_bit}Fast delivery across Delhi NCR."[:160]
    caption = f"🐟 Fresh {name} now available at Divya Luxury Seafoods! {origin_bit}Order now for fast delivery across Delhi NCR."

    hashtags = ["#DivyaFoods", "#PremiumSeafood"]
    if brand:
        hashtags.append(f"#{re.sub(r'[^A-Za-z0-9]', '', brand)}")
    for tag in tags[:3]:
        cleaned = re.sub(r'[^A-Za-z0-9]', '', tag)
        if cleaned:
            hashtags.append(f"#{cleaned}")

    return {
        "seoTitle": seo_title,
        "seoDescription": seo_description,
        "caption": caption,
        "hashtags": hashtags,
    }


def _extract_json(text: str) -> Optional[dict]:
    """Claude sometimes wraps JSON in markdown fences despite instructions — strip those first."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, TypeError):
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
        return None


def _generate_with_ai(product: dict) -> dict:
    import anthropic  # imported lazily, matching app/routers/chat.py

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    prompt = f"""Generate digital marketing content for this e-commerce product from Divya Luxury Seafoods, a premium imported seafood and gourmet food marketplace in Delhi, India.

Product name: {product.get("name")}
Brand: {product.get("brand") or "N/A"}
Origin: {product.get("origin") or "N/A"}
Weight/size: {product.get("weight") or "N/A"}
Tags: {", ".join(product.get("tags") or []) or "N/A"}
Description: {(product.get("description") or "")[:300]}

Return ONLY a JSON object (no markdown, no explanation) with exactly these keys:
- "seoTitle": an SEO-friendly page title, max 60 characters
- "seoDescription": an SEO meta description, max 160 characters
- "caption": an engaging social media caption (Instagram/Facebook style), 1-3 sentences, may include emoji
- "hashtags": an array of 5-8 relevant hashtag strings, each starting with #, no spaces
"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )
    parsed = _extract_json(response.content[0].text)
    if not parsed or not all(k in parsed for k in ("seoTitle", "seoDescription", "caption", "hashtags")):
        return _generate_fallback(product)
    return parsed


def generate_marketing_content(product: dict) -> dict:
    if not settings.ANTHROPIC_API_KEY:
        content = _generate_fallback(product)
    else:
        try:
            content = _generate_with_ai(product)
        except Exception:
            content = _generate_fallback(product)

    content["productUrl"] = _product_url(product.get("slug", ""))
    return content
