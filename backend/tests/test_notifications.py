"""
Notification endpoint tests.

Covers: push subscribe/unsubscribe, in-app notification list, unread count,
mark-all-read.
"""

from datetime import datetime, timezone

from tests.conftest import insert_user, get_token, bearer

_PUSH_SUB = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
    "keys": {"p256dh": "test-p256dh-key", "auth": "test-auth-key"},
}


def _headers(client, email="user@test.com"):
    token = get_token(client, email)
    return bearer(token)


def _insert_notification(db, user_id, is_read=False, title="You have a new order update"):
    return db.notifications.insert_one({
        "user_id":    user_id,
        "type":       "order",
        "title":      title,
        "message":    "Your order has shipped.",
        "is_read":    is_read,
        "data":       {},
        "created_at": datetime.now(timezone.utc),
    }).inserted_id


# ─── Push subscriptions ─────────────────────────────────────────────────────────

def test_subscribe_push(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.post("/notifications/subscribe", json=_PUSH_SUB, headers=hdrs)
    assert r.status_code == 204
    assert db.push_subscriptions.find_one({"endpoint": _PUSH_SUB["endpoint"]}) is not None


def test_subscribe_push_requires_auth(client):
    r = client.post("/notifications/subscribe", json=_PUSH_SUB)
    assert r.status_code == 401


def test_unsubscribe_push(client, db):
    insert_user(db)
    hdrs = _headers(client)
    client.post("/notifications/subscribe", json=_PUSH_SUB, headers=hdrs)

    r = client.request("DELETE", "/notifications/subscribe", json={"endpoint": _PUSH_SUB["endpoint"]}, headers=hdrs)
    assert r.status_code == 204
    assert db.push_subscriptions.find_one({"endpoint": _PUSH_SUB["endpoint"]}) is None


def test_cannot_unsubscribe_another_users_push_subscription(client, db):
    """
    Regression test: unsubscribe used to filter only by endpoint, so any
    logged-in user who learned/guessed another user's push endpoint URL could
    delete that victim's subscription. It must now also require the endpoint
    to belong to the requesting user.
    """
    insert_user(db, email="victim@test.com")
    victim_hdrs = _headers(client, email="victim@test.com")
    client.post("/notifications/subscribe", json=_PUSH_SUB, headers=victim_hdrs)

    insert_user(db, email="attacker@test.com")
    attacker_hdrs = _headers(client, email="attacker@test.com")
    r = client.request(
        "DELETE", "/notifications/subscribe",
        json={"endpoint": _PUSH_SUB["endpoint"]}, headers=attacker_hdrs,
    )

    assert r.status_code == 204   # still no-content — doesn't leak whether the endpoint exists
    assert db.push_subscriptions.find_one({"endpoint": _PUSH_SUB["endpoint"]}) is not None   # victim's subscription survives


# ─── In-app notifications ───────────────────────────────────────────────────────

def test_list_notifications_empty(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.get("/notifications", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_list_notifications_only_returns_own(client, db):
    uid = insert_user(db, email="user@test.com")
    other_uid = insert_user(db, email="other@test.com")
    _insert_notification(db, uid, title="Mine")
    _insert_notification(db, other_uid, title="Not mine")

    hdrs = _headers(client)
    r = client.get("/notifications", headers=hdrs)
    titles = [n["title"] for n in r.json()["data"]]
    assert titles == ["Mine"]


def test_unread_count(client, db):
    uid = insert_user(db)
    _insert_notification(db, uid, is_read=False)
    _insert_notification(db, uid, is_read=False)
    _insert_notification(db, uid, is_read=True)

    hdrs = _headers(client)
    r = client.get("/notifications/unread-count", headers=hdrs)
    assert r.json()["data"] == 2


def test_mark_all_read(client, db):
    uid = insert_user(db)
    _insert_notification(db, uid, is_read=False)
    _insert_notification(db, uid, is_read=False)

    hdrs = _headers(client)
    r = client.post("/notifications/read-all", headers=hdrs)
    assert r.status_code == 204

    unread = client.get("/notifications/unread-count", headers=hdrs).json()["data"]
    assert unread == 0


def test_notifications_require_auth(client):
    assert client.get("/notifications").status_code == 401
    assert client.get("/notifications/unread-count").status_code == 401
    assert client.post("/notifications/read-all").status_code == 401
