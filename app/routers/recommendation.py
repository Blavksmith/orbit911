"""
recommendation router
=====================
GET  /api/recommendation              — run the engine on current DB data
POST /api/recommendation/recalculate  — re-run (same logic; hook for What-If later)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.engine.recommendation_engine import ZoneInput, rank_zones, ZoneResult
from app.models import ObservationOpportunity
from app.schemas import (
    FeasibilityBreakdownResponse,
    PriorityBreakdownResponse,
    RecommendationDetail,
    RecommendationResponse,
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

    Identical to GET /api/recommendation for now.
    This endpoint is the hook point for the What-If feature in the next step:
    a request body with overrides will be added there without changing this
    contract.
    """
    zones = _load_zone_inputs(db)
    if not zones:
        raise HTTPException(
            status_code=404,
            detail="No observation opportunities found. Seed wildfire and satellite data first.",
        )
    ranked = rank_zones(zones)
    return _build_response(ranked)
