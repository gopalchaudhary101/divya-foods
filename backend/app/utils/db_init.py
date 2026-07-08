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

    # ── newsletters ───────────────────────────────────────────────────────────
    db.newsletters.create_index("email", unique=True)

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

    logger.info("All indexes created successfully")
