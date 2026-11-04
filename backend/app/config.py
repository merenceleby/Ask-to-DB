"""
Central application configuration.

All values are loaded from environment variables (see .env.example).
Never commit a real .env file — it contains secrets (API keys, DB passwords).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- LLM (Gemma 4 via Gemini API) ---
    gemini_api_key: str = ""
    gemini_model: str = "gemma-4-26b-a4b-it"  # fast MoE variant; use gemma-4-31b-it for higher quality

    # --- Database provider switch ---
    # "supabase" (default, free tier, plain Postgres connection string)
    # "cloudsql" (Google Cloud SQL, uses the Cloud SQL Python Connector)
    db_provider: str = "supabase"

    # Supabase / plain Postgres
    database_url: str = ""  # e.g. postgresql+psycopg2://user:pass@host:5432/postgres

    # Cloud SQL (only needed if db_provider == "cloudsql")
    cloudsql_instance_connection_name: str = ""  # "project:region:instance"
    cloudsql_db: str = ""
    cloudsql_user: str = ""
    cloudsql_password: str = ""

    # --- Query safety ---
    sql_statement_timeout_ms: int = 5000
    sql_max_rows: int = 200

    # --- Rate limiting ---
    rate_limit: str = "20/minute"

    # --- CORS ---
    cors_allow_origins: str = "http://localhost:5173"


settings = Settings()
