"""
Wrapper around Google's Gemini API to call the Gemma 4 model.

T"""
import json
import logging
import re
import time
from google import genai

from app.config import settings
from app.llm.prompts import (
    build_answer_prompt,
    build_sample_questions_prompt,
    build_text_to_sql_prompt,
)

logger = logging.getLogger(__name__)

_client = genai.Client(api_key=settings.gemini_api_key)


def _generate_with_fallback(prompt: str) -> str:
    """
    Calls Google GenAI with automatic retries and fallback models
    to protect against transient 500 INTERNAL or 503 errors.
    """
    models = [settings.gemini_model, "gemini-2.5-flash", "gemini-2.0-flash"]
    last_err = None

    for model_name in models:
        for attempt in range(2):
            try:
                response = _client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as err:
                last_err = err
                logger.warning(
                    "Model %s failed (attempt %d/2): %s", model_name, attempt + 1, err
                )
                time.sleep(1)

    raise last_err or RuntimeError("Yapay zeka modelinden yanıt alınamadı.")


def generate_sql(question: str, schema: str) -> str:
    prompt = build_text_to_sql_prompt(question, schema)
    return _generate_with_fallback(prompt)


def generate_answer(question: str, sql: str, rows: list[dict]) -> str:
    prompt = build_answer_prompt(question, sql, rows)
    return _generate_with_fallback(prompt)


def generate_sample_questions(
    table_name: str, description: str, columns: list[dict]
) -> list[str]:
    """Uses LLM to automatically generate 3-4 natural sample questions for a table."""
    try:
        prompt = build_sample_questions_prompt(table_name, description, columns)
        raw = _generate_with_fallback(prompt)
        # Clean markdown code blocks if any
        raw = re.sub(r"^```(?:json)?", "", raw, flags=re.IGNORECASE).strip()
        raw = re.sub(r"```$", "", raw).strip()
        questions = json.loads(raw)
        if isinstance(questions, list):
            return [str(q).strip() for q in questions if str(q).strip()]
    except Exception as exc:
        logger.error("Error generating sample questions with LLM: %s", exc)

    # Simple fallback questions if LLM is unavailable or fails
    return [
        f"Show top 5 records from {table_name}",
        f"How many entries are in {table_name}?",
    ]
