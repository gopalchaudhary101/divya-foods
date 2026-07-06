"""
Review endpoint tests.

Covers: verified-purchase gate, one review per user per product, rating
recalculation on the product document, and ownership checks on delete.
"""

from bson import ObjectId

from tests.conftest import (
    insert_user, insert_category, insert_product, insert_order,
    get_token, bearer,
)


def _headers(client, email="user@test.com"):
    token = get_token(client, email)
    return bearer(token)


# ─── can-review eligibility ───────────────────────────────────────────────────

def test_can_review_no_purchase(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    hdrs   = _headers(client)

    r = client.get(f"/reviews/can-review/{pid}", headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["canReview"] is False
    assert data["reason"] == "no_purchase"


def test_can_review_after_delivered_order(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid, status="delivered")
    hdrs = _headers(client)

    r = client.get(f"/reviews/can-review/{pid}", headers=hdrs)
    assert r.json()["data"] == {"canReview": True, "reason": None}


def test_can_review_already_reviewed(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid, status="delivered")
    hdrs = _headers(client)

    client.post("/reviews", json={
        "product_id": str(pid), "rating": 5, "comment": "Excellent product, highly recommend it!",
    }, headers=hdrs)

    r = client.get(f"/reviews/can-review/{pid}", headers=hdrs)
    data = r.json()["data"]
    assert data["canReview"] is False
    assert data["reason"] == "already_reviewed"


# ─── Create review ─────────────────────────────────────────────────────────────

def test_create_review_requires_delivered_purchase(client, db):
    insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    hdrs   = _headers(client)

    r = client.post("/reviews", json={
        "product_id": str(pid), "rating": 4, "comment": "Pretty good overall quality!",
    }, headers=hdrs)
    assert r.status_code == 403


def test_create_review_success_updates_product_rating(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, price=500.0)
    insert_order(db, uid, pid, status="delivered")
    hdrs = _headers(client)

    r = client.post("/reviews", json={
        "product_id": str(pid), "rating": 5, "comment": "Absolutely wonderful, will buy again!",
    }, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["rating"] == 5
    assert data["isVerifiedPurchase"] is True

    product = db.products.find_one({"_id": pid})
    assert product["rating"] == 5.0
    assert product["review_count"] == 1


def test_create_review_duplicate_blocked(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid, status="delivered")
    hdrs = _headers(client)

    payload = {"product_id": str(pid), "rating": 4, "comment": "Good quality, fast delivery too!"}
    r1 = client.post("/reviews", json=payload, headers=hdrs)
    r2 = client.post("/reviews", json=payload, headers=hdrs)

    assert r1.status_code == 200
    assert r2.status_code == 409


def test_create_review_invalid_rating_rejected(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid, status="delivered")
    hdrs = _headers(client)

    r = client.post("/reviews", json={
        "product_id": str(pid), "rating": 6, "comment": "Rating out of allowed range here",
    }, headers=hdrs)
    assert r.status_code == 422


def test_create_review_comment_too_short_rejected(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid, status="delivered")
    hdrs = _headers(client)

    r = client.post("/reviews", json={
        "product_id": str(pid), "rating": 4, "comment": "short",
    }, headers=hdrs)
    assert r.status_code == 422


# ─── List reviews ──────────────────────────────────────────────────────────────

def test_list_reviews_for_product(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid, status="delivered")
    hdrs = _headers(client)

    client.post("/reviews", json={
        "product_id": str(pid), "rating": 5, "comment": "Great product, love the freshness!",
    }, headers=hdrs)

    r = client.get(f"/reviews/{pid}")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["data"][0]["rating"] == 5


def test_list_reviews_invalid_product_id(client, db):
    r = client.get("/reviews/not-a-valid-object-id")
    assert r.status_code == 400


# ─── Delete review ─────────────────────────────────────────────────────────────

def test_delete_own_review(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    insert_order(db, uid, pid, status="delivered")
    hdrs = _headers(client)

    create_r = client.post("/reviews", json={
        "product_id": str(pid), "rating": 3, "comment": "It was decent, nothing special.",
    }, headers=hdrs)
    review_id = create_r.json()["data"]["id"]

    del_r = client.delete(f"/reviews/{review_id}", headers=hdrs)
    assert del_r.status_code == 200

    product = db.products.find_one({"_id": pid})
    assert product["review_count"] == 0
    assert product["rating"] == 0.0


def test_delete_others_review_forbidden(client, db):
    owner   = insert_user(db, email="owner@test.com")
    intruder = insert_user(db, email="intruder@test.com")
    cat_id  = insert_category(db)
    pid     = insert_product(db, cat_id)
    insert_order(db, owner, pid, status="delivered")

    owner_hdrs = _headers(client, "owner@test.com")
    create_r = client.post("/reviews", json={
        "product_id": str(pid), "rating": 4, "comment": "Solid purchase, would recommend it.",
    }, headers=owner_hdrs)
    review_id = create_r.json()["data"]["id"]

    intruder_hdrs = _headers(client, "intruder@test.com")
    del_r = client.delete(f"/reviews/{review_id}", headers=intruder_hdrs)
    assert del_r.status_code == 403


def test_delete_nonexistent_review(client, db):
    insert_user(db)
    hdrs = _headers(client)
    fake_id = str(ObjectId())
    r = client.delete(f"/reviews/{fake_id}", headers=hdrs)
    assert r.status_code == 404
