"""
ai_service.py
=============
Orchestrates the three AI capabilities for Orbit911.

Flow for every user message:
  1. Call Gemini to classify the message into a structured intent.
  2. Validate the intent with Pydantic.
  3. Dispatch to the correct handler (explain / interpret / what-if).
  4. Each handler calls the deterministic engine (never Gemini for scoring).
  5. Pass the engine result back to Gemini for a natural-language explanation.
  6. Return the final text response to the caller.

The deterministic engine is always the source of truth.
"""

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.ai.gemini_client import generate, generate_json
from app.ai.intent_models import (
    AnyIntent,
    ExplainIntent,
    InterpretIntent,
    UnknownIntent,
    WhatIfIntent,
    WhatIfOverrideFields,
)
from app.ai.prompts import (
    SYSTEM_PROMPT,
    explanation_prompt,
    intent_classification_prompt,
    interpret_result_prompt,
    what_if_result_prompt,
)
from app.engine.recommendation_engine import ZoneResult, rank_zones
from app.routers.recommendation import _apply_overrides, _build_response, _load_zone_inputs
from app.schemas import (
    WhatIfRequest,
    ZoneOverride,
    WildfireOverride,
    OpportunityOverride,
)

logger = logging.getLogger(__name__)


# ── Intent parsing ─────────────────────────────────────────────────────────────

def _parse_intent(user_message: str) -> AnyIntent:
    """Ask Gemini to classify the message and parse the result with Pydantic."""
    raw = generate_json(
        prompt=intent_classification_prompt(user_message),
        system_instruction=SYSTEM_PROMPT,
    )
    intent_type = raw.get("intent", "unknown")

    try:
        if intent_type == "explain":
            return ExplainIntent(**raw)
        if intent_type == "interpret":
            return InterpretIntent(**raw)
        if intent_type == "what_if":
            return WhatIfIntent(**raw)
    except Exception as exc:
        logger.warning("Failed to parse intent %r: %s", raw, exc)

    return UnknownIntent(intent="unknown", message=raw.get("message", ""))


# ── Handlers ───────────────────────────────────────────────────────────────────

def _handle_explain(
    intent: ExplainIntent,
    db: Session,
) -> str:
    """Load current recommendation and ask Gemini to explain it."""
    zones = _load_zone_inputs(db)
    if not zones:
        return "No wildfire data is currently available."

    ranked = rank_zones(zones)
    prompt = explanation_prompt(ranked, intent.target_zone)
    return generate(prompt=prompt, system_instruction=SYSTEM_PROMPT)


def _handle_interpret(
    intent: InterpretIntent,
    db: Session,
) -> str:
    """
    Translate a user preference into a What-If scenario and run the engine.

    Strategy: boost the relevant risk fields for all zones by a factor to
    simulate prioritising that dimension, then explain the result.
    """
    zones = _load_zone_inputs(db)
    if not zones:
        return "No wildfire data is currently available."

    # Build per-zone overrides based on preference flags
    overrides_dict: dict[str, ZoneOverride] = {}

    for zone in zones:
        wf_changes: dict = {}

        if intent.increase_hospital_weight:
            # Amplify hospital risk: push toward 100 by adding 30% of headroom
            boosted = min(100.0, zone.hospital_risk + (100.0 - zone.hospital_risk) * 0.3)
            wf_changes["hospital_risk"] = round(boosted, 1)

        if intent.increase_population_weight:
            pop_score = min(100, zone.population_exposed + zone.population_exposed // 3)
            wf_changes["population_exposed"] = pop_score

        if intent.increase_severity_weight:
            boosted = min(100.0, zone.severity + (100.0 - zone.severity) * 0.3)
            wf_changes["severity"] = round(boosted, 1)

        if intent.increase_infrastructure_weight:
            boosted = min(
                100.0,
                zone.critical_infrastructure_risk
                + (100.0 - zone.critical_infrastructure_risk) * 0.3,
            )
            wf_changes["critical_infrastructure_risk"] = round(boosted, 1)

        if wf_changes:
            overrides_dict[str(zone.wildfire_id)] = ZoneOverride(
                wildfire=WildfireOverride(**wf_changes)
            )

    # Baseline and modified ranking
    original_ranked = rank_zones(zones)
    orig_rec = next((r for r in original_ranked if r.is_recommended), None)

    if overrides_dict:
        req = WhatIfRequest(overrides=overrides_dict)
        modified_zones = _apply_overrides(zones, req)
        new_ranked = rank_zones(modified_zones)
    else:
        new_ranked = original_ranked

    new_rec = next((r for r in new_ranked if r.is_recommended), None)

    prompt = interpret_result_prompt(
        preference_description=intent.preference_description or "adjust priorities",
        original_recommendation=orig_rec.wildfire_name if orig_rec else None,
        new_recommendation=new_rec.wildfire_name if new_rec else None,
        ranked=new_ranked,
    )
    return generate(prompt=prompt, system_instruction=SYSTEM_PROMPT)


def _fields_to_overrides(
    changes: WhatIfOverrideFields,
) -> tuple[Optional[WildfireOverride], Optional[OpportunityOverride]]:
    """Convert AI-extracted change fields into the correct schema objects."""
    wf_fields: dict = {}
    opp_fields: dict = {}

    if changes.severity is not None:
        wf_fields["severity"] = changes.severity
    if changes.fire_growth_rate is not None:
        wf_fields["fire_growth_rate"] = changes.fire_growth_rate
    if changes.hospital_risk is not None:
        wf_fields["hospital_risk"] = changes.hospital_risk
    if changes.critical_infrastructure_risk is not None:
        wf_fields["critical_infrastructure_risk"] = changes.critical_infrastructure_risk
    if changes.population_exposed is not None:
        wf_fields["population_exposed"] = changes.population_exposed

    if changes.satellite_available is not None:
        opp_fields["is_available"] = changes.satellite_available
    if changes.visibility_score is not None:
        opp_fields["visibility_score"] = changes.visibility_score
    if changes.observation_window_minutes is not None:
        opp_fields["observation_window_minutes"] = changes.observation_window_minutes

    wf_override = WildfireOverride(**wf_fields) if wf_fields else None
    opp_override = OpportunityOverride(**opp_fields) if opp_fields else None
    return wf_override, opp_override


def _handle_what_if(
    intent: WhatIfIntent,
    db: Session,
) -> str:
    """
    Apply the AI-extracted changes temporarily and run the engine.
    Returns a natural-language explanation of the new recommendation.
    """
    zones = _load_zone_inputs(db)
    if not zones:
        return "No wildfire data is currently available."

    # Find the target zone by name (partial, case-insensitive)
    target = next(
        (z for z in zones if intent.target_zone_name.lower() in z.wildfire_name.lower()),
        None,
    )
    if target is None:
        return (
            f"I couldn't find a zone matching '{intent.target_zone_name}'. "
            "Please check the zone name and try again."
        )

    # Build override request
    wf_override, opp_override = _fields_to_overrides(intent.changes)
    if wf_override is None and opp_override is None:
        return (
            "I understood the scenario but couldn't identify specific changes to apply. "
            "Try rephrasing, e.g. 'What if Zone B becomes unobservable?'"
        )

    overrides_dict = {
        str(target.wildfire_id): ZoneOverride(wildfire=wf_override, opportunity=opp_override)
    }
    req = WhatIfRequest(overrides=overrides_dict)

    # Run both passes through the deterministic engine
    original_ranked = rank_zones(zones)
    modified_zones = _apply_overrides(zones, req)
    new_ranked = rank_zones(modified_zones)

    orig_rec = next((r for r in original_ranked if r.is_recommended), None)
    new_rec = next((r for r in new_ranked if r.is_recommended), None)

    # Build change description for prompt
    changes = []
    if opp_override and opp_override.is_available is False:
        changes.append(f"{target.wildfire_name}: satellite marked as unavailable (not observable)")
    if wf_override:
        for field in ("severity", "fire_growth_rate", "hospital_risk",
                      "critical_infrastructure_risk"):
            val = getattr(wf_override, field, None)
            if val is not None:
                changes.append(f"{target.wildfire_name}: {field.replace('_', ' ')} set to {val}")

    # Engine reasons
    reasons = []
    if orig_rec and new_rec and orig_rec.wildfire_id != new_rec.wildfire_id:
        reasons.append(
            f"{orig_rec.wildfire_name} is no longer the top target after the change."
        )
        reasons.append(
            f"{new_rec.wildfire_name} becomes the recommended observation target."
        )
    elif new_rec:
        reasons.append(f"{new_rec.wildfire_name} remains the recommended target.")
    else:
        reasons.append("No feasible targets remain after this change.")

    prompt = what_if_result_prompt(
        scenario_description=intent.scenario_description or f"{intent.target_zone_name} scenario",
        original_recommendation=orig_rec.wildfire_name if orig_rec else None,
        new_recommendation=new_rec.wildfire_name if new_rec else None,
        changes=changes,
        reasons=reasons,
        ranked=new_ranked,
    )
    return generate(prompt=prompt, system_instruction=SYSTEM_PROMPT)


# ── Public entry point ─────────────────────────────────────────────────────────

def handle_chat(user_message: str, db: Session) -> str:
    """
    Main entry point for the AI chat endpoint.

    1. Classify the message.
    2. Dispatch to the correct handler.
    3. Return a natural-language response.
    """
    intent = _parse_intent(user_message)

    if isinstance(intent, ExplainIntent):
        return _handle_explain(intent, db)

    if isinstance(intent, InterpretIntent):
        return _handle_interpret(intent, db)

    if isinstance(intent, WhatIfIntent):
        return _handle_what_if(intent, db)

    # Unknown intent — give a helpful fallback
    return (
        "I'm Orbit911's emergency operations copilot. You can ask me:\n"
        "- \"Why was Zone B selected?\"\n"
        "- \"Prioritize areas with hospitals.\"\n"
        "- \"What if Zone B becomes unobservable?\""
    )
