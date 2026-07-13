"""
Settings endpoint tests.

Covers: public settings (business name, GST, FSSAI placeholders) and admin update.
"""

from tests.conftest import insert_user, get_token, bearer


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _customer_headers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    return bearer(token)


# ─── Public endpoint ──────────────────────────────────────────────────────────

def test_get_settings_returns_real_business_details_by_default(client, db):
    r = client.get("/settings")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["businessName"] == "Divya Foods"
    assert data["gstNumber"] == "07CEZPJ6770F1ZU"
    assert data["fssaiNumber"] == "13323010000427"


def test_get_settings_reflects_admin_update(client, db):
    hdrs = _admin_headers(client, db)
    client.put("/admin/settings", json={"gstNumber": "22AAAAA0000A1Z5"}, headers=hdrs)

    r = client.get("/settings")
    assert r.json()["data"]["gstNumber"] == "22AAAAA0000A1Z5"


# ─── Admin access control ─────────────────────────────────────────────────────

def test_admin_settings_endpoints_block_customers(client, db):
    hdrs = _customer_headers(client, db)
    assert client.get("/admin/settings", headers=hdrs).status_code == 403
    assert client.put("/admin/settings", json={"gstNumber": "x"}, headers=hdrs).status_code == 403


def test_admin_settings_endpoints_block_anonymous(client):
    assert client.get("/admin/settings").status_code == 401
    assert client.put("/admin/settings", json={"gstNumber": "x"}).status_code == 401


# ─── Admin update ─────────────────────────────────────────────────────────────

def test_admin_update_settings_partial(client, db):
    hdrs = _admin_headers(client, db)
    r = client.put("/admin/settings", json={"fssaiNumber": "12345678901234"}, headers=hdrs)

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["fssaiNumber"] == "12345678901234"
    assert data["businessName"] == "Divya Foods"  # untouched field keeps its default


def test_admin_update_settings_persists_across_calls(client, db):
    hdrs = _admin_headers(client, db)
    client.put("/admin/settings", json={"businessName": "Divya Foods Pvt Ltd"}, headers=hdrs)

    r = client.get("/admin/settings", headers=hdrs)
    assert r.json()["data"]["businessName"] == "Divya Foods Pvt Ltd"


def test_admin_update_settings_ignores_unknown_fields(client, db):
    hdrs = _admin_headers(client, db)
    r = client.put("/admin/settings", json={"gstNumber": "22AAAAA0000A1Z5", "notAField": "x"}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["gstNumber"] == "22AAAAA0000A1Z5"


# ─── Image-upload limits ───────────────────────────────────────────────────────

def test_admin_settings_include_upload_defaults(client, db):
    hdrs = _admin_headers(client, db)
    r = client.get("/admin/settings", headers=hdrs)
    data = r.json()["data"]
    assert data["maxUploadSizeMB"] == 5
    assert data["maxImageDimension"] == 6000
    assert data["compressionQuality"] == "auto:good"
    assert data["allowedFormats"] == ["jpeg", "png", "webp"]
    assert data["enableWebP"] is True
    assert data["enableAVIF"] is True
    assert data["thumbnailSizes"] == [150, 400, 800]


def test_admin_can_update_upload_settings(client, db):
    hdrs = _admin_headers(client, db)
    r = client.put("/admin/settings", json={
        "maxUploadSizeMB": 10,
        "compressionQuality": "auto:best",
        "allowedFormats": ["jpeg", "png"],
        "enableAVIF": False,
    }, headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["maxUploadSizeMB"] == 10
    assert data["compressionQuality"] == "auto:best"
    assert data["allowedFormats"] == ["jpeg", "png"]
    assert data["enableAVIF"] is False
    assert data["enableWebP"] is True  # untouched field keeps its default


def test_public_settings_does_not_expose_upload_config(client, db):
    r = client.get("/settings")
    data = r.json()["data"]
    assert "maxUploadSizeMB" not in data
    assert "compressionQuality" not in data


# ─── Delivery providers ─────────────────────────────────────────────────────────

def test_admin_settings_include_delivery_providers_default(client, db):
    hdrs = _admin_headers(client, db)
    r = client.get("/admin/settings", headers=hdrs)
    assert r.json()["data"]["deliveryProviders"] == ["Porter", "Dunzo", "In-house", "Other"]


def test_admin_can_update_delivery_providers(client, db):
    hdrs = _admin_headers(client, db)
    r = client.put("/admin/settings", json={"deliveryProviders": ["Porter", "Shadowfax"]}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["deliveryProviders"] == ["Porter", "Shadowfax"]
