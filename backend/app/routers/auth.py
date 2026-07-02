"""
Auth router — HTTP layer only.

Rules:
  - Routes are plain `def` (not async def) so FastAPI runs them in a thread pool,
    keeping synchronous PyMongo calls off the event loop.
  - No business logic here — delegate everything to auth_service.
  - No MongoDB access here — only service calls.
  - Return Pydantic models; FastAPI serialises them to JSON automatically.
"""

from fastapi import APIRouter, Depends, status
from pymongo.database import Database

from app.dependencies import get_db, get_current_user
from app.models.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    RefreshTokenRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new customer account",
)
def register(payload: UserCreate, db: Database = Depends(get_db)):
    return auth_service.register_user(db, payload)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email and password",
)
def login(payload: UserLogin, db: Database = Depends(get_db)):
    return auth_service.login_user(db, payload)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate refresh token and issue a new access token",
)
def refresh(payload: RefreshTokenRequest, db: Database = Depends(get_db)):
    return auth_service.refresh_access_token(db, payload.refresh_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Invalidate the current refresh token (logout)",
)
def logout(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    auth_service.logout_user(db, str(current_user["_id"]))


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the currently authenticated user",
)
def get_me(current_user: dict = Depends(get_current_user)):
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
def forgot_password(payload: ForgotPasswordRequest, db: Database = Depends(get_db)):
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
def reset_password(payload: ResetPasswordRequest, db: Database = Depends(get_db)):
    auth_service.reset_password(db, payload.token, payload.new_password)
    return {"message": "Password updated successfully. Please log in with your new password."}
