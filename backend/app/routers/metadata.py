import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from app.auth.dependencies import get_current_user
from app.db.connection import get_engine
from app.db.dynamic import get_reflected_table, list_business_tables, list_accessible_business_tables
from app.db.models import app_settings, table_metadata

router = APIRouter(prefix="/metadata", tags=["metadata"])


class ColumnInfo(BaseModel):
    name: str
    type: str
    nullable: bool = True
    primary_key: bool = False


class TableMetaOut(BaseModel):
    name: str
    description: str
    columns: list[ColumnInfo]
    sample_questions: list[str]
    created_by_user_id: int | None = None
    is_owner: bool = False


class DbSummaryOut(BaseModel):
    db_title: str
    db_description: str
    tables: list[TableMetaOut]


@router.get("/summary", response_model=DbSummaryOut)
def get_db_summary(user: dict = Depends(get_current_user)) -> DbSummaryOut:
    engine = get_engine()
    title = "SQL Database"
    desc = "Relational database managed by Ask to DB: SQL AI Assistant"

    with engine.connect() as conn:
        try:
            settings_rows = conn.execute(select(app_settings.c.key, app_settings.c.value)).all()
            s_dict = {r.key: r.value for r in settings_rows}
            if "db_title" in s_dict:
                title = s_dict["db_title"]
            if "db_description" in s_dict:
                desc = s_dict["db_description"]
        except Exception:
            pass

        meta_dict = {}
        try:
            meta_rows = conn.execute(select(table_metadata)).all()
            meta_dict = {
                r.table_name: {
                    "description": r.description,
                    "sample_questions": json.loads(r.sample_questions) if r.sample_questions else [],
                    "created_by_user_id": getattr(r, "created_by_user_id", None),
                }
                for r in meta_rows
            }
        except Exception:
            pass

    table_names = list_accessible_business_tables(
        engine,
        user_id=user.get("id"),
        is_admin=user.get("is_admin", False),
    )
    tables_out = []
    current_uid = user.get("id")
    for t_name in table_names:
        try:
            t_obj = get_reflected_table(engine, t_name)
            cols = [
                ColumnInfo(
                    name=c.name,
                    type=str(c.type),
                    nullable=bool(c.nullable),
                    primary_key=bool(c.primary_key),
                )
                for c in t_obj.columns
            ]
        except Exception:
            cols = []

        t_meta = meta_dict.get(
            t_name,
            {
                "description": "No description provided.",
                "sample_questions": [],
                "created_by_user_id": None,
            },
        )
        owner_id = t_meta.get("created_by_user_id")
        is_owner = (current_uid is not None and owner_id == current_uid) or user.get("is_admin", False)

        tables_out.append(
            TableMetaOut(
                name=t_name,
                description=t_meta["description"],
                columns=cols,
                sample_questions=t_meta["sample_questions"],
                created_by_user_id=owner_id,
                is_owner=bool(is_owner),
            )
        )

    return DbSummaryOut(db_title=title, db_description=desc, tables=tables_out)

