"""Dynamic sitemap.xml tests."""

from tests.conftest import insert_category, insert_product


def test_sitemap_is_public_and_valid_xml(client, db):
    r = client.get("/sitemap.xml")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/xml")
    assert r.text.startswith('<?xml version="1.0" encoding="UTF-8"?>')
    assert "<urlset" in r.text


def test_sitemap_includes_static_pages(client, db):
    r = client.get("/sitemap.xml")
    assert "https://divya-foods.vercel.app/</loc>" in r.text
    assert "https://divya-foods.vercel.app/products</loc>" in r.text


def test_sitemap_includes_products_and_categories(client, db):
    cat_id = insert_category(db, name="Seafood", slug="seafood")
    insert_product(db, cat_id, name="Salmon Fillet")

    r = client.get("/sitemap.xml")
    assert "https://divya-foods.vercel.app/products/salmon-fillet</loc>" in r.text
    assert "category=seafood" in r.text


def test_sitemap_includes_image_tags_for_products_with_images(client, db):
    cat_id = insert_category(db)
    insert_product(db, cat_id, name="Salmon Fillet")

    r = client.get("/sitemap.xml")
    assert "<image:image>" in r.text
    assert "/assets/test.webp" in r.text  # insert_product's default image


def test_sitemap_includes_out_of_stock_products(client, db):
    cat_id = insert_category(db)
    insert_product(db, cat_id, name="Rare Fish", in_stock=False)

    r = client.get("/sitemap.xml")
    assert "https://divya-foods.vercel.app/products/rare-fish</loc>" in r.text
