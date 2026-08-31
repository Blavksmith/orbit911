"""
intent_models.py
================
Pydantic models that represent the structured intent extracted by Gemini
from a free-text user message.

Gemini is asked to return one of these intents as JSON.  The backend then
routes to the correct handler (explain / interpret / what-if) based on the
parsed intent.  The deterministic engine always performs the actual
calculation — Gemini only classifies and explains.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class ExplainIntent(BaseModel):
    """User wants an explanation of the current recommendation."""
    intent: Literal["explain"]
    target_zone: Optional[str] = Field(
        default=None,
        description="Zone name the user is asking about, e.g. 'Zone B'. "
                    "None means explain the top recommendation.",
    )


class InterpretIntent(BaseModel):
    """
    User wants to adjust priorities / preferences.

    Examples:
      'Prioritize hospitals'  → increase_hospital_weight = True
      'Focus on large populations' → focus_population = True

    The backend translates these into What-If overrides and re-runs the engine.
    """
    intent: Literal["interpret"]
    # Preference flags — set whichever the user mentioned
    increase_hospital_weight: bool = False
    increase_population_weight: bool = False
    increase_severity_weight: bool = False
    increase_infrastructure_weight: bool = False
    # Free-form description of the preference (forwarded to the explanation)
    preference_description: str = ""


class WhatIfOverrideFields(BaseModel):
    """Field-level changes for a single zone in a What-If scenario."""
    severity: Optional[float] = None
    fire_growth_rate: Optional[float] = None
    hospital_risk: Optional[float] = None
    critical_infrastructure_risk: Optional[float] = None
    population_exposed: Optional[int] = None
    satellite_available: Optional[bool] = None          # maps to is_available
    visibility_score: Optional[float] = None
    observation_window_minutes: Optional[float] = None


class WhatIfIntent(BaseModel):
    """User wants to see how the recommendation changes under a hypothetical."""
    intent: Literal["what_if"]
    target_zone_name: str = Field(
        description="Name or partial name of the zone to modify, e.g. 'Zone B'."
    )
    changes: WhatIfOverrideFields = Field(default_factory=WhatIfOverrideFields)
    # Human-readable summary of the scenario (used in the response explanation)
    scenario_description: str = ""


class UnknownIntent(BaseModel):
    """Gemini could not map the message to a known intent."""
    intent: Literal["unknown"]
    message: str = ""


# Union type used for parsing — try in order
AnyIntent = ExplainIntent | InterpretIntent | WhatIfIntent | UnknownIntent
