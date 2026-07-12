"""
Authentication service — all business logic for user auth flows.

This layer:
  - Reads from and writes to MongoDB
  - Calls security utilities for crypto operations
  - Raises HTTPException for all error cases
  - Returns Pydantic response models (never raw dicts)

The router layer ONLY calls these functions. It never touches MongoDB directly.
"""

from datetime import datetime, timezone, timedelta

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.models.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
)
from app.models.base import utcnow
from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    generate_reset_token,
)
from app.services import email_service


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _user_to_response(user_doc: dict) -> UserResponse:
    """Convert a raw MongoDB document to a safe UserResponse model."""
    return UserResponse(
        _id=str(user_doc["_id"]),
        name=user_doc["name"],
        email=user_doc["email"],
        phone=user_doc.get("phone"),
        role=user_doc["role"],
        avatar=user_doc.get("avatar"),
        is_email_verified=user_doc.get("is_email_verified", False),
        date_of_birth=user_doc.get("date_of_birth"),
        created_at=user_doc["created_at"],
    )


def _build_token_response(user_doc: dict) -> TokenResponse:
    """Create both tokens and wrap them with the safe user response."""
    user_id = str(user_doc["_id"])
    access_token = create_access_token(
        user_id=user_id,
        email=user_doc["email"],
        role=user_doc["role"],
    )
    refresh_token = generate_refresh_token()
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,  # raw token goes to client
        user=_user_to_response(user_doc),
    ), hash_refresh_token(refresh_token)  # hashed version goes to DB


# ─── Register ─────────────────────────────────────────────────────────────────

def register_user(db: Database, payload: UserCreate) -> TokenResponse:
    """
    Create a new customer account.

    Steps:
    1. Check email is not already taken
    2. Hash the password (never store plaintext)
    3. Insert user document into MongoDB
    4. Issue access token + refresh token
    5. Store hashed refresh token in the new user's document
    """
    # Duplicate email is caught by the unique index we created in db_init.py
    # But we give a clearer error message than pymongo's default
    existing = db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    now = utcnow()
    verification_token = generate_reset_token()
    user_doc = {
        "name": payload.name.strip(),
        "email": payload.email.lower().strip(),
        "phone": payload.phone,
        "password_hash": hash_password(payload.password),
        "role": "customer",
        "avatar": None,
        "is_active": True,
        "is_email_verified": False,
        "refresh_token": None,
        "reset_token": None,
        "reset_token_expires": None,
        "email_verification_token": verification_token,
        "email_verification_token_expires": now + timedelta(hours=24),
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = db.users.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user_doc["_id"] = result.inserted_id
    token_response, hashed_rt = _build_token_response(user_doc)

    # Store the hashed refresh token so we can validate it on /auth/refresh
    db.users.update_one(
        {"_id": result.inserted_id},
        {"$set": {"refresh_token": hashed_rt}},
    )

    email_service.welcome(user_doc["name"], user_doc["email"])
    email_service.verify_email_request(user_doc["name"], user_doc["email"], verification_token)

    return token_response


# ─── Login ────────────────────────────────────────────────────────────────────

def login_user(db: Database, payload: UserLogin) -> TokenResponse:
    """
    Authenticate with email + password.

    Security note: we always run bcrypt.verify() even when the user doesn't
    exist. This prevents timing attacks — an attacker measuring response time
    cannot tell whether the email exists in the database.
    """
    user_doc = db.users.find_one({"email": payload.email.lower()})

    # Run bcrypt regardless of whether user exists (timing-safe)
    password_to_check = user_doc["password_hash"] if user_doc else hash_password("dummy")
    password_valid = verify_password(payload.password, password_to_check)

    if not user_doc or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Contact support.",
        )

    token_response, hashed_rt = _build_token_response(user_doc)

    db.users.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"refresh_token": hashed_rt, "updated_at": utcnow()}},
    )

    return token_response


# ─── Token Refresh ────────────────────────────────────────────────────────────

def refresh_access_token(db: Database, incoming_refresh_token: str) -> TokenResponse:
    """
    Issue a new access token + rotate the refresh token.

    Rotation means: the old refresh token is invalidated and a new one is issued.
    If the old token is ever used again, it won't match the new hash → 401.
    This detects refresh token theft: the real user rotates it, the attacker's
    copy becomes invalid.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Find user whose stored hash matches this token
    incoming_hash = hash_refresh_token(incoming_refresh_token)
    user_doc = db.users.find_one({"refresh_token": incoming_hash})

    if not user_doc:
        raise credentials_error

    if not user_doc.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated.")

    token_response, new_hashed_rt = _build_token_response(user_doc)

    # Rotate: replace old hash with new hash
    db.users.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"refresh_token": new_hashed_rt, "updated_at": utcnow()}},
    )

    return token_response


# ─── Logout ───────────────────────────────────────────────────────────────────

def logout_user(db: Database, user_id: str) -> None:
    """
    Invalidate the refresh token server-side.

    After this, no one can use this user's refresh token — even if they have
    the raw token value. The access token is still valid for up to 15 minutes
    (that's the trade-off of stateless JWTs), but the attack window is tiny.
    """
    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"refresh_token": None, "updated_at": utcnow()}},
    )


# ─── Get Current User ─────────────────────────────────────────────────────────

def get_user_by_id(db: Database, user_id: str) -> dict:
    """
    Fetch a user document from MongoDB by their ID.
    Raises 401 if not found (used in the auth dependency — if the user was
    deleted after their JWT was issued, they should be logged out).
    """
    try:
        user_doc = db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated.",
        )

    return user_doc


# ─── Forgot Password ──────────────────────────────────────────────────────────

def request_password_reset(db: Database, email: str) -> None:
    """
    Generate a one-time reset token and store it.

    We always return HTTP 200 even if the email doesn't exist.
    This prevents email enumeration — an attacker can't tell whether
    salesdivyafoods@gmail.com has an account by probing this endpoint.

    The actual email-sending is wired up in Phase 13 (Email / SMTP).
    """
    user_doc = db.users.find_one({"email": email.lower()})
    if not user_doc:
        return  # silent — don't reveal the account doesn't exist

    reset_token = generate_reset_token()
    expires = datetime.now(timezone.utc) + timedelta(hours=1)

    db.users.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {
            "reset_token": reset_token,
            "reset_token_expires": expires,
            "updated_at": utcnow(),
        }},
    )

    email_service.password_reset(email, reset_token)


# ─── Reset Password ───────────────────────────────────────────────────────────

def reset_password(db: Database, token: str, new_password: str) -> None:
    """
    Apply a new password using the one-time reset token.

    The token is valid for 1 hour and is deleted after use.
    """
    now = datetime.now(timezone.utc)
    user_doc = db.users.find_one({
        "reset_token": token,
        "reset_token_expires": {"$gt": now},
    })

    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token is invalid or has expired.",
        )

    db.users.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {
            "password_hash": hash_password(new_password),
            "reset_token": None,
            "reset_token_expires": None,
            "refresh_token": None,   # force re-login on all devices
            "updated_at": utcnow(),
        }},
    )


# ─── Verify Email ─────────────────────────────────────────────────────────────

def verify_email(db: Database, token: str) -> None:
    """
    Mark the account as email-verified using the one-time link sent at
    registration. Purely informational — nothing in the app currently gates
    on is_email_verified, so an invalid/expired token just means the account
    stays unverified rather than blocking anything.
    """
    now = datetime.now(timezone.utc)
    user_doc = db.users.find_one({
        "email_verification_token": token,
        "email_verification_token_expires": {"$gt": now},
    })

    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid or has expired.",
        )

    db.users.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {
            "is_email_verified": True,
            "email_verification_token": None,
            "email_verification_token_expires": None,
            "updated_at": utcnow(),
        }},
    )
