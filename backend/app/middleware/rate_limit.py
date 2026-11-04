"""
Basic per-IP rate limiting. Matters here for two reasons:
  1. Each request triggers TWO LLM calls (generate_sql + generate_answer),
     which counts against the free Gemini API daily quota.
  2. Prevents someone from hammering the database through the /ask endpoint.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
