"""
Shared pytest fixtures for the Divya Luxury Seafoods test suite.

Strategy:
- One MongoClient for the whole session → divyafoods_test database
- Override the get_db FastAPI dependency so every route uses the test DB
- Wipe all collections before each test for full isolation
- Drop the entire test database when the session ends
"""

import hashlib
import hmac
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from passlib.context import CryptContext
from pymongo import MongoClient

from app.dependencies import get_db
from app.limiter import limiter
from app.main import app

TEST_MONGO_URL = "mongodb://localhost:27017"
TEST_DB_NAME   = "divyafoods_test"
TEST_RZP_SECRET = "test_razorpay_secret_key"

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Session-scoped DB ────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(TEST_MONGO_URL, serverSelectionTimeoutMS=3000)
    yield client
    client.drop_database(TEST_DB_NAME)
    client.close()


@pytest.fixture(scope="session")
def db(mongo):
    database = mongo[TEST_DB_NAME]
    from app.utils.db_init import create_indexes
    create_indexes(database)
    return database


@pytest.fixture(scope="session")
def client(db):
    """One TestClient for the whole session; get_db always returns test DB."""
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ─── Per-test cleanup ─────────────────────────────────────────────────────────

COLLECTIONS = [
    "users", "products", "categories", "orders", "carts", "coupons", "banners",
    "reviews", "addresses", "notifications", "push_subscriptions", "bundles",
    "qa", "subscriptions", "settings", "image_hashes", "stock_movements", "purchases",
    "bulk_order_requests", "gift_cards",
]

@pytest.fixture(autouse=True)
def clean(db):
    for col in COLLECTIONS:
        db[col].delete_many({})
    limiter.reset()
    yield


# ─── Helper factories ─────────────────────────────────────────────────────────

def _now():
    return datetime.now(timezone.utc)


def insert_user(db, email="user@test.com", role="customer", name="Test User"):
    result = db.users.insert_one({
        "name":                  name,
        "email":                 email,
        "password_hash":         _pwd.hash("Test1234!"),
        "role":                  role,
        "phone":                 "9999999999",
        "wishlist_product_ids":  [],
        "created_at":            _now(),
    })
    return result.inserted_id


def get_token(client, email, password="Test1234!"):
    """Login and return the raw access token string.

    Auth endpoints return TokenResponse directly (Pydantic model) — no
    {"data": ...} envelope. Field is snake_case: access_token.
    """
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed ({r.status_code}): {r.text}"
    return r.json()["access_token"]


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def insert_category(db, name="Frozen Seafood", slug="frozen-seafood"):
    result = db.categories.insert_one({
        "name":       name,
        "slug":       slug,
        "is_active":  True,
        "created_at": _now(),
    })
    return result.inserted_id


def insert_product(db, category_id, name="Test Salmon", price=999.0, in_stock=True, is_published=True):
    from bson import ObjectId
    slug = name.lower().replace(" ", "-")
    result = db.products.insert_one({
        "name":           name,
        "slug":           slug,
        "price":          price,
        "original_price": None,
        "category_id":    category_id,
        "origin":         "Norway",
        "weight":         "500g",
        "description":    "Fresh Atlantic Salmon",
        "tags":           ["seafood", "frozen"],
        "images":         ["/assets/test.webp"],
        "in_stock":       in_stock,
        "stock_quantity": 50,
        "rating":         4.5,
        "review_count":   10,
        "is_featured":    True,
        "is_best_seller": False,
        "is_published":   is_published,
        "created_at":     _now(),
        "updated_at":     _now(),
    })
    return result.inserted_id


_order_counter = 0

def insert_order(db, user_id, product_id, status="pending", payment_status="pending",
                  created_at=None, total=999.0, quantity=1):
    """Insert a minimal order document directly for testing downstream flows."""
    global _order_counter
    _order_counter += 1
    now = created_at or _now()
    result = db.orders.insert_one({
        "order_number":      f"DF-TEST-{_order_counter:06d}",
        "user_id":           user_id,
        "status":            status,
        "payment_status":    payment_status,
        "payment_method":    "razorpay",
        "razorpay_order_id": "order_test_abc123",
        "delivery_address":  {
            "full_name":     "Test User",
            "phone":         "9999999999",
            "address_line1": "123 Test St",
            "city":          "Delhi",
            "state":         "Delhi",
            "pincode":       "110001",
        },
        "items": [{
            "product_id": product_id,
            "name":       "Test Salmon",
            "price":      999.0,
            "quantity":   quantity,
            "image":      "/assets/test.webp",
        }],
        "subtotal":          999.0,
        "delivery_charge":   0.0,
        "discount":          0.0,
        "total":             total,
        "coupon_code":       None,
        "notes":             "",
        "tracking_timeline": [{"status": status, "timestamp": now, "note": "Order placed"}],
        "created_at":        now,
        "updated_at":        now,
    })
    return result.inserted_id


def make_rzp_signature(order_id: str, payment_id: str, secret: str = TEST_RZP_SECRET) -> str:
    """Compute the HMAC-SHA256 signature that Razorpay sends to the frontend."""
    return hmac.new(
        secret.encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
