"""
Admin user management — search/list any user account and change their role
between customer/admin/driver.

'developer' is deliberately untouchable from here (see
backend/scripts/promote_to_developer.py's own docstring: it's a rare,
manually-bootstrapped role, not something granted through the app) — this
service refuses to set it as a target role, and refuses to modify any account
that already has it, so no UI path can ever create or demote a developer.

Role checks are re-read from the database on every request (get_current_user
fetches the live user doc, not a cached JWT claim), so a role change here
takes effect on the very next API call the affected user makes — no stale
token window to worry about.
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.database import Database

ASSIGNABLE_ROLES = {"customer", "admin", "driver"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_dict(doc: dict, order_count: int = 0) -> dict:
    return {
        "id":         str(doc["_id"]),
        "name":       doc["name"],
        "email":      doc["email"],
        "phone":      doc.get("phone"),
        "role":       doc["role"],
        "isActive":   doc.get("is_active", True),
        "createdAt":  doc["created_at"].isoformat(),
        "orderCount": order_count,
    }


def admin_list_users(db: Database, search: str = None, role_filter: str = None, page: int = 1, limit: int = 20) -> dict:
    query: dict = {}
    if role_filter:
        query["role"] = role_filter
    if search:
        query["$or"] = [
            {"name":  {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]

    total = db.users.count_documents(query)
    docs = list(
        db.users.find(query).sort([("created_at", -1)]).skip((page - 1) * limit).limit(limit)
    )

    # Order counts per user — cheap to aggregate for a single page (max `limit` users)
    order_counts = {
        row["_id"]: row["count"]
        for row in db.orders.aggregate([
            {"$match": {"user_id": {"$in": [d["_id"] for d in docs]}}},
            {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        ])
    }

    return {
        "success":    True,
        "data":       [_to_dict(d, order_counts.get(d["_id"], 0)) for d in docs],
        "total":      total,
        "page":       page,
        "totalPages": -(-total // limit),
    }


def admin_update_role(db: Database, acting_user_id: ObjectId, target_user_id: str, new_role: str) -> dict:
    if new_role not in ASSIGNABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"role must be one of: {', '.join(sorted(ASSIGNABLE_ROLES))}",
        )
    try:
        oid = ObjectId(target_user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID.")

    if oid == acting_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own role.")

    target = db.users.find_one({"_id": oid})
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target.get("role") == "developer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Developer accounts cannot be modified here.")

    db.users.update_one({"_id": oid}, {"$set": {"role": new_role, "updated_at": _utcnow()}})
    updated = db.users.find_one({"_id": oid})
    return {"success": True, "data": _to_dict(updated)}
