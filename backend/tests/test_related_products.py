"""
"Related products" recommendation tests (app/services/product_service.get_related).

Blends three signals: frequently-bought-together (from paid orders),
same-category, and newest-site-wide as a last resort. No dedicated test file
existed for this endpoint before — these tests cover both the pre-existing
category/newest fallback behavior and the new co-purchase signal.
"""

from datetime import datetime, timezone

from bson import ObjectId

from tests.conftest import insert_user, insert_category, insert_product

_ORDER_COUNTER = [0]


def _insert_multi_item_order(db, user_id, product_ids, payment_status="paid"):
    """Insert an order with one item per given product_id — insert_order() in
    conftest only supports a single item per order, which isn't enough to
    test co-purchase signals."""
    _ORDER_COUNTER[0] += 1
    now = datetime.now(timezone.utc)
    db.orders.insert_one({
        "order_number": f"DF-RELTEST-{_ORDER_COUNTER[0]:06d}",
        "user_id": user_id,
        "status": "delivered",
        "payment_status": payment_status,
        "payment_method": "razorpay",
        "razorpay_order_id": f"order_reltest_{_ORDER_COUNTER[0]}",
        "delivery_address": {
            "full_name": "Test User", "phone": "9999999999", "address_line1": "123 Test St",
            "city": "Delhi", "state": "Delhi", "pincode": "110001",
        },
        "items": [
            {"product_id": pid, "name": "Item", "price": 500.0, "quantity": 1, "image": ""}
            for pid in product_ids
        ],
        "subtotal": 500.0 * len(product_ids),
        "delivery_charge": 0.0,
        "discount": 0.0,
        "total": 500.0 * len(product_ids),
        "coupon_code": None,
        "notes": "",
        "tracking_timeline": [],
        "created_at": now,
        "updated_at": now,
    })


def _related_ids(db, pid, limit=6):
    from app.services import product_service
    result = product_service.get_related(db, str(pid), limit=limit)
    return [p["id"] for p in result["data"]]


def test_falls_back_to_category_with_no_purchase_history(db):
    cat_id = insert_category(db)
    a = insert_product(db, cat_id, name="A")
    b = insert_product(db, cat_id, name="B")

    ids = _related_ids(db, a)
    assert str(b) in ids


def test_falls_back_to_newest_when_no_category_matches(db):
    cat1 = insert_category(db, name="Cat1", slug="cat1")
    cat2 = insert_category(db, name="Cat2", slug="cat2")
    a = insert_product(db, cat1, name="Lonely Category Product")
    other = insert_product(db, cat2, name="Different Category Product")

    ids = _related_ids(db, a)
    assert str(other) in ids


def test_prioritizes_frequently_bought_together_over_category(db):
    cat_id = insert_category(db)
    a = insert_product(db, cat_id, name="A")
    b = insert_product(db, cat_id, name="B")  # same category, never co-purchased
    c = insert_product(db, cat_id, name="C")  # co-purchased with A twice

    uid1 = insert_user(db, email="u1@test.com")
    uid2 = insert_user(db, email="u2@test.com")
    _insert_multi_item_order(db, uid1, [a, c])
    _insert_multi_item_order(db, uid2, [a, c])

    ids = _related_ids(db, a, limit=2)
    assert ids[0] == str(c)  # co-purchased -> ranked first
    assert str(b) in ids     # category fallback fills the remaining slot


def test_ranks_co_purchased_products_by_frequency(db):
    cat_id = insert_category(db)
    a = insert_product(db, cat_id, name="A")
    b = insert_product(db, cat_id, name="B")  # co-purchased once
    c = insert_product(db, cat_id, name="C")  # co-purchased twice

    uid1 = insert_user(db, email="u1@test.com")
    uid2 = insert_user(db, email="u2@test.com")
    uid3 = insert_user(db, email="u3@test.com")
    _insert_multi_item_order(db, uid1, [a, b])
    _insert_multi_item_order(db, uid2, [a, c])
    _insert_multi_item_order(db, uid3, [a, c])

    ids = _related_ids(db, a, limit=2)
    assert ids[0] == str(c)
    assert ids[1] == str(b)


def test_ignores_unpaid_orders_for_co_purchase_signal(db):
    cat_id = insert_category(db)
    a = insert_product(db, cat_id, name="A")
    b = insert_product(db, cat_id, name="B")  # only ever co-occurs in an UNPAID order

    uid = insert_user(db)
    _insert_multi_item_order(db, uid, [a, b], payment_status="pending")

    result_ids = _related_ids(db, a, limit=1)
    # B still appears (category fallback), but NOT because of the (invalid) co-purchase signal —
    # verified separately via the aggregation itself:
    from app.services import product_service
    assert product_service._get_co_purchased_ids(db, a, limit=6) == []
    assert str(b) in result_ids  # falls back to category, not co-purchase


def test_excludes_out_of_stock_co_purchased_product(db):
    cat_id = insert_category(db)
    a = insert_product(db, cat_id, name="A")
    b = insert_product(db, cat_id, name="B", in_stock=False)

    uid = insert_user(db)
    _insert_multi_item_order(db, uid, [a, b])

    ids = _related_ids(db, a)
    assert str(b) not in ids


def test_deduplicates_and_respects_limit(db):
    cat_id = insert_category(db)
    a = insert_product(db, cat_id, name="A")
    others = [insert_product(db, cat_id, name=f"Other {i}") for i in range(5)]

    uid = insert_user(db)
    _insert_multi_item_order(db, uid, [a, others[0]])

    ids = _related_ids(db, a, limit=3)
    assert len(ids) == 3
    assert len(ids) == len(set(ids))  # no duplicates


def test_invalid_product_id_returns_empty(db):
    from app.services import product_service
    result = product_service.get_related(db, "not-a-valid-id")
    assert result == {"success": True, "data": []}


def test_nonexistent_product_returns_empty(db):
    from app.services import product_service
    result = product_service.get_related(db, str(ObjectId()))
    assert result == {"success": True, "data": []}
