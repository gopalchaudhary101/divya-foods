"""
User collection schema.

Roles:
  customer — regular buyer
  admin    — full platform access

Separation of concerns:
  UserCreate       → what the registration form sends
  UserLogin        → what the login form sends
  UserInDB         → the full document stored in MongoDB (includes password_hash)
  UserResponse     → what the API returns (NO password_hash ever leaves the server)
  UserUpdate       → what /users/profile PATCH accepts
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.base import MongoBaseModel, utcnow


# ─── Request Schemas ──────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., pattern=r"^\+?[0-9]{10,15}$")
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, pattern=r"^\+?[0-9]{10,15}$")
    avatar: Optional[str] = None
    date_of_birth: Optional[str] = None   # "YYYY-MM-DD" — only month/day are used, for birthday rewards


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class VerifyEmailRequest(BaseModel):
    token: str


# ─── Database Schema ──────────────────────────────────────────────────────────

class UserInDB(MongoBaseModel):
    """The full user document as it lives in MongoDB."""
    name: str
    email: str
    phone: Optional[str] = None
    password_hash: str                      # bcrypt hash — never expose this
    role: str = "customer"                  # "customer" | "admin" | "developer"
    avatar: Optional[str] = None            # Cloudinary URL
    is_active: bool = True
    is_email_verified: bool = False
    refresh_token: Optional[str] = None     # hashed refresh token for rotation
    reset_token: Optional[str] = None       # one-time password reset token
    reset_token_expires: Optional[datetime] = None
    date_of_birth: Optional[str] = None     # "YYYY-MM-DD" — used only for birthday loyalty bonuses
    bonus_points: int = 0                   # one-off loyalty point grants (e.g. birthday bonus)
    last_birthday_reward_year: Optional[int] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


# ─── Response Schema ──────────────────────────────────────────────────────────

class UserResponse(MongoBaseModel):
    """Returned by the API — sensitive fields are excluded."""
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    avatar: Optional[str] = None
    is_email_verified: bool
    date_of_birth: Optional[str] = None
    created_at: datetime


# ─── Token Schemas ────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str
