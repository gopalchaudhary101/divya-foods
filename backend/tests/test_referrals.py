"""
Referral endpoint tests.

Covers: auto-generated referral code, signup counting, redemption rules
(no self-redeem, one-time use, invalid code), and side effects (coupon +
notification created for the referrer).
"""

from tests.conftest import insert_user, get_token, bearer


def _headers(client, email="user@test.com"):
    token = get_token(client, email)
    return bearer(token)


def test_get_my_referral_generates_code(client, db):
    insert_user(db)
    hdrs = _headers(client)

    r = client.get("/referrals/my", headers=hdrs)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["code"]
    assert data["signups"] == 0
    assert data["creditPerSignup"] == 100


def test_get_my_referral_code_is_stable(client, db):
    insert_user(db)
    hdrs = _headers(client)

    code1 = client.get("/referrals/my", headers=hdrs).json()["data"]["code"]
    code2 = client.get("/referrals/my", headers=hdrs).json()["data"]["code"]
    assert code1 == code2


def test_signup_count_reflects_referred_users(client, db):
    insert_user(db)
    hdrs = _headers(client)
    code = client.get("/referrals/my", headers=hdrs).json()["data"]["code"]

    db.users.insert_many([
        {"name": "A", "email": "a@test.com", "referred_by": code},
        {"name": "B", "email": "b@test.com", "referred_by": code},
    ])

    r = client.get("/referrals/my", headers=hdrs)
    assert r.json()["data"]["signups"] == 2


def test_redeem_referral_success(client, db):
    insert_user(db, email="referrer@test.com")
    ref_hdrs = _headers(client, "referrer@test.com")
    code = client.get("/referrals/my", headers=ref_hdrs).json()["data"]["code"]

    insert_user(db, email="newbie@test.com")
    newbie_hdrs = _headers(client, "newbie@test.com")

    r = client.post("/referrals/redeem", json={"code": code}, headers=newbie_hdrs)
    assert r.status_code == 200
    assert r.json()["data"]["discount"] == 100

    coupon_code = r.json()["data"]["coupon"]
    assert db.coupons.find_one({"code": coupon_code}) is not None

    notif = db.notifications.find_one({"type": "promotion"})
    assert notif is not None
    assert code in notif["message"]


def test_redeem_own_code_rejected(client, db):
    insert_user(db)
    hdrs = _headers(client)
    code = client.get("/referrals/my", headers=hdrs).json()["data"]["code"]

    r = client.post("/referrals/redeem", json={"code": code}, headers=hdrs)
    assert r.status_code == 400


def test_redeem_invalid_code_rejected(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.post("/referrals/redeem", json={"code": "NOTREAL1"}, headers=hdrs)
    assert r.status_code == 404


def test_redeem_twice_rejected(client, db):
    insert_user(db, email="referrer@test.com")
    ref_hdrs = _headers(client, "referrer@test.com")
    code = client.get("/referrals/my", headers=ref_hdrs).json()["data"]["code"]

    insert_user(db, email="newbie@test.com")
    newbie_hdrs = _headers(client, "newbie@test.com")

    r1 = client.post("/referrals/redeem", json={"code": code}, headers=newbie_hdrs)
    r2 = client.post("/referrals/redeem", json={"code": code}, headers=newbie_hdrs)
    assert r1.status_code == 200
    assert r2.status_code == 400


def test_referral_endpoints_require_auth(client):
    assert client.get("/referrals/my").status_code == 401
    assert client.post("/referrals/redeem", json={"code": "X"}).status_code == 401
