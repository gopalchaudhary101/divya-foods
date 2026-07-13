"""Unit tests for app.utils.slug — shared slug generation + collision handling."""

from bson import ObjectId

from app.utils.slug import slugify, unique_slug


# ─── slugify ───────────────────────────────────────────────────────────────────

def test_slugify_lowercases_and_hyphenates():
    assert slugify("Hello World") == "hello-world"


def test_slugify_strips_special_characters():
    assert slugify("Salmon & Prawns!!") == "salmon-prawns"


def test_slugify_collapses_multiple_spaces():
    assert slugify("Too   Many    Spaces") == "too-many-spaces"


def test_slugify_trims_leading_and_trailing_whitespace():
    assert slugify("  Padded Title  ") == "padded-title"


def test_slugify_collapses_repeated_hyphens():
    assert slugify("Already--Hyphenated") == "already-hyphenated"


def test_slugify_preserves_numbers():
    assert slugify("Product 123") == "product-123"


# ─── unique_slug ────────────────────────────────────────────────────────────────

def test_unique_slug_returns_base_when_not_taken(db):
    result = unique_slug(db, "products", "salmon-fillet")
    assert result == "salmon-fillet"


def test_unique_slug_appends_counter_on_collision(db):
    db.products.insert_one({"slug": "salmon-fillet"})
    result = unique_slug(db, "products", "salmon-fillet")
    assert result == "salmon-fillet-1"


def test_unique_slug_increments_past_multiple_collisions(db):
    db.products.insert_one({"slug": "salmon-fillet"})
    db.products.insert_one({"slug": "salmon-fillet-1"})
    result = unique_slug(db, "products", "salmon-fillet")
    assert result == "salmon-fillet-2"


def test_unique_slug_exclude_id_ignores_own_document(db):
    """Updating a document shouldn't collide with its own existing slug."""
    doc_id = db.products.insert_one({"slug": "salmon-fillet"}).inserted_id
    result = unique_slug(db, "products", "salmon-fillet", exclude_id=doc_id)
    assert result == "salmon-fillet"


def test_unique_slug_exclude_id_still_collides_with_other_documents(db):
    db.products.insert_one({"slug": "salmon-fillet"})
    other_id = ObjectId()
    result = unique_slug(db, "products", "salmon-fillet", exclude_id=other_id)
    assert result == "salmon-fillet-1"
