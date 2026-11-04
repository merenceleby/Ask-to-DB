"""
The single most important file in this project.

An LLM writes the SQL that runs against a real database. That query
must NEVER be trusted blindly. This module enforces:

  1. Exactly one statement (no ";DROP TABLE ..." stacking)
  2. The statement must be a SELECT (no INSERT/UPDATE/DELETE/DDL)
  3. A denylist of dangerous keywords, even inside subqueries/CTEs
  4. An automatic LIMIT, so a bad query can't return millions of rows

This is defense in depth — it's the second layer. The FIRST layer
should always be a database *role* that only has SELECT privileges
(see README "Security" section for the exact SQL to create that role).
Never rely on this validator alone in a real production system.
"""
import re

import sqlparse

_FORBIDDEN_KEYWORDS = {
    "insert", "update", "delete", "drop", "alter", "truncate",
    "create", "grant", "revoke", "attach", "detach", "pragma",
    "vacuum", "copy", "call", "execute", "merge", "replace",
    "into",  # blocks "SELECT ... INTO new_table"
}

# The LLM must never be able to read the users table (password hashes!),
# even though get_schema_description() never mentions it in the first
# place. This is layer two — belt and suspenders.
_FORBIDDEN_TABLES = {"users", "sessions", "app_settings", "table_metadata"}


class UnsafeSQLError(ValueError):
    """Raised when the LLM-generated SQL fails validation."""


def _strip_code_fences(raw_sql: str) -> str:
    """LLMs love wrapping SQL in ```sql ... ``` blocks — strip that."""
    cleaned = raw_sql.strip()
    cleaned = re.sub(r"^```sql", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"^```", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    return cleaned


def validate_and_sanitize_sql(raw_sql: str, max_rows: int) -> str:
    """
    Returns a safe SQL string to execute, or raises UnsafeSQLError.
    """
    sql = _strip_code_fences(raw_sql)

    statements = [s for s in sqlparse.split(sql) if s.strip()]
    if len(statements) == 0:
        raise UnsafeSQLError("The model returned no SQL statement.")
    if len(statements) > 1:
        raise UnsafeSQLError(
            "Only a single SQL statement is allowed (statement stacking detected)."
        )

    statement = statements[0]
    parsed = sqlparse.parse(statement)[0]

    if parsed.get_type() != "SELECT":
        raise UnsafeSQLError(
            f"Only SELECT statements are allowed, got '{parsed.get_type()}'."
        )

    tokens = [t.value.lower() for t in parsed.flatten() if t.ttype is not None]
    lowered_sql = " ".join(tokens)
    for keyword in _FORBIDDEN_KEYWORDS:
        # word-boundary check so e.g. "created_at" doesn't match "create"
        if re.search(rf"\b{keyword}\b", lowered_sql):
            raise UnsafeSQLError(f"Forbidden keyword detected: '{keyword}'.")

    for table_name in _FORBIDDEN_TABLES:
        if re.search(rf"\b{table_name}\b", lowered_sql):
            raise UnsafeSQLError(
                f"Query references a forbidden table: '{table_name}'."
            )

    clean_sql = statement.strip().rstrip(";")

    if not re.search(r"\blimit\b", clean_sql, flags=re.IGNORECASE):
        clean_sql = f"{clean_sql} LIMIT {max_rows}"

    return clean_sql
