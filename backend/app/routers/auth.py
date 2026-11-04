from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func

from app.auth.dependencies import oauth2_scheme
from app.auth.tokens import create_access_token, delete_session_token
from app.auth.security import verify_password
from app.db.connection import get_engine
from app.db.models import users

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_admin: bool


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    engine = get_engine()
    clean_username = body.username.strip().lower()
    clean_password = body.password.strip()
    with engine.connect() as conn:
        row = conn.execute(
            select(users).where(func.lower(users.c.username) == clean_username)
        ).first()

    if row is None or not (verify_password(body.password, row.hashed_password) or verify_password(clean_password, row.hashed_password)):
        # Same error for "no such user" and "wrong password" — don't leak
        # which one it was, that would help someone enumerate usernames.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
        )

    token = create_access_token(row.username, row.is_admin, user_id=row.id)
    return LoginResponse(access_token=token, is_admin=row.is_admin)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: str | None = Depends(oauth2_scheme)):
    if token:
        delete_session_token(token)

