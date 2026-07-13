"""
Database index creation.

Called once on application startup (in main.py's startup event).
PyMongo's create_index is idempotent — safe to call repeatedly.

WHY INDEXES MATTER:
  Without an index, MongoDB reads every document in a collection to find a match.
  On a 100,000-product collection, an unindexed query takes seconds.
  With an index, it takes milliseconds. This is the difference between a fast
  product page and a site that times out under real traffic.

INDEX TYPES USED:
  ASCENDING (1)   → good for range queries and sorting (price, date)
  DESCENDING (-1) → good for "most recent first" sorts
  TEXT            → full-text search across multiple string fields
  UNIQUE          → enforces that no two documents share this value
  SPARSE          → index only includes documents where the field exists
  COMPOUND        → covers queries that filter/sort on multiple fields together
"""

import logging

from pymongo.database import Database

logger = logging.getLogger("app.database")


def create_indexes(db: Database) -> None:
    """Create all collection indexes. Safe to call multiple times (idempotent)."""

    # ── users ─────────────────────────────────────────────────────────────────
    db.users.create_index("email", unique=True)
    db.users.create_index("phone", sparse=True)

    # ── products ──────────────────────────────────────────────────────────────
    db.products.create_index("slug", unique=True)
    db.products.create_index("category_id")
    db.products.create_index("is_featured")
    db.products.create_index("is_best_seller")
    db.products.create_index("in_stock")
    db.products.create_index("is_published")
    db.products.create_index([("price", 1)])
    db.products.create_index([("rating", -1)])
    db.products.create_index([("created_at", -1)])
    # Full-text search index — powers the search bar
    db.products.create_index(
        [("name", "text"), ("description", "text"), ("tags", "text"), ("brand", "text")],
        name="product_text_search",
        weights={"name": 10, "tags": 5, "brand": 3, "description": 1},
    )
    # Compound: category page sorted by price
    db.products.create_index([("category_id", 1), ("price", 1)])
    # Compound: featured products sorted by creation date
    db.products.create_index([("is_featured", 1), ("created_at", -1)])

    # ── categories ────────────────────────────────────────────────────────────
    db.categories.create_index("slug", unique=True)
    db.categories.create_index("parent_id", sparse=True)
    db.categories.create_index("is_active")
    db.categories.create_index("order")

    # ── orders ────────────────────────────────────────────────────────────────
    db.orders.create_index("order_number", unique=True)
    db.orders.create_index("user_id")
    db.orders.create_index("status")
    db.orders.create_index("payment_status")
    db.orders.create_index([("created_at", -1)])
    # Admin dashboard: filter by status + sort by date
    db.orders.create_index([("status", 1), ("created_at", -1)])
    # Razorpay webhook lookup — every payment.captured/failed/refund event looks
    # up the order by razorpay_order_id, independent of the customer's browser
    db.orders.create_index("razorpay_order_id", sparse=True)
    # "Frequently bought together" (product_service.get_related) — runs on
    # every product-detail page view, so this multikey index on the embedded
    # items array matters more than the daily/periodic queries above.
    db.orders.create_index([("items.product_id", 1), ("payment_status", 1)])

    # ── carts ─────────────────────────────────────────────────────────────────
    # Bug fix: this index used to target `db.cart` (singular) — a collection
    # nothing in the app ever reads or writes. The real collection every
    # cart.py route uses is `db.carts` (plural), which had no indexes at all.
    db.carts.create_index("user_id", unique=True)   # one cart per user
    # Abandoned-cart reminder job's scan query (cart_service.py): non-empty
    # items, stale updated_at, not yet reminded.
    db.carts.create_index([("reminder_sent_at", 1), ("updated_at", 1)])

    # ── addresses ─────────────────────────────────────────────────────────────
    db.addresses.create_index("user_id")

    # ── wishlist ──────────────────────────────────────────────────────────────
    db.wishlist.create_index("user_id", unique=True)  # one wishlist per user

    # ── reviews ───────────────────────────────────────────────────────────────
    db.reviews.create_index("product_id")
    db.reviews.create_index("user_id")
    # Compound unique: one review per user per product
    db.reviews.create_index(
        [("product_id", 1), ("user_id", 1)],
        unique=True,
        name="one_review_per_user_per_product",
    )

    # ── coupons ───────────────────────────────────────────────────────────────
    db.coupons.create_index("code", unique=True)
    db.coupons.create_index("is_active")
    db.coupons.create_index("expires_at")

    # ── banners ───────────────────────────────────────────────────────────────
    db.banners.create_index([("is_active", 1), ("order", 1)])

    # ── notifications ─────────────────────────────────────────────────────────
    db.notifications.create_index("user_id")
    db.notifications.create_index("is_read")
    db.notifications.create_index([("user_id", 1), ("created_at", -1)])

    # ── push_subscriptions ────────────────────────────────────────────────────
    db.push_subscriptions.create_index("endpoint", unique=True)
    db.push_subscriptions.create_index("user_id")

    # ── contact_submissions ───────────────────────────────────────────────────
    db.contact_submissions.create_index([("created_at", -1)])
    db.contact_submissions.create_index("email")

    # ── returns ───────────────────────────────────────────────────────────────
    db.returns.create_index("user_id")
    db.returns.create_index("order_number")
    db.returns.create_index([("requested_at", -1)])
    # Duplicate-request guard: "is there already an active return for this order?"
    db.returns.create_index([("order_id", 1), ("status", 1)])

    # ── recipes ───────────────────────────────────────────────────────────────
    # Built to stay fast well past the 1000-recipe mark: every filterable field
    # (cuisine, category, difficulty) has its own index, the listing's default
    # sort is covered by a compound index, and full-text search reuses the same
    # $text-index pattern as products (see product_text_search below).
    db.recipes.create_index("slug", unique=True)
    db.recipes.create_index("cuisine")
    db.recipes.create_index("category")
    db.recipes.create_index("difficulty")
    db.recipes.create_index("is_published")
    db.recipes.create_index([("is_published", 1), ("created_at", -1)])
    db.recipes.create_index(
        [("title", "text"), ("description", "text"), ("tags", "text"), ("search_keywords", "text")],
        name="recipe_text_search",
        weights={"title": 10, "tags": 5, "search_keywords": 5, "description": 1},
    )

    # ── whatsapp ──────────────────────────────────────────────────────────────
    # whatsapp_settings is a single-document singleton (_id="config"), no index
    # needed beyond the default _id index. whatsapp_shares is an append-only
    # event log — indexed for the admin analytics aggregations (top products,
    # totals) to stay fast regardless of how many shares accumulate.
    db.whatsapp_shares.create_index("product_id")
    db.whatsapp_shares.create_index("shared_at")

    # ── bulk order requests ───────────────────────────────────────────────────
    # Admin list is filtered by status and always sorted newest-first.
    db.bulk_order_requests.create_index([("status", 1), ("created_at", -1)])

    # ── bundles ───────────────────────────────────────────────────────────────
    # Public listing filters on is_active; admin listing has no filter but
    # shares the same newest-first sort, so the compound index still helps.
    db.bundles.create_index([("is_active", 1), ("created_at", -1)])

    # ── gift cards ────────────────────────────────────────────────────────────
    # code must be globally unique — was previously only enforced by an
    # application-level find-before-insert check, which is racy under
    # concurrent redemption/issuance. A real unique index closes that gap.
    db.gift_cards.create_index("code", unique=True)
    db.gift_cards.create_index("created_at")

    # ── purchases (inventory purchase orders) ─────────────────────────────────
    db.purchases.create_index([("product_id", 1), ("created_at", -1)])
    db.purchases.create_index("status")

    # ── product Q&A ───────────────────────────────────────────────────────────
    # Public per-product listing is the hot path; admin's "unanswered" filter
    # is a separate, lower-traffic query.
    db.qa.create_index([("product_id", 1), ("created_at", -1)])
    db.qa.create_index("answer")

    # ── stock movements (inventory audit trail) ───────────────────────────────
    db.stock_movements.create_index([("product_id", 1), ("created_at", -1)])

    # ── subscriptions ─────────────────────────────────────────────────────────
    # Covers both the customer's "my active subscriptions" list and the
    # duplicate-subscription check on create.
    db.subscriptions.create_index([("user_id", 1), ("status", 1)])
    db.subscriptions.create_index([("user_id", 1), ("product_id", 1), ("status", 1)])

    # ── scheduled_jobs, settings, image_hashes ────────────────────────────────
    # All three are accessed exclusively by _id (job_id / singleton _id / file
    # hash) — the automatic _id index already covers every query here, so no
    # additional index is needed despite these collections having none today.

    logger.info("All indexes created successfully")
