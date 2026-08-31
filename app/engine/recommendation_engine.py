"""
recommendation_engine.py
========================
Combines the priority and feasibility engines to produce a ranked list of
observation recommendations.

Final Score formula (PRD §6):
    Final Score = Emergency Priority × Satellite Feasibility / 100

The highest-scoring *feasible* zone is the recommended observation target.
Infeasible zones are still ranked (for transparency) but marked as not
recommended.

This module is intentionally decoupled from FastAPI — it works purely on
plain Python dataclasses so it can be tested and extended without a running
server.
"""

from dataclasses import dataclass, field

from app.engine.feasibility_engine import FeasibilityBreakdown, calculate_feasibility
from app.engine.priority_engine import PriorityBreakdown, calculate_priority


@dataclass(frozen=True)
class ZoneInput:
    """
    All data needed to score a single wildfire zone / observation opportunity.
    Pass one of these per zone into `rank_zones`.
    """

    # Wildfire identity
    wildfire_id: int
    wildfire_name: str

    # Wildfire fields
    severity: float
    fire_growth_rate: float
    detection_recency_hours: float
    population_exposed: int
    hospital_risk: float
    critical_infrastructure_risk: float

    # Opportunity fields
    visibility_score: float
    observation_window_minutes: float
    is_available: bool


@dataclass
class ZoneResult:
    """Scored result for a single zone, ready to be returned by the API."""

    wildfire_id: int
    wildfire_name: str

    emergency_priority: float
    satellite_feasibility: float
    final_score: float
    feasible: bool

    # Full breakdowns (for detailed inspection / debugging)
    priority_breakdown: PriorityBreakdown
    feasibility_breakdown: FeasibilityBreakdown

    # Merged reason list (priority + feasibility)
    reasons: list[str] = field(default_factory=list)

    # Rank position among all zones (1 = highest, set after sorting)
    rank: int = 0

    # True only for the single top-ranked feasible zone
    is_recommended: bool = False


def score_zone(zone: ZoneInput) -> ZoneResult:
    """
    Score one wildfire zone against its observation opportunity.

    1. Calculate feasibility first so time_sensitivity can feed into priority.
    2. Calculate emergency priority (with time_sensitivity from step 1).
    3. Compute final score.
    4. Merge reasons from both engines.
    """
    feasibility = calculate_feasibility(
        visibility_score=zone.visibility_score,
        observation_window_minutes=zone.observation_window_minutes,
        is_available=zone.is_available,
    )

    priority = calculate_priority(
        severity=zone.severity,
        fire_growth_rate=zone.fire_growth_rate,
        detection_recency_hours=zone.detection_recency_hours,
        population_exposed=zone.population_exposed,
        hospital_risk=zone.hospital_risk,
        critical_infrastructure_risk=zone.critical_infrastructure_risk,
        time_sensitivity=feasibility.time_sensitivity,
    )

    final_score = round(
        priority.emergency_priority * feasibility.satellite_feasibility / 100,
        2,
    )

    # Merge reasons: priority reasons first, then feasibility reasons
    reasons = priority.reasons + feasibility.reasons

    return ZoneResult(
        wildfire_id=zone.wildfire_id,
        wildfire_name=zone.wildfire_name,
        emergency_priority=priority.emergency_priority,
        satellite_feasibility=feasibility.satellite_feasibility,
        final_score=final_score,
        feasible=feasibility.feasible,
        priority_breakdown=priority,
        feasibility_breakdown=feasibility,
        reasons=reasons,
    )


def rank_zones(zones: list[ZoneInput]) -> list[ZoneResult]:
    """
    Score and rank all provided wildfire zones.

    Feasible zones are ranked first (by final_score descending).
    Infeasible zones follow (by emergency_priority descending, for
    transparency — they show what would be prioritised if a window opened).

    The top feasible zone is flagged `is_recommended = True`.

    Returns the full ranked list (all zones, feasible + infeasible).
    """
    results = [score_zone(z) for z in zones]

    feasible = sorted(
        [r for r in results if r.feasible],
        key=lambda r: r.final_score,
        reverse=True,
    )
    infeasible = sorted(
        [r for r in results if not r.feasible],
        key=lambda r: r.emergency_priority,
        reverse=True,
    )

    ranked = feasible + infeasible

    for position, result in enumerate(ranked, start=1):
        result.rank = position

    if feasible:
        feasible[0].is_recommended = True

    return ranked
