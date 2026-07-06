"""Product QR code generation tests (admin-only, PNG image response)."""

from bson import ObjectId

from tests.conftest import insert_user, insert_category, insert_product, get_token, bearer


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _customer_headers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    return bearer(token)


def test_qr_code_returns_png(client, db):
    hdrs   = _admin_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id, name="QR Salmon"))

    r = client.get(f"/admin/products/{pid}/qr-code", headers=hdrs)
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_qr_code_blocks_customers(client, db):
    hdrs   = _customer_headers(client, db)
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id))

    r = client.get(f"/admin/products/{pid}/qr-code", headers=hdrs)
    assert r.status_code == 403


def test_qr_code_blocks_anonymous(client, db):
    cat_id = insert_category(db)
    pid    = str(insert_product(db, cat_id))
    r = client.get(f"/admin/products/{pid}/qr-code")
    assert r.status_code == 401


def test_qr_code_404_for_missing_product(client, db):
    hdrs = _admin_headers(client, db)
    r = client.get(f"/admin/products/{ObjectId()}/qr-code", headers=hdrs)
    assert r.status_code == 404


def test_qr_code_400_for_invalid_product_id(client, db):
    hdrs = _admin_headers(client, db)
    r = client.get("/admin/products/not-an-id/qr-code", headers=hdrs)
    assert r.status_code == 400
