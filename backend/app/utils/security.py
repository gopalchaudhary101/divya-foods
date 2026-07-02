"""
Pure cryptographic utility functions — no database access, no FastAPI imports.

Every function here is a deterministic transformation:
  input → output  (with no side effects)

This makes them trivially unit-testable and easy to reason about.
"""

import hashlib
import secrets
from datetime import datetime, timezone, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

# bcrypt context — passlib handles the salt automatically
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Password hashing ─────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Return a bcrypt hash of the plaintext password."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches the stored bcrypt hash."""
    return _pwd_context.verify(plain, hashed)


# ─── JWT access tokens ────────────────────────────────────────────────────────

def create_access_token(user_id: str, email: str, role: str) -> str:
    """
    Create a signed JWT access token.

    Payload:
      sub   → user's MongoDB _id (string)  — "subject" (standard JWT claim)
      email → used for logging / debugging
      role  → "customer" | "admin"
      exp   → expiry timestamp

    The token is signed with JWT_SECRET_KEY using HS256.
    Anyone who intercepts it can READ the payload (it's base64, not encrypted).
    But they cannot FORGE a new token without knowing the secret key.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.

    Raises JWTError on:
      - Invalid signature
      - Expired token
      - Malformed token

    The caller (get_current_user) should catch JWTError and raise HTTP 401.
    """
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


# ─── Refresh tokens ───────────────────────────────────────────────────────────

def generate_refresh_token() -> str:
    """
    Generate a cryptographically random 64-character hex string.

    Why NOT a JWT for refresh tokens?
    JWTs are stateless — once issued, they're valid until expiry.
    You cannot revoke a JWT without maintaining a server-side blacklist.

    A random token stored in MongoDB can be revoked instantly:
    just delete the hash from the user's document.
    On logout → clear it. On compromise → clear it. Dead immediately.
    """
    return secrets.token_hex(32)  # 32 bytes → 64 hex chars


def hash_refresh_token(token: str) -> str:
    """
    SHA-256 hash the refresh token before storing in MongoDB.

    If an attacker dumps the database, they get SHA-256 hashes.
    SHA-256 of a 64-char random token is computationally infeasible to reverse.
    The real token only ever exists in memory and in the client's localStorage.
    """
    return hashlib.sha256(token.encode()).hexdigest()


def verify_refresh_token(plain_token: str, stored_hash: str) -> bool:
    """Return True if SHA-256(plain_token) matches the stored hash."""
    return hash_refresh_token(plain_token) == stored_hash


# ─── Password reset tokens ────────────────────────────────────────────────────

def generate_reset_token() -> str:
    """Generate a one-time password reset token (URL-safe, 43 chars)."""
    return secrets.token_urlsafe(32)
