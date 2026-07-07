"""Contact Us form — records the inquiry and emails the business inbox."""

from datetime import datetime, timezone

from pymongo.database import Database

from app.services import email_service


def submit(db: Database, name: str, email: str, phone: str, message: str) -> dict:
    name = name.strip()
    email = email.lower().strip()
    phone = phone.strip()
    message = message.strip()

    now = datetime.now(timezone.utc)
    db.contact_submissions.insert_one({
        "name": name,
        "email": email,
        "phone": phone,
        "message": message,
        "created_at": now,
    })

    email_service.contact_form_submission(name, email, phone, message)

    return {"success": True, "message": "Thanks for reaching out — we'll get back to you shortly."}
