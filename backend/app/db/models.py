"""
`users` is the ONLY table defined in code and auto-created on startup
(see db/schema.py init_db). It has to exist for login to work at all,
independent of whatever demo/business data exists.

Every other table — the 5 starter "bookstore" tables and anything an
admin creates afterwards — is created on demand:
  - the 5 starter tables: by seed_demo_data() when the admin clicks
    "Create demo data" (see db/schema.py)
  - anything else: by db/dynamic.py, from the Admin panel's
    "Create a new table" form

This means a freshly started backend has NO business tables at all
until an admin explicitly creates some — nothing appears "for free".
"""
from sqlalchemy import Boolean, Column, Integer, MetaData, String, Table, Text

metadata = MetaData()

users = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("username", String, unique=True, nullable=False),
    Column("hashed_password", String, nullable=False),
    Column("is_admin", Boolean, nullable=False, server_default="false"),
)

sessions = Table(
    "sessions",
    metadata,
    Column("token", String(64), primary_key=True),
    Column("user_id", Integer, nullable=False),
)

app_settings = Table(
    "app_settings",
    metadata,
    Column("key", String(100), primary_key=True),
    Column("value", Text, nullable=False),
)

table_metadata = Table(
    "table_metadata",
    metadata,
    Column("table_name", String(100), primary_key=True),
    Column("description", Text, nullable=False),
    Column("sample_questions", Text, nullable=True),  # JSON-encoded list of sample questions
    Column("created_by_user_id", Integer, nullable=True),
)

