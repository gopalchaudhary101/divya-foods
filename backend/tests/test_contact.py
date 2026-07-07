"""Contact Us form — submission, validation, and email relay."""

from unittest.mock import patch


def test_contact_form_submission_success(client, db):
    with patch("app.services.email_service.send_async") as mock_send:
        r = client.post("/contact", json={
            "name": "Priya Sharma",
            "email": "priya@test.com",
            "phone": "9999999999",
            "message": "Do you deliver to Faridabad?",
        })
    assert r.status_code == 201, r.text
    assert mock_send.call_count == 1

    stored = db.contact_submissions.find_one({"email": "priya@test.com"})
    assert stored is not None
    assert stored["name"] == "Priya Sharma"
    assert stored["message"] == "Do you deliver to Faridabad?"


def test_contact_form_rejects_short_message(client, db):
    r = client.post("/contact", json={
        "name": "Priya Sharma",
        "email": "priya@test.com",
        "phone": "9999999999",
        "message": "Hi",
    })
    assert r.status_code == 422


def test_contact_form_rejects_invalid_email(client, db):
    r = client.post("/contact", json={
        "name": "Priya Sharma",
        "email": "not-an-email",
        "message": "Do you deliver to Faridabad?",
    })
    assert r.status_code == 422


def test_contact_form_escapes_html_in_message(client, db):
    """A malicious submission must not inject markup into the admin's inbox."""
    from app.services import email_service

    with patch.object(email_service, "send_async") as mock_send_async:
        email_service.contact_form_submission(
            "<script>alert(1)</script>", "attacker@test.com", "", "hello",
        )
    assert mock_send_async.called
    html_sent = mock_send_async.call_args.args[2]
    assert "<script>" not in html_sent
    assert "&lt;script&gt;" in html_sent
