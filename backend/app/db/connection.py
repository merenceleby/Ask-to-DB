"""
Provider-agnostic database engine factory.

Switch providers purely through the DB_PROVIDER environment variable —
no other code in the app needs to change.

  DB_PROVIDER=supabase  -> plain Postgres connection string (default, free tier)
  DB_PROVIDER=cloudsql  -> Google Cloud SQL via the Cloud SQL Python Connector

The engine is created once and reused (SQLAlchemy connection pooling).
"""
from functools import lru_cache

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine

from app.config import settings


def _build_supabase_engine() -> Engine:
    if not settings.database_url:
        raise RuntimeError(
            "DATABASE_URL is empty. Set it in .env (Supabase connection string)."
        )
    return create_engine(settings.database_url, pool_pre_ping=True)


def _build_cloudsql_engine() -> Engine:
    """
    Requires the extra dependency group: pip install -r requirements-cloudsql.txt
    Uses IAM-based auth via the Cloud SQL Auth Proxy library instead of
    whitelisting IPs, which is the Google-recommended secure approach.
    """
    try:
        from google.cloud.sql.connector import Connector
    except ImportError as exc:
        raise RuntimeError(
            "Cloud SQL connector not installed. "
            "Run: pip install -r requirements-cloudsql.txt"
        ) from exc

    connector = Connector()

    def getconn():
        return connector.connect(
            settings.cloudsql_instance_connection_name,
            "pg8000",
            user=settings.cloudsql_user,
            password=settings.cloudsql_password,
            db=settings.cloudsql_db,
        )

    return create_engine("postgresql+pg8000://", creator=getconn, pool_pre_ping=True)


@lru_cache
def get_engine() -> Engine:
    if settings.db_provider == "supabase":
        engine = _build_supabase_engine()
    elif settings.db_provider == "cloudsql":
        engine = _build_cloudsql_engine()
    else:
        raise ValueError(
            f"Unknown DB_PROVIDER '{settings.db_provider}'. "
            "Use 'supabase' or 'cloudsql'."
        )

    # Enforce a hard statement timeout on every connection, so a runaway
    # LLM-generated query can never hang the database.
    @event.listens_for(engine, "connect")
    def _set_statement_timeout(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute(f"SET statement_timeout = {settings.sql_statement_timeout_ms}")
        cursor.close()

    return engine
