"""
These tests mock the LLM calls and use an in-memory SQLite engine
instead of a real Postgres instance — useful for CI (see
.github/workflows/deploy.yml). SQLite is close enough to Postgres for
SQLAlchemy Core reflection/CRUD/DDL, which is all these tests exercise.

Tokens are created directly with create_access_token() rather than
going through a real /auth/login + database user.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

import app.routers.admin as admin_module
import app.routers.ask as ask_module
from app.auth.tokens import create_access_token
from app.main import app


def _engine_with_books():
    # StaticPool + check_same_thread=False: FastAPI runs sync endpoints in a
    # threadpool, and plain sqlite:///:memory: hands out a *different*
    # empty database per connection/thread. StaticPool forces every
    # checkout to reuse the exact same connection, so the table we create
    # here is still visible from whatever thread handles the HTTP request.
    engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT)"))
        conn.execute(text("INSERT INTO books VALUES (1, '1984')"))
        conn.execute(text("INSERT INTO books VALUES (2, 'Animal Farm')"))
    return engine


def _auth_header(username="alice", is_admin=False):
    token = create_access_token(username, is_admin)
    return {"Authorization": f"Bearer {token}"}


# ---------- /ask ----------

def test_ask_requires_login():
    from fastapi.testclient import TestClient

    client = TestClient(app)
    response = client.post("/ask", json={"question": "anything"})
    assert response.status_code == 401


def test_ask_happy_path(monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setattr(ask_module, "get_engine", _engine_with_books)
    monkeypatch.setattr(
        ask_module, "generate_sql", lambda question, schema: "SELECT * FROM books"
    )
    monkeypatch.setattr(
        ask_module,
        "generate_answer",
        lambda question, sql, rows: f"There are {len(rows)} books.",
    )

    client = TestClient(app)
    response = client.post(
        "/ask",
        json={"question": "How many books are there?"},
        headers=_auth_header(),  # regular (non-admin) user — /ask doesn't require admin
    )

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "There are 2 books."
    assert "LIMIT" in data["sql"]
    assert len(data["rows"]) == 2


def test_ask_rejects_unsafe_generated_sql(monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setattr(ask_module, "get_engine", _engine_with_books)
    monkeypatch.setattr(
        ask_module, "generate_sql", lambda question, schema: "DROP TABLE books"
    )

    client = TestClient(app)
    response = client.post(
        "/ask",
        json={"question": "delete everything"},
        headers=_auth_header(),
    )
    assert response.status_code == 400


def test_ask_gives_friendly_error_when_no_tables_exist(monkeypatch):
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool

    empty_engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    monkeypatch.setattr(ask_module, "get_engine", lambda: empty_engine)

    client = TestClient(app)
    response = client.post(
        "/ask",
        json={"question": "anything"},
        headers=_auth_header(),
    )
    assert response.status_code == 400
    assert "no tables" in response.json()["detail"].lower()


# ---------- /admin: auth gate ----------

def test_admin_endpoint_rejects_non_admin_user():
    from fastapi.testclient import TestClient

    client = TestClient(app)
    response = client.get("/admin/tables", headers=_auth_header(is_admin=False))
    assert response.status_code == 403


def test_admin_endpoint_rejects_missing_login():
    from fastapi.testclient import TestClient

    client = TestClient(app)
    response = client.get("/admin/tables")
    assert response.status_code == 401


# ---------- /admin: demo data (functions mocked, just checking wiring) ----------

def test_admin_demo_seed_and_reset_are_wired_up(monkeypatch):
    from fastapi.testclient import TestClient

    calls = []
    monkeypatch.setattr(admin_module, "get_engine", lambda: "fake-engine")
    monkeypatch.setattr(admin_module, "seed_demo_data", lambda engine: calls.append(("seed", engine)))
    monkeypatch.setattr(admin_module, "reset_demo_data", lambda engine: calls.append(("reset", engine)))

    client = TestClient(app)
    admin_headers = _auth_header(is_admin=True)

    resp1 = client.post("/admin/demo/seed", headers=admin_headers)
    resp2 = client.post("/admin/demo/reset", headers=admin_headers)

    assert resp1.status_code == 200
    assert resp2.status_code == 200
    assert calls == [("seed", "fake-engine"), ("reset", "fake-engine")]


# ---------- /admin: dynamic schema + generic CRUD, end to end ----------

def test_admin_full_table_lifecycle(monkeypatch):
    """
    Covers the new "create your own tables from the admin panel" feature:
    create a table -> see it listed -> insert/update/delete a row in it
    -> drop it again. Also checks that `users` and the built-in business
    tables can't be dropped through this endpoint.
    """
    from fastapi.testclient import TestClient

    engine = _engine_with_books()
    monkeypatch.setattr(admin_module, "get_engine", lambda: engine)

    client = TestClient(app)
    admin_headers = _auth_header(is_admin=True)

    # only the pre-existing 'books' table so far
    assert client.get("/admin/tables", headers=admin_headers).json() == ["books"]

    # allowed column types are exposed for the frontend's dropdown
    types_resp = client.get("/admin/schema/column-types", headers=admin_headers)
    assert "integer" in types_resp.json()

    # create a new table
    create_resp = client.post(
        "/admin/schema/tables",
        json={
            "table_name": "reviews",
            "columns": [{"name": "rating", "type": "integer", "nullable": False}],
        },
        headers=admin_headers,
    )
    assert create_resp.status_code == 201

    # now shows up in the table list
    tables = client.get("/admin/tables", headers=admin_headers).json()
    assert set(tables) == {"books", "reviews"}

    # insert a row into the new table via the generic CRUD endpoint
    row_resp = client.post(
        "/admin/tables/reviews", json={"rating": 5}, headers=admin_headers
    )
    assert row_resp.status_code == 201
    row_id = row_resp.json()["id"]

    # read it back
    rows = client.get("/admin/tables/reviews", headers=admin_headers).json()
    assert rows == [{"id": row_id, "rating": 5}]

    # update it
    update_resp = client.put(
        f"/admin/tables/reviews/{row_id}",
        json={"rating": 4},
        headers=admin_headers,
    )
    assert update_resp.json()["rating"] == 4

    # delete the row
    delete_resp = client.delete(
        f"/admin/tables/reviews/{row_id}", headers=admin_headers
    )
    assert delete_resp.status_code == 204

    # drop the table itself
    drop_resp = client.delete("/admin/schema/tables/reviews", headers=admin_headers)
    assert drop_resp.status_code == 200
    assert "reviews" not in client.get("/admin/tables", headers=admin_headers).json()

    # `users` is the only table that can never be dropped this way —
    # ordinary business tables (like 'books' here) are NOT protected,
    # since they're just regular tables now, not permanent built-ins.
    users_resp = client.delete("/admin/schema/tables/users", headers=admin_headers)
    assert users_resp.status_code == 400

    books_resp = client.delete("/admin/schema/tables/books", headers=admin_headers)
    assert books_resp.status_code == 200


def test_admin_cannot_create_table_with_reserved_name(monkeypatch):
    from fastapi.testclient import TestClient

    engine = _engine_with_books()
    monkeypatch.setattr(admin_module, "get_engine", lambda: engine)

    client = TestClient(app)
    response = client.post(
        "/admin/schema/tables",
        json={"table_name": "users", "columns": [{"name": "x", "type": "text"}]},
        headers=_auth_header(is_admin=True),
    )
    assert response.status_code == 400


def test_admin_unknown_table_returns_404(monkeypatch):
    from fastapi.testclient import TestClient

    engine = _engine_with_books()
    monkeypatch.setattr(admin_module, "get_engine", lambda: engine)

    client = TestClient(app)
    response = client.get(
        "/admin/tables/does_not_exist",
        headers=_auth_header(is_admin=True),
    )
    assert response.status_code == 404
