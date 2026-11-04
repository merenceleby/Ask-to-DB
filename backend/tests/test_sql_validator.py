import pytest

from app.security.sql_validator import UnsafeSQLError, validate_and_sanitize_sql


def test_allows_simple_select():
    sql = validate_and_sanitize_sql("SELECT * FROM books", max_rows=100)
    assert sql == "SELECT * FROM books LIMIT 100"


def test_allows_select_with_existing_limit():
    sql = validate_and_sanitize_sql("SELECT * FROM books LIMIT 5", max_rows=100)
    assert "LIMIT 5" in sql
    assert sql.count("LIMIT") == 1


def test_strips_markdown_code_fences():
    sql = validate_and_sanitize_sql("```sql\nSELECT * FROM books\n```", max_rows=50)
    assert sql.startswith("SELECT")


def test_rejects_drop_table():
    with pytest.raises(UnsafeSQLError):
        validate_and_sanitize_sql("DROP TABLE books", max_rows=100)


def test_rejects_statement_stacking_injection():
    with pytest.raises(UnsafeSQLError):
        validate_and_sanitize_sql(
            "SELECT * FROM books; DROP TABLE books;", max_rows=100
        )


def test_rejects_insert():
    with pytest.raises(UnsafeSQLError):
        validate_and_sanitize_sql(
            "INSERT INTO books (title) VALUES ('hacked')", max_rows=100
        )


def test_rejects_update():
    with pytest.raises(UnsafeSQLError):
        validate_and_sanitize_sql(
            "UPDATE books SET price = 0 WHERE id = 1", max_rows=100
        )


def test_rejects_delete():
    with pytest.raises(UnsafeSQLError):
        validate_and_sanitize_sql("DELETE FROM books", max_rows=100)


def test_rejects_select_into():
    with pytest.raises(UnsafeSQLError):
        validate_and_sanitize_sql(
            "SELECT * INTO stolen_books FROM books", max_rows=100
        )


def test_does_not_false_positive_on_column_names():
    # "created_at" contains "create" as a substring but must NOT be blocked
    sql = validate_and_sanitize_sql(
        "SELECT created_at FROM orders", max_rows=100
    )
    assert "created_at" in sql


def test_rejects_query_against_users_table():
    with pytest.raises(UnsafeSQLError):
        validate_and_sanitize_sql("SELECT * FROM users", max_rows=100)


def test_rejects_query_against_sessions_table():
    with pytest.raises(UnsafeSQLError):
        validate_and_sanitize_sql("SELECT * FROM sessions", max_rows=100)


def test_rejects_users_table_even_inside_a_join():
    with pytest.raises(UnsafeSQLError):
        validate_and_sanitize_sql(
            "SELECT books.title FROM books JOIN users ON users.id = books.id",
            max_rows=100,
        )
