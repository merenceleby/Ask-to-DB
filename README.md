# Ask to DB: SQL AI Assistant

Ask a database questions in plain English. Gemma 4 (hosted by Google,
via the Gemini API) writes the SQL, the database answers, and Gemma 4
turns the result back into a natural-language answer.

Login-protected: only accounts created by the admin can use it. Admins
get an extra panel to manage users, create/delete demo data, and
browse/edit the underlying tables directly.

## Architecture

```
 Browser (React)
   |  Authorization: Bearer <token>
   v
 FastAPI backend  ---- GEMINI_API_KEY ---->  Gemma 4 (Google's servers)
   |
   v
 Postgres (Supabase, or Google Cloud SQL)
```

Routers:
- `routers/auth.py`      — `POST /auth/login` → returns a session token
- `routers/ask.py`       — `POST /ask` → requires *any* logged-in user
- `routers/admin.py`     — `/admin/*` → requires `is_admin = true`
- `routers/workspace.py` — `/workspace/*` → dynamic user table creation & data management
- `routers/metadata.py`  — `/metadata/*` → schema metadata and natural-language descriptions

Request flow for `POST /ask`:

1. Validate the `Authorization: Bearer <token>` header against database sessions.
2. Rate limit check (per IP).
3. Ask Gemma 4 to translate the question into SQL, given the schema
   (the schema description is auto-generated from `db/models.py`, and
   deliberately never mentions the `users` or `sessions` tables).
4. **Validate** the generated SQL — must be a single, read-only
   `SELECT`, no dangerous keywords, no reference to `users` or `sessions`, an
   automatic `LIMIT` is added.
5. Execute the query against Postgres.
6. Ask Gemma 4 to turn the result rows into a natural-language answer.
7. Return `{ answer, sql, rows }`.


## Running locally

```bash
cd backend
cp .env.example .env
# edit .env: add your GEMINI_API_KEY (from https://aistudio.google.com/apikey)


cd ../infra
docker compose up --build
# backend now running at http://localhost:8080
```

Create your first (admin) account — in a new terminal, with the
containers still running:

```bash
cd backend
python -m app.create_admin
```

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
# frontend running at http://localhost:5173
```

Log in with the account you just created. From the Admin tab you can:
create/delete other user accounts, click "Create demo data" to
populate the tables, and browse/edit/delete rows directly.

## Screenshots

<p align="center">
  <img width="1919" height="795" src="https://github.com/user-attachments/assets/068f61cc-17ee-4b96-acf3-115d2bfcac65" />
  <br />
  <em>Per-user question history and clickable sample questions generated for the current schema.</em>
</p>
<hr />
<p align="center"> 
<img width="938" height="620" src="https://github.com/user-attachments/assets/66174438-2109-4ede-9c32-92ad4fe0a01e" />
  <br />
  <em>Ask in plain English, get a natural-language answer plus the generated SQL and the raw result table.</em>
</p>

<hr />
<p align="center">
  <img width="1845" height="751" src="https://github.com/user-attachments/assets/6fff68ca-20f2-4f29-8c81-a7fef7210b8c" />

  <br />
  <em>Create your own tables, manage data, and auto-generate AI sample questions.</em>
</p>
<hr />
<p align="center">
  <img width="1919" height="804" src="https://github.com/user-attachments/assets/f1eba5b5-72a8-4f7d-ae14-c7877522217f" />

  <br />
  <em>Browse, add, edit and delete rows of any table directly.</em>
</p>

