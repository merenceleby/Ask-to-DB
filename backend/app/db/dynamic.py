"""
Lets an admin create and drop real Postgres tables at runtime, from
the Admin panel — not just CRUD rows in pre-defined tables.

Safety approach (this is the part that matters):
  - Table and column NAMES are validated against a strict regex before
    ever touching SQL. They're never string-formatted into raw SQL;
    SQLAlchemy's Table/Column objects (and its quoting) build the DDL.
  - Column TYPES are chosen from a fixed allowlist (ALLOWED_COLUMN_TYPES)
    — the user picks from a dropdown, they can't type in an arbitrary
    SQL type.
  - `users` and the 5 built-in business tables can never be dropped
    through this module — only tables an admin created this way can be
    removed again this way.
"""
import json
import re

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, MetaData, Numeric, Table, Text, inspect, select, delete
from sqlalchemy.engine import Engine

from app.db.models import table_metadata as table_meta_table

RESERVED_TABLE_NAMES = {"users", "sessions", "app_settings", "table_metadata"}

# `users` is the only table that can never be DROPPED through this
# module or the Admin panel — it's load-bearing for login itself.
PROTECTED_TABLES = RESERVED_TABLE_NAMES

# These 5 names belong to seed_demo_data() / reset_demo_data() (see
# db/schema.py). They CAN be dropped like any other table (that's what
# "Delete demo data" does), but they can NOT be CREATED through the
# generic "Create a new table" form — otherwise a custom table named
# e.g. "books" collides with the seeder's assumptions about what
# columns "books" has, and /ask ends up reading a half-custom,
# half-demo table and gets confused.
STARTER_TABLE_NAMES = {"authors", "books", "customers", "orders", "order_items"}

ALLOWED_COLUMN_TYPES = {
    "text": Text,
    "integer": Integer,
    "numeric": lambda: Numeric(12, 2),
    "boolean": Boolean,
    "date": Date,
    "timestamp": DateTime,
}

_IDENTIFIER_RE = re.compile(r"^[a-z][a-z0-9_]{1,62}$")


class SchemaError(ValueError):
    """Raised for any invalid table/column name or type."""


def _validate_identifier(name: str, kind: str) -> None:
    if not _IDENTIFIER_RE.match(name):
        raise SchemaError(
            f"Invalid {kind} name '{name}'. Use lowercase letters, numbers, "
            "and underscores only, starting with a letter."
        )


def list_business_tables(engine: Engine) -> list[str]:
    """All tables except `users` and system tables — the original 5 plus any created dynamically."""
    inspector = inspect(engine)
    return sorted(
        name for name in inspector.get_table_names() if name not in RESERVED_TABLE_NAMES
    )


def list_accessible_business_tables(engine: Engine, user_id: int | None = None, is_admin: bool = False) -> list[str]:
    """
    Returns only tables accessible to the user:
    - Tables created by the user (created_by_user_id == user_id)
    - If is_admin is True, can also see starter/demo tables with no owner
    """
    all_tables = list_business_tables(engine)
    if not all_tables:
        return []

    with engine.connect() as conn:
        try:
            # Query table_metadata for ownership
            rows = conn.execute(
                select(
                    table_meta_table.c.table_name,
                    table_meta_table.c.created_by_user_id,
                )
            ).all()
            meta_map = {r.table_name: r.created_by_user_id for r in rows}
        except Exception:
            return all_tables if is_admin else []

    accessible = []
    for t_name in all_tables:
        owner_id = meta_map.get(t_name)
        if owner_id is None:
            # Starter/demo tables without metadata or owner
            if is_admin:
                accessible.append(t_name)
        elif user_id is not None and owner_id == user_id:
            accessible.append(t_name)
        elif is_admin and owner_id is None:
            accessible.append(t_name)

    return sorted(accessible)


def get_reflected_table(engine: Engine, table_name: str) -> Table:
    """
    Reflects any existing, non-reserved table by name — works for both
    the 5 built-in tables and ones created dynamically, since neither
    needs a hardcoded Python definition to be usable here.
    """
    if table_name in RESERVED_TABLE_NAMES:
        raise SchemaError(f"Table '{table_name}' is not accessible.")

    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        raise SchemaError(f"Table '{table_name}' does not exist.")

    metadata = MetaData()
    return Table(table_name, metadata, autoload_with=engine)


def create_table(
    engine: Engine,
    table_name: str,
    columns: list[dict],
    description: str,
    sample_questions: list[str] | None = None,
    created_by_user_id: int | None = None,
) -> None:
    """
    columns: [{"name": "rating", "type": "integer", "nullable": true}, ...]
    Every table automatically gets an auto-incrementing `id` primary key.
    A non-empty description is mandatory for user guidance and LLM accuracy.
    """
    _validate_identifier(table_name, "table")
    if not description or not description.strip():
        raise SchemaError("Table description is required.")

    if table_name in PROTECTED_TABLES:
        raise SchemaError(f"'{table_name}' is a reserved name.")
    if table_name in STARTER_TABLE_NAMES:
        raise SchemaError(
            f"'{table_name}' is reserved for demo data. Use 'Create demo "
            "data' / 'Delete demo data' to manage it, or pick a different name."
        )

    inspector = inspect(engine)
    if table_name in inspector.get_table_names():
        raise SchemaError(f"Table '{table_name}' already exists.")

    if not columns:
        raise SchemaError("At least one column is required.")

    seen_names = {"id"}
    sa_columns = [Column("id", Integer, primary_key=True)]

    for col in columns:
        name = col.get("name", "")
        col_type = col.get("type", "")
        nullable = col.get("nullable", True)

        _validate_identifier(name, "column")
        if name in seen_names:
            raise SchemaError(f"Duplicate column name '{name}'.")
        seen_names.add(name)

        if col_type not in ALLOWED_COLUMN_TYPES:
            allowed = ", ".join(ALLOWED_COLUMN_TYPES)
            raise SchemaError(f"Unknown column type '{col_type}'. Allowed: {allowed}.")

        type_factory = ALLOWED_COLUMN_TYPES[col_type]
        sa_type = type_factory() if callable(type_factory) else type_factory
        sa_columns.append(Column(name, sa_type, nullable=nullable))

    metadata = MetaData()
    table = Table(table_name, metadata, *sa_columns)

    if not sample_questions:
        try:
            from app.llm.client import generate_sample_questions
            sample_questions = generate_sample_questions(table_name, description.strip(), columns)
        except Exception:
            sample_questions = []

    with engine.begin() as conn:
        table.create(conn)
        conn.execute(
            table_meta_table.insert().values(
                table_name=table_name,
                description=description.strip(),
                sample_questions=json.dumps(sample_questions or []),
                created_by_user_id=created_by_user_id,
            )
        )


def drop_table(engine: Engine, table_name: str) -> None:
    if table_name in PROTECTED_TABLES:
        raise SchemaError(f"'{table_name}' is protected and cannot be dropped here.")

    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        raise SchemaError(f"Table '{table_name}' does not exist.")

    table = get_reflected_table(engine, table_name)
    with engine.begin() as conn:
        table.drop(conn)
        conn.execute(
            delete(table_meta_table).where(table_meta_table.c.table_name == table_name)
        )
