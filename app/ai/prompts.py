"""
prompts.py
==========
All Gemini prompt templates for Orbit911.

Kept as plain functions that return strings so they are easy to test and
iterate on without touching the AI client code.
"""

from app.engine.recommendation_engine import ZoneResult


# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are Orbit911's emergency operations copilot.

Your role is to help emergency operators understand satellite observation recommendations during wildfire events.

Rules you must always follow:
- Be concise, factual, and decision-focused.
- Never invent wildfire data, population counts, or satellite availability.
- Never override satellite constraints or emergency scores.
- Never make autonomous emergency decisions.
- The deterministic backend is the source of truth — you only explain and interpret.
- Keep responses under 5 sentences unless more detail is truly needed.
- Use plain language, no unnecessary jargon.
"""


# ── Intent classification prompt ──────────────────────────────────────────────

def intent_classification_prompt(user_message: str) -> str:
    return f"""Classify the following user message into exactly one intent.

User message: "{user_message}"

Return a single JSON object matching one of these schemas:

1. Explain intent (user wants to understand why a zone was selected):
{{"intent": "explain", "target_zone": "<zone name or null>"}}

2. Interpret intent (user wants to change priorities/preferences):
{{"intent": "interpret", "increase_hospital_weight": true/false, "increase_population_weight": true/false, "increase_severity_weight": true/false, "increase_infrastructure_weight": true/false, "preference_description": "<short description>"}}

3. What-if intent (user wants to simulate a change to conditions):
{{"intent": "what_if", "target_zone_name": "<zone name>", "changes": {{"severity": null, "fire_growth_rate": null, "hospital_risk": null, "critical_infrastructure_risk": null, "population_exposed": null, "satellite_available": null, "visibility_score": null, "observation_window_minutes": null}}, "scenario_description": "<short description>"}}

4. Unknown intent (message does not fit any of the above):
{{"intent": "unknown", "message": "<brief reason>"}}

Rules:
- For what-if, set only the fields the user mentioned. Leave others as null.
- If the user says "unobservable", "unavailable", "can't see", or similar → set satellite_available to false.
- If the user asks "why", "explain", or "reason" → use explain intent.
- If the user says "prioritize", "focus on", "weight" → use interpret intent.
- Return only the JSON object, no explanation, no markdown.
"""


# ── Explanation prompt ────────────────────────────────────────────────────────

def explanation_prompt(ranked: list[ZoneResult], target_zone_name: str | None) -> str:
    """Build a prompt asking Gemini to explain the recommendation."""
    recommended = next((r for r in ranked if r.is_recommended), None)

    if target_zone_name:
        # Try to find the specific zone the user asked about
        zone = next(
            (r for r in ranked if target_zone_name.lower() in r.wildfire_name.lower()),
            recommended,
        )
    else:
        zone = recommended

    if zone is None:
        return "No recommendation is currently available. Explain that no feasible zones exist."

    reasons_text = "\n".join(f"- {r}" for r in zone.reasons)

    context = f"""Current recommendation data:

Recommended Zone: {zone.wildfire_name}
Rank: {zone.rank} of {len(ranked)}
Emergency Priority: {zone.emergency_priority}/100
Satellite Feasibility: {zone.satellite_feasibility}/100
Final Score: {zone.final_score}/100
Observable: {"Yes" if zone.feasible else "No"}

Key reasons:
{reasons_text}

All zones ranked:
"""
    for r in ranked:
        obs = "OBSERVABLE" if r.feasible else "NOT OBSERVABLE"
        rec = " <-- RECOMMENDED" if r.is_recommended else ""
        context += f"  {r.rank}. {r.wildfire_name} — score {r.final_score} ({obs}){rec}\n"

    context += "\nProvide a concise explanation of why this zone was selected. Focus on the key factors. 2-4 sentences."
    return context


# ── Interpret / preference prompt ─────────────────────────────────────────────

def interpret_result_prompt(
    preference_description: str,
    original_recommendation: str | None,
    new_recommendation: str | None,
    ranked: list[ZoneResult],
) -> str:
    """Explain the result after applying a user preference."""
    changed = original_recommendation != new_recommendation
    zones_text = "\n".join(
        f"  {r.rank}. {r.wildfire_name} — score {r.final_score} "
        f"({'OBSERVABLE' if r.feasible else 'NOT OBSERVABLE'})"
        for r in ranked
    )

    return f"""The operator requested: "{preference_description}"

The system re-evaluated all zones with this preference applied.

Original recommendation: {original_recommendation or "None"}
New recommendation: {new_recommendation or "None"}
Recommendation changed: {"Yes" if changed else "No"}

Updated ranking:
{zones_text}

Explain in 2-3 sentences what changed and why, based on the operator's preference.
"""


# ── What-If result prompt ─────────────────────────────────────────────────────

def what_if_result_prompt(
    scenario_description: str,
    original_recommendation: str | None,
    new_recommendation: str | None,
    changes: list[str],
    reasons: list[str],
    ranked: list[ZoneResult],
) -> str:
    """Explain the result of a What-If scenario."""
    changes_text = "\n".join(f"- {c}" for c in changes) if changes else "- No changes applied"
    reasons_text = "\n".join(f"- {r}" for r in reasons) if reasons else "- No explanation available"
    zones_text = "\n".join(
        f"  {r.rank}. {r.wildfire_name} — score {r.final_score} "
        f"({'OBSERVABLE' if r.feasible else 'NOT OBSERVABLE'})"
        for r in ranked
    )

    return f"""What-If scenario: "{scenario_description}"

Changes applied:
{changes_text}

System analysis:
{reasons_text}

Original recommendation: {original_recommendation or "None"}
New recommendation: {new_recommendation or "None"}

New ranking:
{zones_text}

Explain in 2-3 sentences what happened and what the operator should do next.
"""
