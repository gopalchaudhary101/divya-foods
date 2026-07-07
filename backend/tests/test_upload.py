"""
Upload endpoint tests.

Covers: admin-only guard, unconfigured-Cloudinary 503, MIME/size validation,
the automatic optimization pipeline (corruption detection, EXIF orientation
correction, aspect-ratio-preserving resize, transparent PNG handling,
duplicate-upload detection, admin-configurable limits), and batch upload.
"""

from io import BytesIO
from unittest.mock import patch

from PIL import Image

from tests.conftest import insert_user, get_token, bearer

# A real, decodable 20x10 JPEG — needed now that uploads are actually
# decoded/validated by Pillow instead of just checked by MIME type.
def _make_jpeg(size=(20, 10), color="red") -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, color).save(buf, format="JPEG")
    return buf.getvalue()


def _make_transparent_png(size=(20, 10)) -> bytes:
    buf = BytesIO()
    Image.new("RGBA", size, (255, 0, 0, 128)).save(buf, format="PNG")
    return buf.getvalue()


def _make_oriented_jpeg(size=(20, 10), orientation=6) -> bytes:
    """A landscape JPEG tagged with an EXIF orientation that means 'rotate 90° CW to display'."""
    img = Image.new("RGB", size, "blue")
    exif = img.getexif()
    exif[274] = orientation  # 274 = EXIF Orientation tag
    buf = BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


_TINY_JPEG = _make_jpeg()
_FAKE_RESULT = {
    "secure_url": "https://res.cloudinary.com/demo/image/upload/v1/divyafoods/products/abc.jpg",
    "public_id":  "divyafoods/products/abc",
    "width":      800,
    "height":     800,
}


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def _customer_headers(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    return bearer(token)


def _cloudinary_configured():
    return (
        patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"),
        patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"),
        patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"),
    )


def test_upload_requires_admin(client, db):
    hdrs = _customer_headers(client, db)
    r = client.post("/upload/image", files={"file": ("test.jpg", _TINY_JPEG, "image/jpeg")}, headers=hdrs)
    assert r.status_code == 403


def test_upload_requires_auth(client):
    r = client.post("/upload/image", files={"file": ("test.jpg", _TINY_JPEG, "image/jpeg")})
    assert r.status_code == 401


def test_upload_returns_503_when_cloudinary_unconfigured(client, db):
    hdrs = _admin_headers(client, db)
    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", ""), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", ""), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", ""):
        r = client.post("/upload/image", files={"file": ("test.jpg", _TINY_JPEG, "image/jpeg")}, headers=hdrs)
    assert r.status_code == 503


def test_upload_rejects_unsupported_mime_type(client, db):
    hdrs = _admin_headers(client, db)
    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"):
        r = client.post("/upload/image", files={"file": ("test.gif", b"GIF89a", "image/gif")}, headers=hdrs)
    assert r.status_code == 400
    assert "Unsupported file type" in r.json()["detail"]


def test_upload_rejects_oversized_file(client, db):
    hdrs = _admin_headers(client, db)
    oversized = b"0" * (5 * 1024 * 1024 + 1)
    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"):
        r = client.post("/upload/image", files={"file": ("big.jpg", oversized, "image/jpeg")}, headers=hdrs)
    assert r.status_code == 400
    assert "too large" in r.json()["detail"].lower()


def test_upload_success(client, db):
    hdrs = _admin_headers(client, db)
    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"), \
         patch("cloudinary.config"), \
         patch("cloudinary.uploader.upload", return_value=_FAKE_RESULT):
        r = client.post("/upload/image", files={"file": ("test.jpg", _TINY_JPEG, "image/jpeg")}, headers=hdrs)

    assert r.status_code == 200
    data = r.json()
    assert data["url"] == _FAKE_RESULT["secure_url"]
    assert data["publicId"] == "divyafoods/products/abc"
    assert data["duplicate"] is False


def test_upload_failure_returns_500(client, db):
    hdrs = _admin_headers(client, db)
    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"), \
         patch("cloudinary.config"), \
         patch("cloudinary.uploader.upload", side_effect=Exception("network error")):
        r = client.post("/upload/image", files={"file": ("test.jpg", _TINY_JPEG, "image/jpeg")}, headers=hdrs)

    assert r.status_code == 500


# ─── Optimization pipeline ──────────────────────────────────────────────────────

def test_upload_rejects_corrupted_file(client, db):
    hdrs = _admin_headers(client, db)
    garbage = b"this is not an image, just plain bytes pretending to be one" * 5
    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"):
        r = client.post("/upload/image", files={"file": ("fake.jpg", garbage, "image/jpeg")}, headers=hdrs)
    assert r.status_code == 400
    assert "not a valid image" in r.json()["detail"].lower()


def test_upload_resizes_oversized_images_preserving_aspect_ratio(client, db):
    hdrs = _admin_headers(client, db)
    # 3:1 aspect ratio, larger than the configured max dimension
    large = _make_jpeg(size=(3000, 1000))

    # Lower the max dimension via the settings singleton the pipeline reads from
    db.settings.update_one({"_id": "site_settings"}, {"$set": {"maxImageDimension": 300}}, upsert=True)

    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"), \
         patch("cloudinary.config"), \
         patch("cloudinary.uploader.upload", return_value=_FAKE_RESULT) as mock_upload:
        r = client.post("/upload/image", files={"file": ("big.jpg", large, "image/jpeg")}, headers=hdrs)

    assert r.status_code == 200
    sent_bytes = mock_upload.call_args.args[0]
    processed = Image.open(sent_bytes)
    assert max(processed.size) <= 300
    # Aspect ratio (3:1) preserved within a rounding pixel
    assert abs(processed.size[0] / processed.size[1] - 3.0) < 0.1


def test_upload_corrects_exif_orientation(client, db):
    hdrs = _admin_headers(client, db)
    oriented = _make_oriented_jpeg(size=(200, 100), orientation=6)

    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"), \
         patch("cloudinary.config"), \
         patch("cloudinary.uploader.upload", return_value=_FAKE_RESULT) as mock_upload:
        r = client.post("/upload/image", files={"file": ("rotated.jpg", oriented, "image/jpeg")}, headers=hdrs)

    assert r.status_code == 200
    sent_bytes = mock_upload.call_args.args[0]
    processed = Image.open(sent_bytes)
    # Orientation 6 rotates 200x100 to a displayed 100x200 — and the tag is dropped after correction
    assert processed.size == (100, 200)
    assert 274 not in (processed.getexif() or {})


def test_upload_preserves_transparent_png_alpha(client, db):
    hdrs = _admin_headers(client, db)
    transparent = _make_transparent_png()

    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"), \
         patch("cloudinary.config"), \
         patch("cloudinary.uploader.upload", return_value=_FAKE_RESULT) as mock_upload:
        r = client.post("/upload/image", files={"file": ("logo.png", transparent, "image/png")}, headers=hdrs)

    assert r.status_code == 200
    sent_bytes = mock_upload.call_args.args[0]
    processed = Image.open(sent_bytes)
    assert processed.mode == "RGBA"
    assert processed.format == "PNG"


def test_upload_detects_duplicate_and_skips_reupload(client, db):
    hdrs = _admin_headers(client, db)
    same_file = _make_jpeg()

    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"), \
         patch("cloudinary.config"), \
         patch("cloudinary.uploader.upload", return_value=_FAKE_RESULT) as mock_upload:
        r1 = client.post("/upload/image", files={"file": ("a.jpg", same_file, "image/jpeg")}, headers=hdrs)
        r2 = client.post("/upload/image", files={"file": ("a-copy.jpg", same_file, "image/jpeg")}, headers=hdrs)

    assert r1.json()["duplicate"] is False
    assert r2.json()["duplicate"] is True
    assert r2.json()["url"] == r1.json()["url"]
    assert mock_upload.call_count == 1  # second upload reused the cached hash, no re-upload


def test_upload_respects_configurable_allowed_formats(client, db):
    hdrs = _admin_headers(client, db)
    db.settings.update_one({"_id": "site_settings"}, {"$set": {"allowedFormats": ["png"]}}, upsert=True)

    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"):
        r = client.post("/upload/image", files={"file": ("test.jpg", _TINY_JPEG, "image/jpeg")}, headers=hdrs)

    assert r.status_code == 400
    assert "PNG" in r.json()["detail"]


def test_upload_respects_configurable_max_size(client, db):
    hdrs = _admin_headers(client, db)
    db.settings.update_one({"_id": "site_settings"}, {"$set": {"maxUploadSizeMB": 1}}, upsert=True)
    two_mb = b"0" * (2 * 1024 * 1024)

    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"):
        r = client.post("/upload/image", files={"file": ("test.jpg", two_mb, "image/jpeg")}, headers=hdrs)

    assert r.status_code == 400
    assert "1 MB" in r.json()["detail"]


# ─── Batch upload ───────────────────────────────────────────────────────────────

def test_upload_images_requires_admin(client, db):
    hdrs = _customer_headers(client, db)
    r = client.post("/upload/images", files=[("files", ("a.jpg", _TINY_JPEG, "image/jpeg"))], headers=hdrs)
    assert r.status_code == 403


def test_upload_images_returns_503_when_cloudinary_unconfigured(client, db):
    hdrs = _admin_headers(client, db)
    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", ""), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", ""), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", ""):
        r = client.post("/upload/images", files=[("files", ("a.jpg", _TINY_JPEG, "image/jpeg"))], headers=hdrs)
    assert r.status_code == 503


def test_upload_images_rejects_batch_over_limit(client, db):
    hdrs = _admin_headers(client, db)
    files = [("files", (f"{i}.jpg", _TINY_JPEG, "image/jpeg")) for i in range(31)]
    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"):
        r = client.post("/upload/images", files=files, headers=hdrs)
    assert r.status_code == 400


def test_upload_images_success_with_mixed_results(client, db):
    hdrs = _admin_headers(client, db)
    files = [
        ("files", ("good.jpg", _TINY_JPEG, "image/jpeg")),
        ("files", ("bad.gif", b"GIF89a", "image/gif")),
    ]
    with patch("app.routers.upload.settings.CLOUDINARY_CLOUD_NAME", "demo"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_KEY", "key"), \
         patch("app.routers.upload.settings.CLOUDINARY_API_SECRET", "secret"), \
         patch("cloudinary.config"), \
         patch("cloudinary.uploader.upload", return_value=_FAKE_RESULT):
        r = client.post("/upload/images", files=files, headers=hdrs)

    assert r.status_code == 200
    results = r.json()["data"]
    assert len(results) == 2
    good = next(x for x in results if x["filename"] == "good.jpg")
    bad = next(x for x in results if x["filename"] == "bad.gif")
    assert good["url"] == _FAKE_RESULT["secure_url"]
    assert "error" in bad
