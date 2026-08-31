"""
AI chat router
==============
POST /api/ai/chat — receive a free-text message and return an AI response.

The AI layer classifies the intent, dispatches to the correct handler,
runs the deterministic engine where needed, and returns a natural-language
explanation.  The database is never modified by this endpoint.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.ai.ai_service import handle_chat
from app.database import get_db

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    response: str


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, db: Session = Depends(get_db)):
    """
    Send a free-text message to the Orbit911 AI copilot.

    Supported intents:
    - **Explain**: "Why was Zone B selected?"
    - **Interpret**: "Prioritize areas affecting hospitals."
    - **What-If**: "What if Zone B becomes unobservable?"

    The AI uses the deterministic decision engine as its source of truth.
    It never invents data or overrides satellite constraints.
    """
    try:
        response_text = handle_chat(body.message, db)
    except RuntimeError as exc:
        # GEMINI_API_KEY not configured
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {exc}",
        )
    return ChatResponse(response=response_text)
