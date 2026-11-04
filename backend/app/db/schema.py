"""
NOTE: on startup, only `users` gets created (see init_db) — it's the
one table login itself depends on. The 5 "starter" bookstore tables
don't exist until an admin clicks "Create demo data", and they're
fully dropped (not just emptied) by "Delete demo data" — so a fresh
backend genuinely starts with nothing but an empty login system.
"""
import json
from sqlalchemy.engine import Engine
from sqlalchemy.schema import CreateTable
from sqlalchemy import select, delete

from app.db.dynamic import STARTER_TABLE_NAMES, get_reflected_table, list_business_tables, list_accessible_business_tables
from app.db.models import metadata, app_settings, table_metadata

DEFAULT_DEMO_TABLE_METADATA = {
    "authors": {
        "description": "Stores author details including their full name and country of origin.",
        "sample_questions": [
            "List all authors from the UK",
            "How many authors are in the database?",
        ],
    },
    "books": {
        "description": "Stores books inventory with title, genre, price, published year, and foreign key to authors.",
        "sample_questions": [
            "Which are the top 3 most expensive books?",
            "Show all fiction books published after 1980",
            "What is the average price of books by genre?",
        ],
    },
    "customers": {
        "description": "Stores customer information including name, email address, and country.",
        "sample_questions": [
            "How many customers are from Japan?",
            "List all customer names and emails",
        ],
    },
    "orders": {
        "description": "Tracks purchases placed by customers with customer_id and order_date.",
        "sample_questions": [
            "How many orders were placed in total?",
            "List all orders placed in 2026",
        ],
    },
    "order_items": {
        "description": "Contains line items for each order linking books and quantities purchased.",
        "sample_questions": [
            "Which customer spent the most money overall?",
            "What is the most frequently purchased book?",
        ],
    },
}

_STARTER_TABLES_DDL = """
CREATE TABLE IF NOT EXISTS authors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT
);

CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author_id INTEGER REFERENCES authors(id),
    genre TEXT,
    price NUMERIC(6, 2) NOT NULL,
    published_year INTEGER
);

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    country TEXT
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    book_id INTEGER REFERENCES books(id),
    quantity INTEGER NOT NULL DEFAULT 1
);
"""

# Raw INSERT statements for demo data. Kept as plain SQL (server-authored,
# never touches user input — unlike the LLM-generated SQL, which goes
# through security/sql_validator.py).
_DEMO_SEED_SQL = """
INSERT INTO authors (name, country) VALUES
    ('George Orwell', 'UK'),
    ('Haruki Murakami', 'Japan'),
    ('Chinua Achebe', 'Nigeria');

INSERT INTO books (title, author_id, genre, price, published_year) VALUES
    ('1984', 1, 'Dystopian', 12.50, 1949),
    ('Animal Farm', 1, 'Satire', 9.00, 1945),
    ('Norwegian Wood', 2, 'Fiction', 14.00, 1987),
    ('Kafka on the Shore', 2, 'Fiction', 15.50, 2002),
    ('Things Fall Apart', 3, 'Fiction', 11.00, 1958);

INSERT INTO customers (name, email, country) VALUES
    ('Ada Lovelace', 'ada@example.com', 'UK'),
    ('Kenji Sato', 'kenji@example.com', 'Japan');

INSERT INTO orders (customer_id, order_date) VALUES
    (1, '2026-01-15'),
    (2, '2026-02-03');

INSERT INTO order_items (order_id, book_id, quantity) VALUES
    (1, 1, 2),
    (1, 3, 1),
    (2, 4, 1);
"""



def get_schema_description(engine: Engine, user_id: int | None = None, is_admin: bool = False) -> str:
    """
    Reflects accessible current tables for the given user.
    Enriches DDLs with semantic table descriptions from `table_metadata`.
    """
    table_names = list_accessible_business_tables(engine, user_id=user_id, is_admin=is_admin)
    if not table_names:
        return ""

    descriptions = {}
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                select(table_metadata.c.table_name, table_metadata.c.description)
            ).all()
            descriptions = {r.table_name: r.description for r in rows}
    except Exception:
        pass

    ddls = []
    for name in table_names:
        ddl = str(CreateTable(get_reflected_table(engine, name))).strip()
        desc = descriptions.get(name)
        if desc:
            ddls.append(f"-- Table: {name}\n-- Purpose: {desc}\n{ddl}")
        else:
            ddls.append(ddl)

    return "\n\n".join(ddls)


def init_db(engine: Engine) -> None:
    """Creates system tables (users, app_settings, table_metadata) if they don't exist."""
    metadata.create_all(engine)


def seed_demo_data(engine: Engine) -> None:
    """
    Admin action: creates the 5 starter tables (if they don't already
    exist), fills them with demo rows, and seeds default database & table metadata.
    """
    with engine.begin() as conn:
        for statement in _STARTER_TABLES_DDL.strip().split(";"):
            if statement.strip():
                conn.exec_driver_sql(statement)
        for statement in _DEMO_SEED_SQL.strip().split(";"):
            if statement.strip():
                conn.exec_driver_sql(statement)

        # Upsert DB general settings
        conn.execute(
            delete(app_settings).where(app_settings.c.key.in_(["db_title", "db_description"]))
        )
        conn.execute(
            app_settings.insert(),
            [
                {"key": "db_title", "value": "Bookstore & Order Management"},
                {
                    "key": "db_description",
                    "value": "A relational database tracking bookstore authors, books, customer profiles, customer orders, and individual order items.",
                },
            ],
        )

        # Upsert starter table metadata (starter demo tables are shared for all)
        for t_name, meta in DEFAULT_DEMO_TABLE_METADATA.items():
            conn.execute(
                delete(table_metadata).where(table_metadata.c.table_name == t_name)
            )
            conn.execute(
                table_metadata.insert().values(
                    table_name=t_name,
                    description=meta["description"],
                    sample_questions=json.dumps(meta["sample_questions"]),
                    created_by_user_id=None,
                )
            )


def reset_demo_data(engine: Engine) -> None:
    """
    Admin action: drops the 5 starter tables ENTIRELY (not just their
    rows) and cleans their metadata.
    """
    with engine.begin() as conn:
        table_list = ", ".join(STARTER_TABLE_NAMES)
        conn.exec_driver_sql(f"DROP TABLE IF EXISTS {table_list} CASCADE")
        conn.execute(
            delete(table_metadata).where(table_metadata.c.table_name.in_(STARTER_TABLE_NAMES))
        )
