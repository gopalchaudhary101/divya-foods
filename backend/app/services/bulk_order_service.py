"""
Bulk / wholesale order requests — a lead-capture form for buyers who want a
custom quote (restaurants, hotels, exporters) rather than a normal checkout.
No payment or stock reservation happens here; admin follows up manually and
converts it into a real order (or a custom invoice) outside this flow.
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from pymongo import ReturnDocument
from pymongo.database import Database

from app.utils.mongo import get_object_id

STATUSES = {"new", "contacted", "quoted", "closed"}


def _to_dict(doc: dict) -> dict:
    return {
        "id":           str(doc["_id"]),
        "companyName":  doc.get("company_name"),
        "contactName":  doc["contact_name"],
        "email":        doc["email"],
        "phone":        doc["phone"],
        "items":        doc.get("items", []),
        "message":      doc.get("message"),
        "status":       doc.get("status", "new"),
        "adminNotes":   doc.get("admin_notes"),
        "createdAt":    doc["created_at"].isoformat(),
        "updatedAt":    doc["updated_at"].isoformat(),
    }


def create_request(db: Database, payload: dict) -> dict:
    items = payload.get("items") or []
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one item is required.")

    now = datetime.now(timezone.utc)
    doc = {
        "company_name":  (payload.get("company_name") or "").strip() or None,
        "contact_name":  payload["contact_name"].strip(),
        "email":         payload["email"].lower().strip(),
        "phone":         payload["phone"].strip(),
        "items":         [
            {"productName": i.get("productName", "").strip(), "quantity": int(i.get("quantity", 0))}
            for i in items
        ],
        "message":       (payload.get("message") or "").strip() or None,
        "status":        "new",
        "admin_notes":   None,
        "created_at":    now,
        "updated_at":    now,
    }
    result = db.bulk_order_requests.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"success": True, "data": _to_dict(doc)}


def admin_list_requests(db: Database, status_filter: str = None, page: int = 1, limit: int = 20) -> dict:
    query = {}
    if status_filter:
        query["status"] = status_filter

    total = db.bulk_order_requests.count_documents(query)
    docs = list(
        db.bulk_order_requests.find(query)
        .sort([("created_at", -1)])
        .skip((page - 1) * limit)
        .limit(limit)
    )
    return {
        "success": True,
        "data": [_to_dict(d) for d in docs],
        "total": total,
        "page": page,
        "limit": limit,
    }


def admin_update_request(db: Database, request_id: str, payload: dict) -> dict:
    oid = get_object_id(request_id, "request")

    update = {"updated_at": datetime.now(timezone.utc)}
    if "status" in payload:
        new_status = payload["status"]
        if new_status not in STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"status must be one of: {', '.join(STATUSES)}")
        update["status"] = new_status
    if "admin_notes" in payload:
        update["admin_notes"] = payload["admin_notes"]

    result = db.bulk_order_requests.find_one_and_update(
        {"_id": oid}, {"$set": update}, return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    return {"success": True, "data": _to_dict(result)}
