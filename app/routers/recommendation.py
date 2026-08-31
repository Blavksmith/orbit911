"""
recommendation router
=====================
GET  /api/recommendation                 — run the engine on current DB data
POST /api/recommendation/recalculate     — re-run (same logic; hook for What-If later)
POST /api/recommendation/what-if         — run engine with temporary overrides, compare results
"""

from dataclasses import replace as dataclass_replace
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.engine.recommendation_engine import ZoneInput, rank_zones, ZoneResult
from app.models import ObservationOpportunity, Satellite, Wildfire
from app.schemas import (
    FeasibilityBreakdownResponse,
    PriorityBreakdownResponse,
    RecommendationDetail,
    RecommendationResponse,
    ObservationConfirmationRequest,
    ObservationConfirmationResponse,
    ScoreChange,
    WhatIfRequest,
    WhatIfResponse,
    ZoneRankingItem,
)

router = APIRouter(prefix="/api/recommendation", tags=["recommendation"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _load_zone_inputs(db: Session) -> list[ZoneInput]:
    """
    Pull all observation opportunities (with their related wildfire) from the
    database and convert them into ZoneInput objects for the engine.

    Each opportunity represents one (wildfire, satellite) pair.  When a
    wildfire has multiple opportunities, only the best one is used — the one
    with the highest visibility_score that is also available.
    """
    opportunities: list[ObservationOpportunity] = (
        db.query(ObservationOpportunity)
        .all()
    )

    if not opportunities:
        return []

    # Group by wildfire_id; keep the best available opportunity per wildfire.
    # "Best" = highest visibility_score among available ones; if none available,
    # keep the first unavailable one (so it shows as infeasible in ranking).
    best: dict[int, ObservationOpportunity] = {}
    for opp in opportunities:
        wf_id = opp.wildfire_id
        if wf_id not in best:
            best[wf_id] = opp
        else:
            current = best[wf_id]
            # Prefer available over unavailable
            if opp.is_available and not current.is_available:
                best[wf_id] = opp
            # Among same availability, prefer higher visibility
            elif opp.is_available == current.is_available:
                if opp.visibility_score > current.visibility_score:
                    best[wf_id] = opp

    zone_inputs: list[ZoneInput] = []
    for opp in best.values():
        wf = opp.wildfire
        zone_inputs.append(
            ZoneInput(
                wildfire_id=wf.id,
                wildfire_name=wf.name,
                severity=wf.severity,
                fire_growth_rate=wf.fire_growth_rate,
                detection_recency_hours=wf.detection_recency_hours,
                population_exposed=wf.population_exposed,
                hospital_risk=wf.hospital_risk,
                critical_infrastructure_risk=wf.critical_infrastructure_risk,
                visibility_score=opp.visibility_score,
                observation_window_minutes=opp.observation_window_minutes,
                is_available=opp.is_available,
            )
        )

    return zone_inputs


def _build_response(ranked: list[ZoneResult]) -> RecommendationResponse:
    """Convert the engine's ZoneResult list into the API response model."""
    recommended = next((r for r in ranked if r.is_recommended), None)

    ranking_items = [
        ZoneRankingItem(
            rank=r.rank,
            wildfire_id=r.wildfire_id,
            wildfire_name=r.wildfire_name,
            emergency_priority=r.emergency_priority,
            satellite_feasibility=r.satellite_feasibility,
            final_score=r.final_score,
            feasible=r.feasible,
            is_recommended=r.is_recommended,
            reasons=r.reasons,
            priority_breakdown=PriorityBreakdownResponse(
                human_impact=r.priority_breakdown.human_impact,
                fire_severity=r.priority_breakdown.fire_severity,
                urgency=r.priority_breakdown.urgency,
                infrastructure=r.priority_breakdown.infrastructure,
                time_sensitivity=r.priority_breakdown.time_sensitivity,
            ),
            feasibility_breakdown=FeasibilityBreakdownResponse(
                visibility_score=r.feasibility_breakdown.visibility_score,
                window_score=r.feasibility_breakdown.window_score,
                availability_score=r.feasibility_breakdown.availability_score,
            ),
        )
        for r in ranked
    ]

    recommendation_detail = None
    if recommended:
        recommendation_detail = RecommendationDetail(
            emergency_priority=recommended.emergency_priority,
            satellite_feasibility=recommended.satellite_feasibility,
            final_score=recommended.final_score,
            reasons=recommended.reasons,
        )

    return RecommendationResponse(
        recommended_target=recommended.wildfire_name if recommended else None,
        recommended_wildfire_id=recommended.wildfire_id if recommended else None,
        recommendation=recommendation_detail,
        ranking=ranking_items,
        total_zones=len(ranked),
        feasible_zones=sum(1 for r in ranked if r.feasible),
    )


# ── endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=RecommendationResponse)
def get_recommendation(db: Session = Depends(get_db)):
    """
    Run the deterministic decision engine against the current database state
    and return the ranked recommendation.
    """
    zones = _load_zone_inputs(db)
    if not zones:
        raise HTTPException(
            status_code=404,
            detail="No observation opportunities found. Seed wildfire and satellite data first.",
        )
    ranked = rank_zones(zones)
    return _build_response(ranked)


@router.post("/recalculate", response_model=RecommendationResponse)
def recalculate_recommendation(db: Session = Depends(get_db)):
    """
    Re-run the deterministic decision engine using current stored data.
    Identical to GET /api/recommendation — kept as a stable endpoint for the frontend.
    """
    zones = _load_zone_inputs(db)
    if not zones:
        raise HTTPException(
            status_code=404,
            detail="No observation opportunities found. Seed wildfire and satellite data first.",
        )
    ranked = rank_zones(zones)
    return _build_response(ranked)


@router.post("/confirm", response_model=ObservationConfirmationResponse)
def confirm_observation(
    body: ObservationConfirmationRequest,
    db: Session = Depends(get_db),
):
    """Queue a simulated observation; no external satellite command is issued."""
    wildfire = db.get(Wildfire, body.wildfire_id)
    if wildfire is None:
        raise HTTPException(status_code=404, detail="Wildfire not found.")

    satellite = db.get(Satellite, body.satellite_id)
    if satellite is None:
        raise HTTPException(status_code=404, detail="Satellite not found.")
    if not satellite.is_available:
        raise HTTPException(status_code=409, detail="Satellite is not available for tasking.")

    zones = _load_zone_inputs(db)
    current_recommendation = next(
        (zone for zone in rank_zones(zones) if zone.is_recommended),
        None,
    )
    if current_recommendation is None or current_recommendation.wildfire_id != wildfire.id:
        raise HTTPException(
            status_code=409,
            detail="Selected wildfire is no longer the current recommended target.",
        )

    return ObservationConfirmationResponse(
        status="confirmed",
        wildfire_id=wildfire.id,
        satellite_id=satellite.id,
        message=f"Observation for {wildfire.name} confirmed and queued.",
    )


# ── What-If helpers ───────────────────────────────────────────────────────────

def _apply_overrides(zones: list[ZoneInput], request: WhatIfRequest) -> list[ZoneInput]:
    """
    Return a new list of ZoneInput with the requested overrides applied.

    Overrides are keyed by wildfire_id (string in JSON, cast to int here).
    Only fields explicitly set in the override are changed; all others keep
    their original values.  The original list is never mutated.
    """
    # Parse override keys to int once
    int_overrides: dict[int, "ZoneOverride"] = {}  # type: ignore[name-defined]
    for key, zone_override in request.overrides.items():
        try:
            int_overrides[int(key)] = zone_override
        except ValueError:
            pass  # silently skip malformed keys

    result: list[ZoneInput] = []
    for zone in zones:
        override = int_overrides.get(zone.wildfire_id)
        if override is None:
            result.append(zone)
            continue

        # Collect only the fields that were explicitly set
        changes: dict = {}

        if override.wildfire:
            wf = override.wildfire
            if wf.severity is not None:
                changes["severity"] = wf.severity
            if wf.fire_growth_rate is not None:
                changes["fire_growth_rate"] = wf.fire_growth_rate
            if wf.detection_recency_hours is not None:
                changes["detection_recency_hours"] = wf.detection_recency_hours
            if wf.population_exposed is not None:
                changes["population_exposed"] = wf.population_exposed
            if wf.hospital_risk is not None:
                changes["hospital_risk"] = wf.hospital_risk
            if wf.critical_infrastructure_risk is not None:
                changes["critical_infrastructure_risk"] = wf.critical_infrastructure_risk

        if override.opportunity:
            opp = override.opportunity
            if opp.visibility_score is not None:
                changes["visibility_score"] = opp.visibility_score
            if opp.observation_window_minutes is not None:
                changes["observation_window_minutes"] = opp.observation_window_minutes
            if opp.is_available is not None:
                changes["is_available"] = opp.is_available

        result.append(dataclass_replace(zone, **changes))

    return result


def _describe_overrides(
    original_zones: list[ZoneInput],
    modified_zones: list[ZoneInput],
) -> list[str]:
    """
    Compare original and modified ZoneInputs and return human-readable
    descriptions of every field that changed.
    """
    orig_by_id = {z.wildfire_id: z for z in original_zones}
    descriptions: list[str] = []

    field_labels = {
        "severity": "fire severity",
        "fire_growth_rate": "fire growth rate",
        "detection_recency_hours": "detection recency (hours)",
        "population_exposed": "population exposed",
        "hospital_risk": "hospital risk",
        "critical_infrastructure_risk": "critical infrastructure risk",
        "visibility_score": "satellite visibility",
        "observation_window_minutes": "observation window (minutes)",
        "is_available": "satellite availability",
    }

    for mod in modified_zones:
        orig = orig_by_id.get(mod.wildfire_id)
        if orig is None:
            continue
        for field, label in field_labels.items():
            orig_val = getattr(orig, field)
            mod_val = getattr(mod, field)
            if orig_val != mod_val:
                descriptions.append(
                    f"{mod.wildfire_name}: {label} changed from {orig_val} to {mod_val}"
                )

    return descriptions


def _explain_recommendation_change(
    original_ranked: list[ZoneResult],
    new_ranked: list[ZoneResult],
) -> list[str]:
    """
    Generate plain-English reasons explaining why the recommendation changed
    (or stayed the same).
    """
    orig_rec = next((r for r in original_ranked if r.is_recommended), None)
    new_rec = next((r for r in new_ranked if r.is_recommended), None)

    orig_name = orig_rec.wildfire_name if orig_rec else "None"
    new_name = new_rec.wildfire_name if new_rec else "None"

    reasons: list[str] = []

    if orig_name == new_name:
        reasons.append(f"{orig_name} remains the highest-scoring feasible target after the changes.")
        return reasons

    if orig_rec and not next(
        (r for r in new_ranked if r.wildfire_id == orig_rec.wildfire_id and r.feasible), None
    ):
        reasons.append(
            f"{orig_name} is no longer observable — satellite constraints block this zone."
        )

    if new_rec:
        reasons.append(
            f"{new_name} is now the highest-scoring feasible observation target "
            f"(final score: {new_rec.final_score})."
        )
    else:
        reasons.append("No feasible observation targets remain after the changes.")

    return reasons


def _build_score_changes(
    original_ranked: list[ZoneResult],
    new_ranked: list[ZoneResult],
    modified_wildfire_ids: set[int],
) -> list[ScoreChange]:
    """Return ScoreChange objects only for zones whose scores actually changed."""
    orig_by_id = {r.wildfire_id: r for r in original_ranked}
    new_by_id = {r.wildfire_id: r for r in new_ranked}

    changes: list[ScoreChange] = []
    for wf_id in modified_wildfire_ids:
        orig = orig_by_id.get(wf_id)
        new = new_by_id.get(wf_id)
        if orig is None or new is None:
            continue
        changes.append(
            ScoreChange(
                wildfire_id=wf_id,
                wildfire_name=orig.wildfire_name,
                original_emergency_priority=orig.emergency_priority,
                new_emergency_priority=new.emergency_priority,
                original_satellite_feasibility=orig.satellite_feasibility,
                new_satellite_feasibility=new.satellite_feasibility,
                original_final_score=orig.final_score,
                new_final_score=new.final_score,
                original_feasible=orig.feasible,
                new_feasible=new.feasible,
            )
        )
    return changes


# ── What-If endpoint ──────────────────────────────────────────────────────────

@router.post("/what-if", response_model=WhatIfResponse)
def what_if(body: WhatIfRequest, db: Session = Depends(get_db)):
    """
    Run the deterministic engine twice:
      1. Against the current stored data (baseline).
      2. Against the same data with the requested overrides applied in-memory.

    Stored database values are never modified.
    Returns a before-vs-after comparison with score changes and explanations.

    Key scenario:
      If the current top zone becomes unobservable in the What-If scenario,
      Orbit911 automatically identifies the next-best feasible alternative.
    """
    base_zones = _load_zone_inputs(db)
    if not base_zones:
        raise HTTPException(
            status_code=404,
            detail="No observation opportunities found. Seed wildfire and satellite data first.",
        )

    # Identify which wildfire IDs have overrides (for score-change reporting)
    modified_ids: set[int] = set()
    for key in body.overrides:
        try:
            modified_ids.add(int(key))
        except ValueError:
            pass

    # Baseline run
    original_ranked = rank_zones(base_zones)

    # What-If run — apply overrides to a fresh copy, never touch base_zones
    modified_zones = _apply_overrides(base_zones, body)
    new_ranked = rank_zones(modified_zones)

    # Derive response parts
    orig_rec = next((r for r in original_ranked if r.is_recommended), None)
    new_rec = next((r for r in new_ranked if r.is_recommended), None)

    change_descriptions = _describe_overrides(base_zones, modified_zones)
    explanation = _explain_recommendation_change(original_ranked, new_ranked)
    score_changes = _build_score_changes(original_ranked, new_ranked, modified_ids)

    return WhatIfResponse(
        original_recommendation=orig_rec.wildfire_name if orig_rec else None,
        original_wildfire_id=orig_rec.wildfire_id if orig_rec else None,
        new_recommendation=new_rec.wildfire_name if new_rec else None,
        new_wildfire_id=new_rec.wildfire_id if new_rec else None,
        recommendation_changed=(
            (orig_rec.wildfire_id if orig_rec else None)
            != (new_rec.wildfire_id if new_rec else None)
        ),
        original_ranking=_build_response(original_ranked).ranking,
        new_ranking=_build_response(new_ranked).ranking,
        changes=change_descriptions,
        reasons=explanation,
        score_changes=score_changes,
    )
