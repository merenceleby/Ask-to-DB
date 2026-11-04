from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text

from app.auth.dependencies import get_current_user
from app.config import settings
from app.db.connection import get_engine
from app.db.schema import get_schema_description
from app.llm.client import generate_answer, generate_sql
from app.middleware.rate_limit import limiter
from app.security.sql_validator import validate_and_sanitize_sql

router = APIRouter(tags=["ask"])


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    sql: str
    rows: list[dict]


@router.post("/ask", response_model=AskResponse)
@limiter.limit(settings.rate_limit)
def ask(
    request: Request,
    body: AskRequest,
    user: dict = Depends(get_current_user),  # any logged-in user, admin or not
) -> AskResponse:
    engine = get_engine()
    schema = get_schema_description(
        engine,
        user_id=user.get("id"),
        is_admin=user.get("is_admin", False),
    )

    if not schema:
        raise HTTPException(
            status_code=400,
            detail=(
                "Henüz erişebileceğiniz bir tablo bulunmuyor. "
                "Lütfen önce 'Çalışma Alanı' (Workspace) bölümünden bir tablo oluşturun veya yönetici ile iletişime geçin."
            ),
        )

    try:
        raw_sql = generate_sql(body.question, schema)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Yapay zeka modeli yanıt veremedi ({exc}). Lütfen tekrar deneyin.",
        )

    safe_sql = validate_and_sanitize_sql(raw_sql, max_rows=settings.sql_max_rows)

    try:
        with engine.connect() as conn:
            result = conn.execute(text(safe_sql))
            rows = [dict(row._mapping) for row in result]
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Üretilen SQL sorgusu çalıştırılırken veritabanı hatası oluştu: {exc}",
        )

    try:
        answer = generate_answer(body.question, safe_sql, rows)
    except Exception:
        answer = f"Sorgu başarıyla çalıştırıldı ve {len(rows)} satır sonuç bulundu."

    return AskResponse(answer=answer, sql=safe_sql, rows=rows)

