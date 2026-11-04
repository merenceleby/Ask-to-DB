"""
FastAPI app entrypoint. The actual endpoint logic lives in routers/:
  - routers/auth.py   -> POST /auth/login
  - routers/ask.py    -> POST /ask               (requires login)
  - routers/admin.py  -> /admin/*                (requires is_admin)
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.db.connection import get_engine
from app.db.schema import init_db
from app.middleware.rate_limit import limiter
from app.routers import admin, ask, auth, metadata, workspace
from app.security.sql_validator import UnsafeSQLError


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Creates tables if they don't exist yet. Does NOT seed demo data —
    # that's now a deliberate admin action (POST /admin/demo/seed).
    init_db(get_engine())
    yield


app = FastAPI(title="SQL AI Assistant", lifespan=lifespan)

app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins.split(","),
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(ask.router)
app.include_router(admin.router)
app.include_router(metadata.router)
app.include_router(workspace.router)


@app.exception_handler(RateLimitExceeded)
def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Please slow down."})


@app.exception_handler(UnsafeSQLError)
def _unsafe_sql_handler(request: Request, exc: UnsafeSQLError):
    return JSONResponse(status_code=400, content={"detail": f"Rejected unsafe SQL: {exc}"})


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
