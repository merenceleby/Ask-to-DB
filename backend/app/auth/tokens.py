"""
Lightweight database-backed session tokens.
Replaces JWT with simple, random, cryptographically secure tokens.
Tokens are cached in memory for zero-latency lookups and persisted to the
database `sessions` table so active logins survive backend restarts.
"""
import secrets
from typing import Any
from sqlalchemy import delete, insert, select
from sqlalchemy.engine import Engine

from app.db.connection import get_engine
from app.db.models import sessions, users

# Fast in-memory cache of active sessions: {token: {"id": int, "username": str, "is_admin": bool}}
_ACTIVE_SESSIONS: dict[str, dict[str, Any]] = {}


def create_access_token(
    username: str,
    is_admin: bool,
    user_id: int | None = None,
    engine: Engine | None = None,
) -> str:
    """
    Generates a secure random session token, caches it in memory,
    and persists it to the database sessions table.
    """
    token = secrets.token_urlsafe(32)

    # Determine user_id if not supplied
    resolved_id = user_id
    eng = engine
    if eng is None:
        try:
            eng = get_engine()
        except Exception:
            eng = None

    if resolved_id is None and eng is not None:
        try:
            with eng.connect() as conn:
                row = conn.execute(
                    select(users.c.id).where(users.c.username == username)
                ).first()
                if row:
                    resolved_id = row.id
        except Exception:
            pass

    if resolved_id is None:
        resolved_id = 1

    session_payload = {
        "id": resolved_id,
        "username": username,
        "is_admin": bool(is_admin),
    }

    # Cache immediately in memory
    _ACTIVE_SESSIONS[token] = session_payload

    # Persist in DB if available
    if eng is not None:
        try:
            with eng.begin() as conn:
                conn.execute(
                    insert(sessions).values(
                        token=token,
                        user_id=resolved_id,
                    )
                )
        except Exception:
            # If DB isn't reachable or table doesn't exist yet, in-memory cache still works
            pass

    return token


def get_user_from_token(token: str, engine: Engine | None = None) -> dict[str, Any] | None:
    """
    Validates a session token. Checks memory cache first; on cache miss
    (e.g. after a backend restart), checks the database `sessions` table.
    """
    if not token:
        return None

    # Check memory cache
    if token in _ACTIVE_SESSIONS:
        return _ACTIVE_SESSIONS[token]

    # Check database
    eng = engine
    if eng is None:
        try:
            eng = get_engine()
        except Exception:
            eng = None

    if eng is None:
        return None

    try:
        with eng.connect() as conn:
            stmt = (
                select(
                    users.c.id,
                    users.c.username,
                    users.c.is_admin,
                )
                .select_from(sessions.join(users, sessions.c.user_id == users.c.id))
                .where(sessions.c.token == token)
            )
            row = conn.execute(stmt).first()
            if row:
                user_info = {
                    "id": row.id,
                    "username": row.username,
                    "is_admin": bool(row.is_admin),
                }
                _ACTIVE_SESSIONS[token] = user_info
                return user_info
    except Exception:
        pass

    return None


def delete_session_token(token: str, engine: Engine | None = None) -> None:
    """
    Invalidates a session token from both memory cache and the database.
    """
    _ACTIVE_SESSIONS.pop(token, None)

    eng = engine
    if eng is None:
        try:
            eng = get_engine()
        except Exception:
            eng = None

    if eng is not None:
        try:
            with eng.begin() as conn:
                conn.execute(delete(sessions).where(sessions.c.token == token))
        except Exception:
            pass


def clear_user_sessions(user_id: int, engine: Engine | None = None) -> None:
    """
    Invalidates all sessions for a user (e.g. when the user is deleted).
    """
    to_delete = [
        tok for tok, u in _ACTIVE_SESSIONS.items() if u.get("id") == user_id
    ]
    for tok in to_delete:
        _ACTIVE_SESSIONS.pop(tok, None)

    eng = engine
    if eng is None:
        try:
            eng = get_engine()
        except Exception:
            eng = None

    if eng is not None:
        try:
            with eng.begin() as conn:
                conn.execute(delete(sessions).where(sessions.c.user_id == user_id))
        except Exception:
            pass

