"""
gemini_client.py
================
Thin wrapper around the Google GenAI SDK.

Responsibilities:
  - Initialise the client once using the API key from settings.
  - Provide a single `generate()` helper used by the service layer.
  - Surface a clear error if the API key is missing.

This module never calls the deterministic engine — it only communicates
with the Gemini API.
"""

import json
import logging
from typing import Optional

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

# Module-level client — initialised lazily on first use so the app still starts
# even when GEMINI_API_KEY is not set (tests don't need it).
_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. "
                "Add it to your .env file or environment variables."
            )
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def generate(
    prompt: str,
    system_instruction: str = "",
    temperature: float = 0.2,
) -> str:
    """
    Send a prompt to Gemini and return the text response.

    Parameters
    ----------
    prompt              : The user-facing prompt.
    system_instruction  : Optional system-level instruction for the model.
    temperature         : Lower = more deterministic. Keep low for emergency context.

    Returns
    -------
    The model's text response as a plain string.
    """
    client = _get_client()

    config = types.GenerateContentConfig(
        temperature=temperature,
        system_instruction=system_instruction or None,
    )

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=config,
    )

    return response.text or ""


def generate_json(
    prompt: str,
    system_instruction: str = "",
    temperature: float = 0.1,
) -> dict:
    """
    Send a prompt expecting a JSON response.

    The prompt should instruct Gemini to return only valid JSON.
    This function strips markdown fences if Gemini wraps the response.

    Returns the parsed dict, or {"intent": "unknown", "message": <error>}
    on failure.
    """
    raw = generate(
        prompt=prompt,
        system_instruction=system_instruction,
        temperature=temperature,
    )

    # Strip markdown code fences if present
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # Drop first line (```json or ```) and last line (```)
        text = "\n".join(lines[1:-1]).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning("Gemini returned non-JSON: %s — raw: %r", exc, raw[:200])
        return {"intent": "unknown", "message": "Could not parse AI response."}
