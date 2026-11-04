def build_text_to_sql_prompt(question: str, schema: str) -> str:
    return f"""You are a PostgreSQL expert. Given a database schema and a
question in natural language, write a single, safe, read-only SQL SELECT
query that answers the question.

Rules:
- Output ONLY the raw SQL query. No explanation, no markdown, no code fences.
- Only use SELECT. Never write INSERT, UPDATE, DELETE, or any DDL.
- Only use tables and columns that exist in the schema below.
- If the question cannot be answered with the given schema, output exactly:
  SELECT 'I cannot answer this question with the available data.' AS message;

Schema:
{schema}

Question: {question}

SQL:"""


def build_answer_prompt(question: str, sql: str, rows: list[dict]) -> str:
    return f"""You answered a user's question by running a SQL query against
a database. Write a short, natural-language answer to the user's original
question, based only on the query result below. Do not mention SQL or the
query itself in your answer — just answer as if you looked it up directly.

Original question: {question}

Query result (JSON rows): {rows}

Answer:"""


def build_sample_questions_prompt(table_name: str, description: str, columns: list[dict]) -> str:
    col_str = ", ".join([f"{c.get('name')} ({c.get('type')})" for c in columns])
    return f"""You are a data assistant. Given a database table with its name, description, and columns, generate 3 to 4 natural, insightful questions that an end-user or business owner might ask about this data.

Table Name: {table_name}
Description: {description}
Columns: {col_str}

Rules:
1. Detect the primary language of the Description. If the Description is in Turkish, write all questions in fluent, natural Turkish. If in English, write in English.
2. Return ONLY a valid JSON array of strings, for example:
["Question 1?", "Question 2?", "Question 3?"]
3. Do NOT include markdown fences, explanations, or other text. Output ONLY the JSON array.
"""
