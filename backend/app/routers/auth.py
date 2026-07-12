"""
Auth router — HTTP layer only.

Rules:
  - Routes are plain `def` (not async def) so FastAPI runs them in a thread pool,
    keeping synchronous PyMongo calls off the event loop.
  - No business logic here — delegate everything to auth_service.
  - No MongoDB access here — only service calls.
  - Return Pydantic models; FastAPI serialises them to JSON automatically.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.dependencies import get_db, get_current_user
from app.limiter import limiter
from app.models.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    RefreshTokenRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.models.base import utcnow
from app.services import auth_service
from app.utils.security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new customer account",
)
@limiter.limit("10/minute")
def register(request: Request, payload: UserCreate, db: Database = Depends(get_db)):
    return auth_service.register_user(db, payload)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email and password",
)
@limiter.limit("5/minute")
def login(request: Request, payload: UserLogin, db: Database = Depends(get_db)):
    return auth_service.login_user(db, payload)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate refresh token and issue a new access token",
)
@limiter.limit("20/minute")
def refresh(request: Request, payload: RefreshTokenRequest, db: Database = Depends(get_db)):
    return auth_service.refresh_access_token(db, payload.refresh_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Invalidate the current refresh token (logout)",
)
@limiter.limit("20/minute")
def logout(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    auth_service.logout_user(db, str(current_user["_id"]))


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the currently authenticated user",
)
@limiter.limit("30/minute")
def get_me(request: Request, current_user: dict = Depends(get_current_user)):
    """
    Returns the logged-in user's profile.
    The `get_current_user` dependency validates the JWT and fetches from DB.
    This route just converts the raw dict to a safe UserResponse.
    """
    from app.services.auth_service import _user_to_response
    return _user_to_response(current_user)


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    summary="Request a password reset email",
)
@limiter.limit("3/minute")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Database = Depends(get_db)):
    """
    Always returns 200 — even if the email doesn't exist.
    This prevents email enumeration attacks.
    """
    auth_service.request_password_reset(db, payload.email)
    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Set a new password using a reset token",
)
@limiter.limit("10/minute")
def reset_password(request: Request, payload: ResetPasswordRequest, db: Database = Depends(get_db)):
    auth_service.reset_password(db, payload.token, payload.new_password)
    return {"message": "Password updated successfully. Please log in with your new password."}


@router.post(
    "/verify-email",
    status_code=status.HTTP_200_OK,
    summary="Confirm an account's email using the link sent at registration",
)
@limiter.limit("10/minute")
def verify_email(request: Request, payload: VerifyEmailRequest, db: Database = Depends(get_db)):
    auth_service.verify_email(db, payload.token)
    return {"message": "Email verified successfully."}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change password while logged in",
)
@limiter.limit("5/minute")
def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": utcnow()}},
    )
    return {"message": "Password changed successfully."}
