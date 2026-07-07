"""
Contact Us — public form submission.

POST /contact → stores the inquiry and emails the business inbox.
"""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from pymongo.database import Database

from app.dependencies import get_db
from app.limiter import limiter
from app.services import contact_service

router = APIRouter(prefix="/contact", tags=["Contact"])


class ContactFormRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field("", max_length=20)
    message: str = Field(..., min_length=5, max_length=2000)


@router.post("", status_code=201)
@limiter.limit("5/minute")
def submit_contact_form(request: Request, body: ContactFormRequest, db: Database = Depends(get_db)):
    return contact_service.submit(db, body.name, body.email, body.phone, body.message)
