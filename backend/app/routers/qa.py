"""
Product Q&A router.

GET  /qa/{product_id}  → list answered Q&As for a product (public)
POST /qa/{product_id}  → submit a question (authenticated customers)
"""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo.database import Database

from app.dependencies import get_db, get_current_user

router = APIRouter(prefix="/qa", tags=["Q&A"])


def _qa_to_dict(doc: dict) -> dict:
    return {
        "id":         str(doc["_id"]),
        "productId":  doc.get("product_id", ""),
        "userId":     doc.get("user_id", ""),
        "userName":   doc.get("user_name", ""),
        "question":   doc.get("question", ""),
        "answer":     doc.get("answer"),
        "answeredAt": doc["answered_at"].isoformat() if doc.get("answered_at") else None,
        "createdAt":  doc["created_at"].isoformat() if doc.get("created_at") else "",
    }


@router.get("/{product_id}")
def list_qa(product_id: str, db: Database = Depends(get_db)):
    docs = list(
        db.qa.find({"product_id": product_id})
        .sort("created_at", -1)
        .limit(20)
    )
    return {"success": True, "data": [_qa_to_dict(d) for d in docs]}


class QuestionRequest(BaseModel):
    question: str


@router.post("/{product_id}", status_code=201)
def submit_question(
    product_id: str,
    body: QuestionRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if len(body.question.strip()) < 10:
        raise HTTPException(status_code=422, detail="Question must be at least 10 characters.")

    doc = {
        "product_id": product_id,
        "user_id":    str(current_user["_id"]),
        "user_name":  current_user.get("name", "Customer"),
        "question":   body.question.strip(),
        "answer":     None,
        "answered_at": None,
        "created_at": datetime.now(timezone.utc),
    }
    result = db.qa.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"success": True, "data": _qa_to_dict(doc)}
