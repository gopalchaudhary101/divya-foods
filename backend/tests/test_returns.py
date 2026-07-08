"""
Returns/refunds endpoint tests.

Covers: customer return-request creation + eligibility rules, admin
list/detail/approve/reject, and the Razorpay-refund integration on approval.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from bson import ObjectId

from tests.conftest import (
    insert_user, insert_category, insert_product, insert_order,
    get_token, bearer,
)


def _mock_rzp_refund(refund_id="rfnd_test_1", amount_paise=99900):
    mock_client = MagicMock()
    mock_client.payment.refund.return_value = {"id": refund_id, "amount": amount_paise}
    return patch("app.services.order_service.razorpay.Client", return_value=mock_client)


def _setup_delivered_order(db, hours_since_delivery=1, quantity=1, price=999.0, payment_status="paid", status="delivered"):
    uid = insert_user(db)
    cat_id = insert_category(db)
    pid = insert_product(db, cat_id, name="Salmon Fillet", price=price)
    delivered_at = datetime.now(timezone.utc) - timedelta(hours=hours_since_delivery)
    oid = insert_order(
        db, uid, pid, status=status, payment_status=payment_status,
        created_at=delivered_at, quantity=quantity, total=price * quantity,
    )
    # insert_order() hardcodes the embedded item's price at 999.0 regardless of
    # `total` — override it so refund-amount math in these tests is actually
    # driven by `price`, not a fixture quirk.
    db.orders.update_one({"_id": oid}, {"$set": {"items.0.price": price}})
    return uid, pid, oid


def _return_body(pid, quantity=1, reason="damaged_or_spoiled", note="Arrived spoiled"):
    return {
        "reason": reason,
        "note": note,
        "items": [{"productId": str(pid), "quantity": quantity}],
    }


# ─── Customer: create return request ──────────────────────────────────────────

def test_create_return_request_success(client, db):
    uid, pid, oid = _setup_delivered_order(db, hours_since_delivery=2)
    token = get_token(client, "user@test.com")

    with patch("app.services.email_service.send_async"):
        r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "requested"
    assert data["refundAmount"] == 999.0
    assert data["orderNumber"]
    assert data["reason"] == "damaged_or_spoiled"

    stored = db.returns.find_one({"order_id": oid})
    assert stored is not None
    assert stored["status"] == "requested"


def test_return_request_rejects_non_delivered_order(client, db):
    uid, pid, oid = _setup_delivered_order(db, status="shipped")
    token = get_token(client, "user@test.com")

    r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    assert r.status_code == 400
    assert "delivered" in r.json()["detail"].lower()


def test_return_request_rejects_unpaid_order(client, db):
    uid, pid, oid = _setup_delivered_order(db, payment_status="pending")
    token = get_token(client, "user@test.com")

    r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    assert r.status_code == 400
    assert "payment" in r.json()["detail"].lower()


def test_return_request_rejects_after_24_hour_window(client, db):
    uid, pid, oid = _setup_delivered_order(db, hours_since_delivery=25)
    token = get_token(client, "user@test.com")

    r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    assert r.status_code == 400
    assert "24 hours" in r.json()["detail"]


def test_return_request_rejects_invalid_reason(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")

    r = client.post(
        f"/orders/{oid}/return-request",
        json=_return_body(pid, reason="i_just_dont_want_it"),
        headers=bearer(token),
    )
    assert r.status_code == 400
    assert "reason" in r.json()["detail"].lower()


def test_return_request_rejects_quantity_over_ordered(client, db):
    uid, pid, oid = _setup_delivered_order(db, quantity=2)
    token = get_token(client, "user@test.com")

    r = client.post(
        f"/orders/{oid}/return-request",
        json=_return_body(pid, quantity=5),
        headers=bearer(token),
    )
    assert r.status_code == 400
    assert "quantity" in r.json()["detail"].lower()


def test_return_request_rejects_product_not_in_order(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")
    fake_pid = "0" * 24

    r = client.post(
        f"/orders/{oid}/return-request",
        json=_return_body(fake_pid),
        headers=bearer(token),
    )
    assert r.status_code == 400


def test_return_request_computes_partial_refund_for_missing_item(client, db):
    """Ordering 3 units but only returning 1 should refund just that 1 unit's value."""
    uid, pid, oid = _setup_delivered_order(db, quantity=3, price=100.0)
    token = get_token(client, "user@test.com")

    with patch("app.services.email_service.send_async"):
        r = client.post(
            f"/orders/{oid}/return-request",
            json=_return_body(pid, quantity=1, reason="missing_item"),
            headers=bearer(token),
        )
    assert r.status_code == 200
    assert r.json()["data"]["refundAmount"] == 100.0   # 1 unit, not the full 300


def test_return_request_blocks_duplicate_active_request(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")

    with patch("app.services.email_service.send_async"):
        r1 = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
        assert r1.status_code == 200
        r2 = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    assert r2.status_code == 400
    assert "already in progress" in r2.json()["detail"].lower()


def test_return_request_requires_ownership(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    insert_user(db, email="other@test.com")
    other_token = get_token(client, "other@test.com")

    r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(other_token))
    assert r.status_code == 404


def test_return_request_requires_auth(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid))
    assert r.status_code == 401


# ─── Customer: check own return-request status ────────────────────────────────

def test_get_return_request_status(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))

    r = client.get(f"/orders/{oid}/return-request", headers=bearer(token))
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "requested"


def test_get_return_request_404_when_none_exists(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")
    r = client.get(f"/orders/{oid}/return-request", headers=bearer(token))
    assert r.status_code == 404


# ─── Admin: list / detail ──────────────────────────────────────────────────────

def test_admin_list_returns_requires_admin(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")
    r = client.get("/admin/returns", headers=bearer(token))
    assert r.status_code == 403


def test_admin_list_and_filter_returns(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))

    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    admin_token = get_token(client, "admin@test.com")

    r = client.get("/admin/returns?status=requested", headers=bearer(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["data"][0]["status"] == "requested"

    r_empty = client.get("/admin/returns?status=rejected", headers=bearer(admin_token))
    assert r_empty.json()["total"] == 0


# ─── Admin: approve (real refund flow) ─────────────────────────────────────────

def test_admin_approve_return_triggers_refund(client, db):
    uid, pid, oid = _setup_delivered_order(db, price=999.0)
    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    return_id = r.json()["data"]["id"]

    db.orders.update_one({"_id": oid}, {"$set": {"razorpay_payment_id": "pay_test_abc"}})

    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    admin_token = get_token(client, "admin@test.com")

    with patch("app.services.email_service.send_async"), _mock_rzp_refund(amount_paise=99900):
        r = client.put(
            f"/admin/returns/{return_id}/approve",
            json={"note": "Confirmed damaged, approved"},
            headers=bearer(admin_token),
        )
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "refunded"
    assert data["razorpayRefundId"] == "rfnd_test_1"
    assert data["refundMethod"] == "razorpay"

    order = db.orders.find_one({"_id": oid})
    assert order["payment_status"] == "refunded"
    assert order["refunds"][0]["refund_id"] == "rfnd_test_1"
    assert order["refunds"][0]["method"] == "razorpay"


def test_admin_approve_return_fails_for_cod_order(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    return_id = r.json()["data"]["id"]

    db.orders.update_one({"_id": oid}, {"$set": {"payment_method": "cod", "razorpay_payment_id": None}})

    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    admin_token = get_token(client, "admin@test.com")

    r = client.put(f"/admin/returns/{return_id}/approve", json={"note": "ok"}, headers=bearer(admin_token))
    assert r.status_code == 400
    assert "manual refund" in r.json()["detail"].lower()


# ─── Admin: approve-manual (COD / fallback refund flow) ────────────────────────

def test_admin_approve_return_manual_success(client, db):
    uid, pid, oid = _setup_delivered_order(db, price=999.0)
    db.orders.update_one({"_id": oid}, {"$set": {"payment_method": "cod", "razorpay_payment_id": None}})
    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    return_id = r.json()["data"]["id"]
    assert r.json()["data"]["orderPaymentMethod"] == "cod"

    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    admin_token = get_token(client, "admin@test.com")

    with patch("app.services.email_service.send_async"):
        r = client.put(
            f"/admin/returns/{return_id}/approve-manual",
            json={"reference": "Bank transfer UTR123456", "note": "Refunded via bank transfer"},
            headers=bearer(admin_token),
        )
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "refunded"
    assert data["refundMethod"] == "manual"
    assert data["refundReference"] == "Bank transfer UTR123456"
    assert data["razorpayRefundId"] is None

    order = db.orders.find_one({"_id": oid})
    assert order["payment_status"] == "refunded"
    assert order["refunds"][0]["method"] == "manual"
    assert order["refunds"][0]["reference"] == "Bank transfer UTR123456"


def test_admin_approve_return_manual_requires_reference(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    return_id = r.json()["data"]["id"]

    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    admin_token = get_token(client, "admin@test.com")

    r = client.put(
        f"/admin/returns/{return_id}/approve-manual",
        json={"reference": "  ", "note": "ok"},
        headers=bearer(admin_token),
    )
    assert r.status_code == 400


def test_admin_approve_return_manual_already_resolved_fails(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    return_id = r.json()["data"]["id"]
    db.returns.update_one({"_id": ObjectId(return_id)}, {"$set": {"status": "rejected"}})

    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    admin_token = get_token(client, "admin@test.com")

    r = client.put(
        f"/admin/returns/{return_id}/approve-manual",
        json={"reference": "ref-1"},
        headers=bearer(admin_token),
    )
    assert r.status_code == 400
    assert "already" in r.json()["detail"].lower()


def test_admin_approve_already_resolved_return_fails(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    return_id = r.json()["data"]["id"]
    db.returns.update_one({"_id": ObjectId(return_id)}, {"$set": {"status": "rejected"}})

    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    admin_token = get_token(client, "admin@test.com")

    r = client.put(f"/admin/returns/{return_id}/approve", json={"note": "ok"}, headers=bearer(admin_token))
    assert r.status_code == 400
    assert "already" in r.json()["detail"].lower()


# ─── Admin: reject ──────────────────────────────────────────────────────────────

def test_admin_reject_return_requires_note(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    return_id = r.json()["data"]["id"]

    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    admin_token = get_token(client, "admin@test.com")

    r = client.put(f"/admin/returns/{return_id}/reject", json={"note": ""}, headers=bearer(admin_token))
    assert r.status_code == 400


def test_admin_reject_return_success(client, db):
    uid, pid, oid = _setup_delivered_order(db)
    token = get_token(client, "user@test.com")
    with patch("app.services.email_service.send_async"):
        r = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    return_id = r.json()["data"]["id"]

    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    admin_token = get_token(client, "admin@test.com")

    with patch("app.services.email_service.send_async"):
        r = client.put(
            f"/admin/returns/{return_id}/reject",
            json={"note": "Photos show normal wear, not spoilage."},
            headers=bearer(admin_token),
        )
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "rejected"
    assert data["adminNote"] == "Photos show normal wear, not spoilage."

    # A new return request should now be allowed since the previous one is resolved.
    with patch("app.services.email_service.send_async"):
        r2 = client.post(f"/orders/{oid}/return-request", json=_return_body(pid), headers=bearer(token))
    assert r2.status_code == 200
