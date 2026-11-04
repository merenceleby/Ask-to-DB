"""
Everything in this router requires an admin session token (see require_admin).

Three groups of endpoints:
  1. /admin/users        - create/list/delete login accounts (you asked
                           for "only I create accounts", so there is
                           deliberately NO public signup endpoint)
  2. /admin/demo         - "Create Demo Data" / "Delete Demo Data" buttons
  3. /admin/tables/{...} - generic CRUD browser for the business tables
                           (authors, books, customers, orders, order_items)
                           — NEVER for `users`, see db/models.py comment.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import insert, select, update, delete as sa_delete

from app.auth.dependencies import require_admin
from app.auth.security import hash_password
from app.auth.tokens import clear_user_sessions
from app.db import dynamic
from app.db.connection import get_engine
from app.db.models import users
from app.db.schema import reset_demo_data, seed_demo_data

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---------- User management ----------

class CreateUserRequest(BaseModel):
    username: str
    password: str
    is_admin: bool = False


class UserOut(BaseModel):
    id: int
    username: str
    is_admin: bool


@router.get("/users", response_model=list[UserOut])
def list_users() -> list[UserOut]:
    engine = get_engine()
    with engine.connect() as conn:
        rows = conn.execute(select(users.c.id, users.c.username, users.c.is_admin)).all()
    return [UserOut(id=r.id, username=r.username, is_admin=r.is_admin) for r in rows]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: CreateUserRequest) -> UserOut:
    engine = get_engine()
    with engine.begin() as conn:
        existing = conn.execute(
            select(users.c.id).where(users.c.username == body.username)
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Username already exists.")

        result = conn.execute(
            insert(users).values(
                username=body.username,
                hashed_password=hash_password(body.password),
                is_admin=body.is_admin,
            )
        )
        new_id = result.inserted_primary_key[0]
    return UserOut(id=new_id, username=body.username, is_admin=body.is_admin)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, current_admin: dict = Depends(require_admin)):
    engine = get_engine()
    with engine.begin() as conn:
        row = conn.execute(select(users.c.username).where(users.c.id == user_id)).first()
        if row is None:
            raise HTTPException(status_code=404, detail="User not found.")
        if row.username == current_admin["username"]:
            raise HTTPException(status_code=400, detail="You cannot delete your own account.")
        conn.execute(sa_delete(users).where(users.c.id == user_id))
    clear_user_sessions(user_id, engine)


# ---------- Demo data ----------

@router.post("/demo/seed")
def create_demo_data():
    seed_demo_data(get_engine())
    return {"detail": "Demo data created."}


@router.post("/demo/reset")
def delete_demo_data():
    reset_demo_data(get_engine())
    return {"detail": "Demo data deleted."}


# ---------- Schema management (create/drop real tables at runtime) ----------

class ColumnDef(BaseModel):
    name: str
    type: str
    nullable: bool = True


class CreateTableRequest(BaseModel):
    table_name: str
    description: str
    columns: list[ColumnDef]
    sample_questions: list[str] = []


class UpdateDbSettingsRequest(BaseModel):
    db_title: str
    db_description: str


class UpdateTableMetadataRequest(BaseModel):
    description: str
    sample_questions: list[str] = []


@router.put("/metadata/settings")
def update_db_settings(body: UpdateDbSettingsRequest) -> dict:
    from app.db.models import app_settings
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
    return {"detail": "Database settings updated."}


@router.post("/metadata/tables/{table_name}/generate-questions")
def regenerate_table_questions(table_name: str) -> dict:
    import json
    from app.llm.client import generate_sample_questions
    from app.db.models import table_metadata
    table = _get_table_or_404(table_name)
    engine = get_engine()

    with engine.connect() as conn:
        meta_row = conn.execute(
            select(table_metadata).where(table_metadata.c.table_name == table_name)
        ).first()

    desc = meta_row.description if meta_row else f"Table {table_name}"
    cols = [{"name": c.name, "type": str(c.type)} for c in table.columns if c.name != "id"]

    new_questions = generate_sample_questions(table_name, desc, cols)

    with engine.begin() as conn:
        conn.execute(
            sa_delete(table_metadata).where(table_metadata.c.table_name == table_name)
        )
        conn.execute(
            insert(table_metadata).values(
                table_name=table_name,
                description=desc,
                sample_questions=json.dumps(new_questions),
            )
        )
    return {"detail": "Questions generated successfully.", "sample_questions": new_questions}


@router.put("/metadata/tables/{table_name}")
def update_table_metadata(table_name: str, body: UpdateTableMetadataRequest) -> dict:
    import json
    from app.db.models import table_metadata
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(
            sa_delete(table_metadata).where(table_metadata.c.table_name == table_name)
        )
        conn.execute(
            insert(table_metadata).values(
                table_name=table_name,
                description=body.description.strip(),
                sample_questions=json.dumps(body.sample_questions),
            )
        )
    return {"detail": f"Metadata for '{table_name}' updated."}


@router.get("/schema/column-types")
def get_column_types() -> list[str]:
    return list(dynamic.ALLOWED_COLUMN_TYPES.keys())


@router.post("/schema/tables", status_code=status.HTTP_201_CREATED)
def create_table(body: CreateTableRequest) -> dict:
    try:
        dynamic.create_table(
            get_engine(),
            body.table_name,
            [c.model_dump() for c in body.columns],
            description=body.description,
            sample_questions=body.sample_questions,
        )
    except dynamic.SchemaError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"detail": f"Table '{body.table_name}' created."}


@router.delete("/schema/tables/{table_name}")
def drop_table(table_name: str) -> dict:
    try:
        dynamic.drop_table(get_engine(), table_name)
    except dynamic.SchemaError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"detail": f"Table '{table_name}' dropped."}


# ---------- Generic CRUD for business tables ----------

def _get_table_or_404(table_name: str):
    try:
        return dynamic.get_reflected_table(get_engine(), table_name)
    except dynamic.SchemaError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/tables")
def list_tables() -> list[str]:
    return dynamic.list_business_tables(get_engine())


@router.get("/tables/{table_name}")
def list_rows(table_name: str) -> list[dict]:
    table = _get_table_or_404(table_name)
    engine = get_engine()
    with engine.connect() as conn:
        rows = conn.execute(select(table).limit(500)).all()
    return [dict(row._mapping) for row in rows]


@router.post("/tables/{table_name}", status_code=status.HTTP_201_CREATED)
def create_row(table_name: str, body: dict[str, Any]) -> dict:
    table = _get_table_or_404(table_name)
    # only accept known columns — ignores/rejects anything unexpected,
    # so a stray field in the request body can't do anything unintended
    valid_columns = set(table.columns.keys())
    values = {k: v for k, v in body.items() if k in valid_columns and k != "id"}

    engine = get_engine()
    with engine.begin() as conn:
        result = conn.execute(insert(table).values(**values))
        new_id = result.inserted_primary_key[0]
        row = conn.execute(select(table).where(table.c.id == new_id)).first()
    return dict(row._mapping)


@router.put("/tables/{table_name}/{row_id}")
def update_row(table_name: str, row_id: int, body: dict[str, Any]) -> dict:
    table = _get_table_or_404(table_name)
    valid_columns = set(table.columns.keys())
    values = {k: v for k, v in body.items() if k in valid_columns and k != "id"}

    if not values:
        raise HTTPException(status_code=400, detail="No valid columns to update.")

    engine = get_engine()
    with engine.begin() as conn:
        existing = conn.execute(select(table).where(table.c.id == row_id)).first()
        if existing is None:
            raise HTTPException(status_code=404, detail="Row not found.")
        conn.execute(update(table).where(table.c.id == row_id).values(**values))
        row = conn.execute(select(table).where(table.c.id == row_id)).first()
    return dict(row._mapping)


@router.delete("/tables/{table_name}/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_row(table_name: str, row_id: int):
    table = _get_table_or_404(table_name)
    engine = get_engine()
    with engine.begin() as conn:
        existing = conn.execute(select(table).where(table.c.id == row_id)).first()
        if existing is None:
            raise HTTPException(status_code=404, detail="Row not found.")
        conn.execute(sa_delete(table).where(table.c.id == row_id))
