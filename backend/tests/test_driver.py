"""
Driver dashboard tests — admin driver-account management, assigning a driver to
a delivery, and the driver-scoped order list/status-update endpoints.
"""

from bson import ObjectId

from tests.conftest import insert_user, insert_category, insert_product, insert_order, get_token, bearer


def _admin_headers(client, db):
    if not db.users.find_one({"email": "admin@test.com"}):
        insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _create_driver(client, db, email="driver@test.com", password="DriverPass1!"):
    hdrs = _admin_headers(client, db)
    r = client.post("/admin/drivers", json={
        "name": "Ravi Driver", "email": email, "phone": "9123456780", "password": password,
    }, headers=hdrs)
    assert r.status_code == 200, r.text
    return r.json()["data"]


def _driver_headers(client, db, email="driver@test.com", password="DriverPass1!"):
    token = get_token(client, email, password)
    return bearer(token)


# ─── Admin: driver account management ─────────────────────────────────────────

def test_admin_creates_driver_account(client, db):
    driver = _create_driver(client, db)
    assert driver["email"] == "driver@test.com"
    assert driver["isActive"] is True

    stored = db.users.find_one({"email": "driver@test.com"})
    assert stored["role"] == "driver"


def test_admin_create_driver_rejects_duplicate_email(client, db):
    _create_driver(client, db)
    hdrs = _admin_headers(client, db)
    r = client.post("/admin/drivers", json={
        "name": "Another", "email": "driver@test.com", "password": "Whatever1!",
    }, headers=hdrs)
    assert r.status_code == 409


def test_admin_lists_drivers(client, db):
    _create_driver(client, db, email="d1@test.com")
    _create_driver(client, db, email="d2@test.com")
    hdrs = _admin_headers(client, db)
    r = client.get("/admin/drivers", headers=hdrs)
    assert r.status_code == 200
    assert len(r.json()["data"]) == 2


def test_admin_deactivates_driver_and_login_is_blocked(client, db):
    _create_driver(client, db)
    hdrs = _admin_headers(client, db)
    driver = db.users.find_one({"email": "driver@test.com"})

    r = client.put(f"/admin/drivers/{driver['_id']}/active", json={"is_active": False}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["isActive"] is False

    login = client.post("/auth/login", json={"email": "driver@test.com", "password": "DriverPass1!"})
    assert login.status_code in (401, 403)


def test_driver_endpoints_block_customers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    r = client.get("/driver/orders", headers=bearer(token))
    assert r.status_code == 403


def test_driver_account_creation_blocks_customers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    r = client.post("/admin/drivers", json={
        "name": "X", "email": "x@test.com", "password": "Whatever1!",
    }, headers=bearer(token))
    assert r.status_code == 403


# ─── Assigning a driver to an order (admin) ───────────────────────────────────

def test_admin_assigns_driver_account_to_order(client, db):
    driver = _create_driver(client, db)
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="confirmed", payment_status="paid")

    hdrs = _admin_headers(client, db)
    r = client.put(f"/admin/orders/{oid}/delivery", json={"driverId": driver["id"]}, headers=hdrs)
    assert r.status_code == 200, r.text
    delivery = r.json()["data"]["delivery"]
    assert delivery["driverId"] == driver["id"]
    assert delivery["driverName"] == "Ravi Driver"
    assert delivery["driverPhone"] == "9123456780"


def test_driver_id_overrides_manual_driver_name(client, db):
    driver = _create_driver(client, db)
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="confirmed", payment_status="paid")

    hdrs = _admin_headers(client, db)
    r = client.put(f"/admin/orders/{oid}/delivery", json={
        "driverName": "Someone Else", "driverId": driver["id"],
    }, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["delivery"]["driverName"] == "Ravi Driver"


def test_assign_unknown_driver_id_returns_404(client, db):
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="confirmed", payment_status="paid")

    hdrs = _admin_headers(client, db)
    r = client.put(f"/admin/orders/{oid}/delivery", json={"driverId": str(ObjectId())}, headers=hdrs)
    assert r.status_code == 404


# ─── Driver dashboard ─────────────────────────────────────────────────────────

def _assign_order_to_driver(client, db, driver, uid, pid, **order_kwargs):
    oid = insert_order(db, uid, pid, **order_kwargs)
    hdrs = _admin_headers(client, db)
    client.put(f"/admin/orders/{oid}/delivery", json={"driverId": driver["id"]}, headers=hdrs)
    return oid


def test_driver_sees_only_assigned_orders(client, db):
    driver = _create_driver(client, db)
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)

    assigned_oid = _assign_order_to_driver(client, db, driver, uid, pid, status="confirmed", payment_status="paid")
    insert_order(db, uid, pid, status="confirmed", payment_status="paid")   # not assigned to anyone

    hdrs = _driver_headers(client, db)
    r = client.get("/driver/orders", headers=hdrs)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert data["data"][0]["id"] == str(assigned_oid)


def test_driver_updates_delivery_status(client, db):
    driver = _create_driver(client, db)
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid = _assign_order_to_driver(client, db, driver, uid, pid, status="confirmed", payment_status="paid")

    hdrs = _driver_headers(client, db)
    r = client.put(f"/driver/orders/{oid}/status", json={"deliveryStatus": "picked_up"}, headers=hdrs)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["delivery"]["deliveryStatus"] == "picked_up"


def test_driver_cannot_update_status_of_unassigned_order(client, db):
    _create_driver(client, db)
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid    = insert_order(db, uid, pid, status="confirmed", payment_status="paid")   # not assigned

    hdrs = _driver_headers(client, db)
    r = client.put(f"/driver/orders/{oid}/status", json={"deliveryStatus": "picked_up"}, headers=hdrs)
    assert r.status_code == 404


def test_driver_status_update_rejects_invalid_status(client, db):
    driver = _create_driver(client, db)
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid = _assign_order_to_driver(client, db, driver, uid, pid, status="confirmed", payment_status="paid")

    hdrs = _driver_headers(client, db)
    r = client.put(f"/driver/orders/{oid}/status", json={"deliveryStatus": "teleported"}, headers=hdrs)
    assert r.status_code == 400


def test_driver_marks_delivered_with_proof_of_delivery(client, db):
    driver = _create_driver(client, db)
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid = _assign_order_to_driver(client, db, driver, uid, pid, status="confirmed", payment_status="paid")

    hdrs = _driver_headers(client, db)
    r = client.put(f"/driver/orders/{oid}/status", json={
        "deliveryStatus": "delivered", "proofOfDeliveryUrl": "https://example.com/pod.jpg",
    }, headers=hdrs)
    assert r.status_code == 200
    delivery = r.json()["data"]["delivery"]
    assert delivery["deliveryStatus"] == "delivered"
    assert delivery["proofOfDeliveryUrl"] == "https://example.com/pod.jpg"
    assert delivery["deliveredAt"] is not None


def test_driver_status_update_creates_customer_notification(client, db):
    driver = _create_driver(client, db)
    uid    = insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id)
    oid = _assign_order_to_driver(client, db, driver, uid, pid, status="confirmed", payment_status="paid")

    hdrs = _driver_headers(client, db)
    client.put(f"/driver/orders/{oid}/status", json={"deliveryStatus": "in_transit"}, headers=hdrs)

    notif = db.notifications.find_one({"user_id": uid, "type": "delivery_update"})
    assert notif is not None
