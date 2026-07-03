from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.dependencies import get_db, get_current_user

router = APIRouter(prefix="/reviews", tags=["Reviews"])


# ─── Schema ───────────────────────────────────────────────────────────────────

class CreateReviewRequest(BaseModel):
    product_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(..., min_length=10, max_length=1000)


def _to_dict(r: dict) -> dict:
    return {
        "id":                  str(r["_id"]),
        "productId":           str(r["product_id"]),
        "userId":              str(r["user_id"]),
        "userName":            r["user_name"],
        "rating":              r["rating"],
        "comment":             r["comment"],
        "isVerifiedPurchase":  r.get("is_verified_purchase", True),
        "createdAt":           r["created_at"].isoformat(),
    }


def _recalculate(db: Database, product_id: ObjectId) -> None:
    """Recompute product rating and review_count after insert or delete."""
    agg = list(db.reviews.aggregate([
        {"$match": {"product_id": product_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]))
    avg   = round(agg[0]["avg"], 1) if agg else 0.0
    count = agg[0]["count"]         if agg else 0
    db.products.update_one(
        {"_id": product_id},
        {"$set": {"rating": avg, "review_count": count}},
    )


# ─── Eligibility check (must come before /{product_id} to avoid route clash) ─

@router.get("/can-review/{product_id}")
def can_review(
    product_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Returns whether the authenticated user may leave a review for this product."""
    try:
        pid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID.")

    existing = db.reviews.find_one({"product_id": pid, "user_id": current_user["_id"]})
    if existing:
        return {"success": True, "data": {
            "canReview": False,
            "reason":    "already_reviewed",
            "reviewId":  str(existing["_id"]),
        }}

    has_purchase = db.orders.find_one({
        "user_id":          current_user["_id"],
        "status":           "delivered",
        "items.product_id": pid,
    })
    if not has_purchase:
        return {"success": True, "data": {"canReview": False, "reason": "no_purchase"}}

    return {"success": True, "data": {"canReview": True, "reason": None}}


# ─── List reviews ─────────────────────────────────────────────────────────────

@router.get("/{product_id}")
def get_reviews(
    product_id: str,
    page:  int = Query(1,  ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: Database = Depends(get_db),
):
    try:
        pid = ObjectId(product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID.")

    skip  = (page - 1) * limit
    total = db.reviews.count_documents({"product_id": pid})
    docs  = list(db.reviews.find({"product_id": pid}).sort("created_at", -1).skip(skip).limit(limit))

    return {
        "success":    True,
        "data":       [_to_dict(r) for r in docs],
        "total":      total,
        "page":       page,
        "totalPages": -(-total // limit),
    }


# ─── Create review ────────────────────────────────────────────────────────────

@router.post("")
def create_review(
    body: CreateReviewRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        pid = ObjectId(body.product_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid product ID.")

    user_id = current_user["_id"]

    if db.reviews.find_one({"product_id": pid, "user_id": user_id}):
        raise HTTPException(status_code=409, detail="You have already reviewed this product.")

    if not db.orders.find_one({"user_id": user_id, "status": "delivered", "items.product_id": pid}):
        raise HTTPException(
            status_code=403,
            detail="Only customers who have received this product can leave a review.",
        )

    now = datetime.now(timezone.utc)
    doc = {
        "product_id":           pid,
        "user_id":              user_id,
        "user_name":            current_user.get("name", "Customer"),
        "rating":               body.rating,
        "comment":              body.comment.strip(),
        "is_verified_purchase": True,
        "created_at":           now,
        "updated_at":           now,
    }
    result = db.reviews.insert_one(doc)
    doc["_id"] = result.inserted_id
    _recalculate(db, pid)

    return {"success": True, "data": _to_dict(doc)}


# ─── Delete review ────────────────────────────────────────────────────────────

@router.delete("/{review_id}")
def delete_review(
    review_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        rid = ObjectId(review_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid review ID.")

    review = db.reviews.find_one({"_id": rid})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")
    if review["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own reviews.")

    pid = review["product_id"]
    db.reviews.delete_one({"_id": rid})
    _recalculate(db, pid)

    return {"success": True, "data": {"deleted": True}}
