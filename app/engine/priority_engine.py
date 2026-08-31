"""
priority_engine.py
==================
Calculates the Emergency Priority Score (0–100) for a wildfire zone.

Formula (from PRD §6):
    Emergency Priority = 0.30 × Human Impact
                       + 0.25 × Fire Severity
                       + 0.20 × Urgency
                       + 0.15 × Infrastructure
                       + 0.10 × Time Sensitivity

All five sub-scores are normalised to 0–100 before weighting.

Factor derivations
------------------
Human Impact      — derived from population_exposed (capped at MAX_POPULATION)
                    + hospital_risk bonus
Fire Severity     — direct field: severity (already 0–100)
Urgency           — average of fire_growth_rate and staleness of detection
Infrastructure    — average of hospital_risk and critical_infrastructure_risk
Time Sensitivity  — supplied externally (observation-window urgency); defaults to 0
"""

from dataclasses import dataclass
from typing import Optional

# Approximate cap for normalising raw population count → 0–100.
# 100 000 people or more → score of 100.
MAX_POPULATION = 100_000

# Weights (must sum to 1.0)
WEIGHT_HUMAN_IMPACT = 0.30
WEIGHT_FIRE_SEVERITY = 0.25
WEIGHT_URGENCY = 0.20
WEIGHT_INFRASTRUCTURE = 0.15
WEIGHT_TIME_SENSITIVITY = 0.10


@dataclass(frozen=True)
class PriorityBreakdown:
    """Detailed breakdown of every factor that contributed to the priority score."""

    human_impact: float        # 0–100
    fire_severity: float       # 0–100
    urgency: float             # 0–100
    infrastructure: float      # 0–100
    time_sensitivity: float    # 0–100
    emergency_priority: float  # 0–100  (weighted total)

    # Human-readable reason strings generated alongside the score
    reasons: list[str]


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    """Clamp a value to [lo, hi]."""
    return max(lo, min(hi, value))


def _population_to_score(population: int) -> float:
    """Normalise raw population count to 0–100."""
    return _clamp(population / MAX_POPULATION * 100)


def _staleness_to_urgency(detection_recency_hours: float) -> float:
    """
    Convert hours since last detection into an urgency score.

    Logic: a fire detected very recently (< 1 h) is highly urgent because
    it is still actively confirmed.  A fire that has not been re-observed in
    24+ hours is also urgent because its state is unknown.  We model this as
    an inverted decaying urgency: recent AND stale both score high.

    For simplicity at MVP:
      0–2 h   → 100  (just detected, high urgency)
      2–12 h  → linearly decays from 100 → 40
      12–24 h → linearly decays from 40 → 60  (unknown state, risk rising)
      > 24 h  → 100  (information severely outdated)
    """
    h = detection_recency_hours
    if h <= 2:
        return 100.0
    if h <= 12:
        # 100 → 40 over 10 hours
        return 100.0 - (h - 2) / 10.0 * 60.0
    if h <= 24:
        # 40 → 60 over 12 hours
        return 40.0 + (h - 12) / 12.0 * 20.0
    # > 24 h — information severely outdated
    return 100.0


def calculate_priority(
    *,
    severity: float,
    fire_growth_rate: float,
    detection_recency_hours: float,
    population_exposed: int,
    hospital_risk: float,
    critical_infrastructure_risk: float,
    time_sensitivity: float = 0.0,
) -> PriorityBreakdown:
    """
    Calculate the Emergency Priority Score for a single wildfire zone.

    Parameters
    ----------
    severity                    : Fire intensity score, 0–100.
    fire_growth_rate            : Rate of spread score, 0–100.
    detection_recency_hours     : Hours since fire was last detected.
    population_exposed          : Raw headcount of people in the affected area.
    hospital_risk               : Hospital risk score, 0–100.
    critical_infrastructure_risk: Infrastructure risk score, 0–100.
    time_sensitivity            : Observation-window urgency score, 0–100.
                                  Supplied by the feasibility engine when
                                  combining scores; defaults to 0.

    Returns
    -------
    PriorityBreakdown with all sub-scores, the weighted total, and reasons.
    """
    # ── Sub-scores ────────────────────────────────────────────────────────────

    # Human Impact: population score blended with hospital risk
    pop_score = _population_to_score(population_exposed)
    human_impact = _clamp(pop_score * 0.7 + hospital_risk * 0.3)

    # Fire Severity: direct field
    fire_severity = _clamp(severity)

    # Urgency: growth rate + detection staleness, equally weighted
    staleness = _staleness_to_urgency(detection_recency_hours)
    urgency = _clamp((fire_growth_rate + staleness) / 2.0)

    # Infrastructure: hospital + critical infra, equally weighted
    infrastructure = _clamp((hospital_risk + critical_infrastructure_risk) / 2.0)

    # Time Sensitivity: supplied externally (observation-window urgency)
    time_sens = _clamp(time_sensitivity)

    # ── Weighted total ────────────────────────────────────────────────────────
    emergency_priority = _clamp(
        WEIGHT_HUMAN_IMPACT * human_impact
        + WEIGHT_FIRE_SEVERITY * fire_severity
        + WEIGHT_URGENCY * urgency
        + WEIGHT_INFRASTRUCTURE * infrastructure
        + WEIGHT_TIME_SENSITIVITY * time_sens
    )

    # ── Reasons ───────────────────────────────────────────────────────────────
    reasons: list[str] = []

    if fire_growth_rate >= 70:
        reasons.append("High fire growth rate")
    elif fire_growth_rate >= 40:
        reasons.append("Moderate fire growth rate")

    if pop_score >= 70:
        reasons.append(f"High population exposure ({population_exposed:,} people)")
    elif pop_score >= 30:
        reasons.append(f"Moderate population exposure ({population_exposed:,} people)")

    if hospital_risk >= 70:
        reasons.append("Hospital nearby — high risk")
    elif hospital_risk >= 40:
        reasons.append("Hospital nearby — moderate risk")

    if critical_infrastructure_risk >= 70:
        reasons.append("Critical infrastructure at high risk")
    elif critical_infrastructure_risk >= 40:
        reasons.append("Critical infrastructure at moderate risk")

    if severity >= 80:
        reasons.append("Extreme fire severity")
    elif severity >= 60:
        reasons.append("High fire severity")

    if detection_recency_hours <= 2:
        reasons.append("Recently confirmed active fire")
    elif detection_recency_hours > 24:
        reasons.append("Fire state unknown — last confirmed over 24 h ago")

    return PriorityBreakdown(
        human_impact=round(human_impact, 2),
        fire_severity=round(fire_severity, 2),
        urgency=round(urgency, 2),
        infrastructure=round(infrastructure, 2),
        time_sensitivity=round(time_sens, 2),
        emergency_priority=round(emergency_priority, 2),
        reasons=reasons,
    )
