"""
Low-stock digest tests: product_service.get_low_stock_products (the query
the admin dashboard's low-stock widget and the daily digest email both now
share) and the scheduled digest job's cross-worker dedup.
"""

from unittest.mock import patch

from tests.conftest import insert_category, insert_product, insert_user, get_token, bearer

from app.services import product_service
from app.utils import scheduler


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


# ─── get_low_stock_products ────────────────────────────────────────────────────

def test_uses_products_own_threshold_not_a_hardcoded_one(db):
    cat_id = insert_category(db)
    # stock_quantity=8 would NOT trip the old hardcoded threshold of 5, but
    # DOES trip this product's own configured threshold of 10.
    pid = insert_product(db, cat_id, name="Custom Threshold Fish", price=500.0)
    db.products.update_one({"_id": pid}, {"$set": {"stock_quantity": 8, "low_stock_threshold": 10}})

    results = product_service.get_low_stock_products(db)
    assert any(p["_id"] == pid for p in results)


def test_uses_default_threshold_of_10_when_unset(db):
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id, name="Default Threshold Fish", price=500.0)
    db.products.update_one({"_id": pid}, {"$set": {"stock_quantity": 9}})  # no low_stock_threshold set

    results = product_service.get_low_stock_products(db)
    assert any(p["_id"] == pid for p in results)


def test_excludes_products_above_threshold(db):
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id, name="Well Stocked Fish", price=500.0)
    db.products.update_one({"_id": pid}, {"$set": {"stock_quantity": 50, "low_stock_threshold": 10}})

    results = product_service.get_low_stock_products(db)
    assert not any(p["_id"] == pid for p in results)


def test_accounts_for_reserved_stock(db):
    """stock_quantity=15 looks fine against a threshold of 10, but 6 units
    are already reserved by unpaid orders, leaving only 9 truly available."""
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id, name="Reserved Fish", price=500.0)
    db.products.update_one({"_id": pid}, {"$set": {"stock_quantity": 15, "reserved_stock": 6, "low_stock_threshold": 10}})

    results = product_service.get_low_stock_products(db)
    assert any(p["_id"] == pid for p in results)


def test_respects_limit(db):
    cat_id = insert_category(db)
    for i in range(3):
        pid = insert_product(db, cat_id, name=f"Low Fish {i}", price=500.0)
        db.products.update_one({"_id": pid}, {"$set": {"stock_quantity": 1, "low_stock_threshold": 10}})

    results = product_service.get_low_stock_products(db, limit=2)
    assert len(results) == 2


# ─── Admin dashboard widget uses the same fixed logic ──────────────────────────

def test_admin_dashboard_low_stock_widget_respects_custom_threshold(client, db):
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id, name="Custom Threshold Fish", price=500.0)
    db.products.update_one({"_id": pid}, {"$set": {"stock_quantity": 8, "low_stock_threshold": 10}})

    r = client.get("/admin/stats", headers=_admin_headers(client, db))
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()["data"]["lowStockProducts"]]
    assert str(pid) in ids


# ─── Digest job + cross-worker dedup ───────────────────────────────────────────

def test_digest_job_sends_email_when_products_are_low(db):
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id, name="Low Fish", price=500.0)
    db.products.update_one({"_id": pid}, {"$set": {"stock_quantity": 1, "low_stock_threshold": 10}})

    with patch("app.services.product_service.get_database", return_value=db), \
         patch("app.services.email_service.send_async") as mock_send:
        product_service.run_low_stock_digest_job()

    assert mock_send.call_count == 1


def test_digest_job_sends_nothing_when_no_products_are_low(db):
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id, name="Well Stocked Fish", price=500.0)
    db.products.update_one({"_id": pid}, {"$set": {"stock_quantity": 50, "low_stock_threshold": 10}})

    with patch("app.services.product_service.get_database", return_value=db), \
         patch("app.services.email_service.send_async") as mock_send:
        product_service.run_low_stock_digest_job()

    assert mock_send.call_count == 0


def test_digest_job_does_not_double_send_same_day(db):
    """Approximates cross-worker safety: two gunicorn workers each running
    their own scheduler would both fire this job around 9am — only one
    should actually send."""
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id, name="Low Fish", price=500.0)
    db.products.update_one({"_id": pid}, {"$set": {"stock_quantity": 1, "low_stock_threshold": 10}})

    with patch("app.services.product_service.get_database", return_value=db), \
         patch("app.services.email_service.send_async") as mock_send:
        product_service.run_low_stock_digest_job()
        product_service.run_low_stock_digest_job()

    assert mock_send.call_count == 1


# ─── scheduler.claim_daily_run ─────────────────────────────────────────────────

def test_claim_daily_run_first_call_succeeds(db):
    assert scheduler.claim_daily_run(db, "some_job") is True


def test_claim_daily_run_second_call_same_day_fails(db):
    assert scheduler.claim_daily_run(db, "some_job") is True
    assert scheduler.claim_daily_run(db, "some_job") is False


def test_claim_daily_run_succeeds_again_on_a_new_day(db):
    assert scheduler.claim_daily_run(db, "some_job") is True
    db.scheduled_jobs.update_one({"_id": "some_job"}, {"$set": {"last_run_date": "2020-01-01"}})
    assert scheduler.claim_daily_run(db, "some_job") is True
