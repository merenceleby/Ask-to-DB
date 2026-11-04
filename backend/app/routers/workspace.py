from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, insert, update as sa_update, delete as sa_delete

from app.auth.dependencies import get_current_user
from app.db import dynamic
from app.db.connection import get_engine
from app.db.models import table_metadata, app_settings

router = APIRouter(prefix="/workspace", tags=["workspace"], dependencies=[Depends(get_current_user)])


class ColumnDef(BaseModel):
    name: str
    type: str
    nullable: bool = True


class CreateWorkspaceTableRequest(BaseModel):
    table_name: str
    description: str
    columns: list[ColumnDef]
    sample_questions: list[str] = []


class UpdateDbSettingsRequest(BaseModel):
    db_title: str
    db_description: str


def _get_table_or_404(table_name: str):
    try:
        return dynamic.get_reflected_table(get_engine(), table_name)
    except dynamic.SchemaError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


def _check_table_access(table_name: str, user: dict, require_owner: bool = False) -> dict:
    """Verifies that the user has access to their personal table."""
    engine = get_engine()
    with engine.connect() as conn:
        meta = conn.execute(
            select(table_metadata).where(table_metadata.c.table_name == table_name)
        ).first()

    # If it's a legacy or starter table without metadata
    if meta is None:
        if require_owner and not user.get("is_admin", False):
            raise HTTPException(status_code=403, detail="Yalnızca yöneticiler bu tabloyu düzenleyebilir.")
        if not user.get("is_admin", False):
            raise HTTPException(status_code=403, detail="Bu tabloya erişim yetkiniz yok.")
        return {"created_by_user_id": None}

    is_owner = (user.get("id") is not None and meta.created_by_user_id == user.get("id")) or user.get("is_admin", False)

    if not is_owner:
        raise HTTPException(status_code=403, detail="Bu tabloya erişim izniniz yok. Yalnızca tablonun sahibi işlem yapabilir.")

    return dict(meta._mapping)


@router.get("/tables")
def list_my_tables(user: dict = Depends(get_current_user)) -> list[str]:
    """Lists all accessible tables for the current logged-in user."""
    engine = get_engine()
    return dynamic.list_accessible_business_tables(
        engine,
        user_id=user.get("id"),
        is_admin=user.get("is_admin", False),
    )


@router.post("/tables", status_code=status.HTTP_201_CREATED)
def create_my_table(
    body: CreateWorkspaceTableRequest,
    user: dict = Depends(get_current_user),
) -> dict:
    """Creates a new table owned by the current user."""
    try:
        dynamic.create_table(
            get_engine(),
            body.table_name,
            [c.model_dump() for c in body.columns],
            description=body.description,
            sample_questions=body.sample_questions,
            created_by_user_id=user.get("id"),
        )
    except dynamic.SchemaError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"detail": f"'{body.table_name}' tablosu oluşturuldu."}


@router.put("/settings")
def update_db_settings(
    body: UpdateDbSettingsRequest,
    user: dict = Depends(get_current_user),
) -> dict:
    """Updates general database title and description. Accessible to any user in their workspace."""
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(
            sa_delete(app_settings).where(app_settings.c.key.in_(["db_title", "db_description"]))
        )
        conn.execute(
            insert(app_settings),
            [
                {"key": "db_title", "value": body.db_title.strip()},
                {"key": "db_description", "value": body.db_description.strip()},
            ],
        )
    return {"detail": "Veritabanı bilgileri güncellendi."}


@router.delete("/tables/{table_name}")
def delete_my_table(
    table_name: str,
    user: dict = Depends(get_current_user),
) -> dict:
    """Drops the table. Only the owner or an admin can drop it."""
    _check_table_access(table_name, user, require_owner=True)
    try:
        dynamic.drop_table(get_engine(), table_name)
    except dynamic.SchemaError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"detail": f"'{table_name}' tablosu silindi."}


@router.get("/tables/{table_name}/rows")
def get_table_rows(
    table_name: str,
    user: dict = Depends(get_current_user),
) -> list[dict]:
    """Inspects rows of an accessible table."""
    _check_table_access(table_name, user, require_owner=False)
    table = _get_table_or_404(table_name)
    engine = get_engine()
    with engine.connect() as conn:
        rows = conn.execute(select(table).limit(500)).all()
    return [dict(row._mapping) for row in rows]


@router.post("/tables/{table_name}/rows", status_code=status.HTTP_201_CREATED)
def insert_table_row(
    table_name: str,
    body: dict[str, Any],
    user: dict = Depends(get_current_user),
) -> dict:
    """Inserts a new row. Only the owner or admin can insert data."""
    _check_table_access(table_name, user, require_owner=True)
    table = _get_table_or_404(table_name)
    valid_columns = set(table.columns.keys())
    values = {k: v for k, v in body.items() if k in valid_columns and k != "id"}

    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(insert(table).values(**values))
    return {"detail": "Satır başarıyla eklendi."}

