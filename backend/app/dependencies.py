"""
FastAPI dependency functions — injected into route handlers via Depends().

Hierarchy:
  get_db            → raw MongoDB database handle (any route that touches DB)
  get_current_user  → authenticated user (protected routes)
  require_admin     → admin-only routes (builds on get_current_user)
  get_optional_user → routes that work for both guests and logged-in users
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from pymongo.database import Database

from app.database import get_database
from app.utils.security import decode_access_token

# tokenUrl="/auth/login" tells Swagger UI where to POST credentials
# so the "Authorize" padlock button works in /docs
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_db() -> Database:
    """Provide the active MongoDB database handle to route handlers."""
    return get_database()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Database = Depends(get_db),
) -> dict:
    """
    Validate the JWT Bearer token and return the user's MongoDB document.

    Used as a dependency on any route that requires authentication:
      @router.get("/orders")
      def list_orders(user: dict = Depends(get_current_user)):
          ...

    Why fetch from DB instead of trusting the JWT payload?
    The JWT payload is frozen at issuance. If an admin revokes a user's
    account 5 minutes after login, the JWT still claims they're active.
    Fetching from DB on every request ensures we get the current state.
    Trade-off: one extra DB read per request.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_error
    except JWTError:
        raise credentials_error

    from app.services.auth_service import get_user_by_id
    return get_user_by_id(db, user_id)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Extend get_current_user — additionally requires role == 'admin'.

    Used on all /admin/* routes:
      @router.get("/admin/orders")
      def admin_list_orders(user: dict = Depends(require_admin)):
          ...
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


def get_optional_user(
    token: str | None = Depends(oauth2_scheme_optional),
    db: Database = Depends(get_db),
) -> dict | None:
    """
    Return the user document if a valid token is present, else None.

    Used on routes that behave differently for guests vs logged-in users:
      - Product listing: anyone can see products, but logged-in users see wishlist state
      - Reviews: anyone can read, only logged-in can submit
    """
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None

    from app.services.auth_service import get_user_by_id
    try:
        return get_user_by_id(db, user_id)
    except HTTPException:
        return None
