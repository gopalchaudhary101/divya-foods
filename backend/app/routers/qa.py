"""
Product Q&A router.

GET  /qa/{product_id}  → list answered Q&As for a product (public)
POST /qa/{product_id}  → submit a question (authenticated customers)
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from pymongo.database import Database

from app.dependencies import get_db, get_current_user, require_admin
from app.utils.mongo import get_object_id

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


# ─── Admin moderation ─────────────────────────────────────────────────────────
# Separate no-prefix router — lives under /admin/qa. Moved here from the
# former monolithic admin.py. Kept its own response shape (no userId) rather
# than reusing _qa_to_dict above, to avoid changing what the admin UI already
# receives.

admin_router = APIRouter(tags=["Admin"])


class QAAnswerRequest(BaseModel):
    answer: str


@admin_router.put("/admin/qa/{qa_id}")
def admin_answer_question(
    qa_id: str,
    body: QAAnswerRequest,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    oid = get_object_id(qa_id, "Q&A")
    db.qa.update_one(
        {"_id": oid},
        {"$set": {"answer": body.answer.strip(), "answered_at": datetime.now(timezone.utc)}},
    )
    return {"success": True}


@admin_router.delete("/admin/qa/{qa_id}", status_code=204)
def admin_delete_question(
    qa_id: str,
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    oid = get_object_id(qa_id, "Q&A")
    db.qa.delete_one({"_id": oid})


@admin_router.get("/admin/qa")
def admin_list_qa(
    unanswered: bool = Query(False),
    db: Database = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    query = {"answer": None} if unanswered else {}
    docs = list(db.qa.find(query).sort("created_at", -1).limit(100))
    return {
        "success": True,
        "data": [
            {
                "id":         str(d["_id"]),
                "productId":  d.get("product_id", ""),
                "userName":   d.get("user_name", ""),
                "question":   d.get("question", ""),
                "answer":     d.get("answer"),
                "createdAt":  d["created_at"].isoformat() if d.get("created_at") else "",
            }
            for d in docs
        ],
    }
