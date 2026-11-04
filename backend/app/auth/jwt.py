"""
Session tokens adapter (replaces previous PyJWT implementation).
"""
from app.auth.tokens import (
    create_access_token,
    get_user_from_token,
    delete_session_token,
)

# For backward compatibility if any test or module calls decode_access_token
def decode_access_token(token: str) -> dict:
    user = get_user_from_token(token)
    if not user:
        raise ValueError("Invalid session token")
    return {
        "sub": user["username"],
        "user_id": user["id"],
        "is_admin": user["is_admin"],
    }
