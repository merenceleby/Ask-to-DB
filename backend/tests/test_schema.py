"""
The starter-table DDL in schema.py is written in raw Postgres syntax
(SERIAL, REFERENCES, etc.), which SQLite can't run — so these tests
mock the connection instead of hitting a real database. They check
that the right SQL gets issued, not that Postgres accepts it (that's
what running it against a real Supabase/Cloud SQL instance verifies).
"""
from unittest.mock import MagicMock

from app.db import schema as schema_module
from app.db.schema import (
    _STARTER_TABLE_NAMES,
    init_db,
    reset_demo_data,
    seed_demo_data,
)


def _mock_engine():
    engine = MagicMock()
    conn = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    return engine, conn


def test_init_db_only_creates_users_table(monkeypatch):
    calls = []
    monkeypatch.setattr(
        schema_module.metadata, "create_all", lambda engine, **kw: calls.append(engine)
    )
    init_db(MagicMock())
    assert len(calls) == 1
    # `metadata` in db/models.py only ever registers the `users` table —
    # this just confirms init_db calls create_all on THAT metadata and
    # nothing else, so no business table can sneak in here.
    assert list(schema_module.metadata.tables.keys()) == ["users"]


def test_seed_demo_data_creates_tables_and_inserts_rows():
    engine, conn = _mock_engine()
    seed_demo_data(engine)

    executed = " ".join(call.args[0] for call in conn.exec_driver_sql.call_args_list)
    assert "CREATE TABLE IF NOT EXISTS authors" in executed
    assert "CREATE TABLE IF NOT EXISTS order_items" in executed
    assert "INSERT INTO authors" in executed
    assert "INSERT INTO order_items" in executed


def test_reset_demo_data_drops_all_starter_tables_with_cascade():
    engine, conn = _mock_engine()
    reset_demo_data(engine)

    conn.exec_driver_sql.assert_called_once()
    sql = conn.exec_driver_sql.call_args[0][0]
    assert "DROP TABLE IF EXISTS" in sql
    assert "CASCADE" in sql
    for name in _STARTER_TABLE_NAMES:
        assert name in sql
