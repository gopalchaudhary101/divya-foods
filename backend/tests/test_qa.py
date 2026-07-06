"""
Product Q&A endpoint tests.

Covers: public list, question submission validation, and admin moderation
(answer / delete / unanswered filter).
"""

from bson import ObjectId

from tests.conftest import insert_user, insert_category, insert_product, get_token, bearer


def _headers(client, email="user@test.com"):
    token = get_token(client, email)
    return bearer(token)


def _admin_headers(client, db):
    insert_user(db, email="admin@test.com", role="admin", name="Admin")
    token = get_token(client, "admin@test.com")
    return bearer(token)


def test_list_qa_empty(client, db):
    r = client.get("/qa/some-product-id")
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_submit_question(client, db):
    insert_user(db)
    hdrs = _headers(client)

    r = client.post("/qa/prod123", json={"question": "Is this salmon wild-caught or farmed?"}, headers=hdrs)
    assert r.status_code == 201
    data = r.json()["data"]
    assert data["question"] == "Is this salmon wild-caught or farmed?"
    assert data["answer"] is None


def test_submit_question_too_short_rejected(client, db):
    insert_user(db)
    hdrs = _headers(client)
    r = client.post("/qa/prod123", json={"question": "short?"}, headers=hdrs)
    assert r.status_code == 422


def test_submit_question_requires_auth(client):
    r = client.post("/qa/prod123", json={"question": "Is this fresh or frozen on arrival?"})
    assert r.status_code == 401


def test_list_qa_scoped_to_product(client, db):
    insert_user(db)
    hdrs = _headers(client)
    client.post("/qa/prodA", json={"question": "Question about product A here"}, headers=hdrs)
    client.post("/qa/prodB", json={"question": "Question about product B here"}, headers=hdrs)

    r = client.get("/qa/prodA")
    assert len(r.json()["data"]) == 1
    assert r.json()["data"][0]["productId"] == "prodA"


# ─── Admin moderation ───────────────────────────────────────────────────────────

def test_admin_answer_question(client, db):
    insert_user(db)
    hdrs = _headers(client)
    qid = client.post("/qa/prod1", json={"question": "How long does delivery take?"}, headers=hdrs).json()["data"]["id"]

    admin_hdrs = _admin_headers(client, db)
    r = client.put(f"/admin/qa/{qid}", json={"answer": "Usually within 24 hours."}, headers=admin_hdrs)
    assert r.status_code == 200

    listed = client.get("/qa/prod1").json()["data"][0]
    assert listed["answer"] == "Usually within 24 hours."
    assert listed["answeredAt"] is not None


def test_admin_list_unanswered_filter(client, db):
    insert_user(db)
    hdrs = _headers(client)
    qid = client.post("/qa/prod1", json={"question": "Is this available in bulk?"}, headers=hdrs).json()["data"]["id"]
    client.post("/qa/prod2", json={"question": "Do you deliver to Faridabad?"}, headers=hdrs)

    admin_hdrs = _admin_headers(client, db)
    client.put(f"/admin/qa/{qid}", json={"answer": "Yes, we do bulk orders."}, headers=admin_hdrs)

    r = client.get("/admin/qa?unanswered=true", headers=admin_hdrs)
    questions = [q["question"] for q in r.json()["data"]]
    assert "Do you deliver to Faridabad?" in questions
    assert "Is this available in bulk?" not in questions


def test_admin_delete_question(client, db):
    insert_user(db)
    hdrs = _headers(client)
    qid = client.post("/qa/prod1", json={"question": "Can I return this if unopened?"}, headers=hdrs).json()["data"]["id"]

    admin_hdrs = _admin_headers(client, db)
    r = client.delete(f"/admin/qa/{qid}", headers=admin_hdrs)
    assert r.status_code == 204

    assert client.get("/qa/prod1").json()["data"] == []


def test_admin_qa_endpoints_require_admin(client, db):
    insert_user(db, email="cust@test.com", role="customer")
    token = get_token(client, "cust@test.com")
    fake_id = str(ObjectId())
    r = client.put(f"/admin/qa/{fake_id}", json={"answer": "x"}, headers=bearer(token))
    assert r.status_code == 403
