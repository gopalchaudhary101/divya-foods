"""
Cart endpoint tests.

CartItemIn requires: productId, name, price, quantity (image + maxQuantity optional).
"""

from tests.conftest import insert_user, insert_category, insert_product, get_token, bearer


def _item(pid: str, qty: int = 1) -> dict:
    return {"productId": pid, "name": "Salmon 500g", "price": 799.0, "quantity": qty}


def _setup(client, db):
    """Create user + product, return (auth_headers, product_id_str)."""
    insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Salmon 500g", price=799.0)
    token  = get_token(client, "user@test.com")
    return bearer(token), str(pid)


def test_get_cart_unauthenticated(client):
    r = client.get("/cart")
    assert r.status_code == 401


def test_get_cart_empty(client, db):
    insert_user(db)
    token = get_token(client, "user@test.com")
    r = client.get("/cart", headers=bearer(token))
    assert r.status_code == 200
    assert r.json()["data"]["items"] == []


def test_add_item_to_cart(client, db):
    hdrs, pid = _setup(client, db)
    r = client.post("/cart/items", json=_item(pid, 2), headers=hdrs)
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["productId"] == pid
    assert items[0]["quantity"] == 2


def test_add_same_item_increments_qty(client, db):
    hdrs, pid = _setup(client, db)
    client.post("/cart/items", json=_item(pid, 1), headers=hdrs)
    client.post("/cart/items", json=_item(pid, 2), headers=hdrs)
    r = client.get("/cart", headers=hdrs)
    assert r.json()["data"]["items"][0]["quantity"] == 3


def test_update_cart_item_quantity(client, db):
    hdrs, pid = _setup(client, db)
    client.post("/cart/items", json=_item(pid, 1), headers=hdrs)
    r = client.put(f"/cart/items/{pid}", json={"quantity": 5}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["items"][0]["quantity"] == 5


def test_remove_cart_item(client, db):
    hdrs, pid = _setup(client, db)
    client.post("/cart/items", json=_item(pid, 2), headers=hdrs)
    r = client.delete(f"/cart/items/{pid}", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["items"] == []


def test_clear_cart(client, db):
    hdrs, pid = _setup(client, db)
    client.post("/cart/items", json=_item(pid, 1), headers=hdrs)
    r = client.delete("/cart", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["items"] == []


def test_add_out_of_stock_item(client, db):
    insert_user(db)
    cat_id = insert_category(db)
    pid    = insert_product(db, cat_id, name="Out Stock Fish", price=500.0, in_stock=False)
    token  = get_token(client, "user@test.com")
    hdrs   = bearer(token)
    r = client.post("/cart/items",
        json={"productId": str(pid), "name": "Out Stock Fish", "price": 500.0, "quantity": 1},
        headers=hdrs,
    )
    # Must not 500 — either 200 (item added) or 400 (rejected)
    assert r.status_code in (200, 400)


def test_sync_cart(client, db):
    hdrs, pid = _setup(client, db)
    payload = {"items": [_item(pid, 3)]}
    r = client.post("/cart/sync", json=payload, headers=hdrs)
    assert r.status_code == 200
    r2 = client.get("/cart", headers=hdrs)
    assert r2.json()["data"]["items"][0]["quantity"] == 3
