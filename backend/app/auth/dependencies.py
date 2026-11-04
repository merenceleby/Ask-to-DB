"""
Two dependencies, used to protect endpoints:

  Depends(get_current_user)  -> any logged-in user (used by /ask, /workspace, /metadata)
  Depends(require_admin)     -> only users with is_admin=True (used by /admin/*)
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.auth.tokens import get_user_from_token

# tokenUrl is only used to populate Swagger's "Authorize" button —
# our actual /auth/login endpoint accepts JSON, not a login form.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Log in via /auth/login first.",
        )
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
        )
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )
    return user
