"""
Tests for the Recommendation Engine.

Uses a fixed set of four zones that mirror the PRD example:
  Zone B — high severity, high population, hospital nearby → should rank #1
  Zone A — moderate severity
  Zone C — low severity
  Zone D — very low severity, infeasible (satellite unavailable)
"""

import pytest
from app.engine.recommendation_engine import ZoneInput, rank_zones, score_zone


# ── Shared test zones ─────────────────────────────────────────────────────────

ZONE_B = ZoneInput(
    wildfire_id=2, wildfire_name="Zone B",
    severity=90.0, fire_growth_rate=80.0, detection_recency_hours=1.0,
    population_exposed=42_000, hospital_risk=90.0, critical_infrastructure_risk=70.0,
    visibility_score=95.0, observation_window_minutes=12.0, is_available=True,
)

ZONE_A = ZoneInput(
    wildfire_id=1, wildfire_name="Zone A",
    severity=65.0, fire_growth_rate=50.0, detection_recency_hours=4.0,
    population_exposed=15_000, hospital_risk=40.0, critical_infrastructure_risk=30.0,
    visibility_score=80.0, observation_window_minutes=18.0, is_available=True,
)

ZONE_C = ZoneInput(
    wildfire_id=3, wildfire_name="Zone C",
    severity=45.0, fire_growth_rate=30.0, detection_recency_hours=8.0,
    population_exposed=5_000, hospital_risk=10.0, critical_infrastructure_risk=10.0,
    visibility_score=70.0, observation_window_minutes=14.0, is_available=True,
)

ZONE_D = ZoneInput(
    wildfire_id=4, wildfire_name="Zone D",
    severity=30.0, fire_growth_rate=15.0, detection_recency_hours=12.0,
    population_exposed=2_000, hospital_risk=5.0, critical_infrastructure_risk=5.0,
    visibility_score=0.0, observation_window_minutes=0.0, is_available=False,
)

ALL_ZONES = [ZONE_A, ZONE_B, ZONE_C, ZONE_D]


# ── score_zone tests ──────────────────────────────────────────────────────────

def test_score_zone_final_score_within_range():
    result = score_zone(ZONE_B)
    assert 0.0 <= result.final_score <= 100.0


def test_score_zone_final_score_formula():
    """Final Score = Emergency Priority × Satellite Feasibility / 100."""
    result = score_zone(ZONE_B)
    expected = round(result.emergency_priority * result.satellite_feasibility / 100, 2)
    assert result.final_score == expected


def test_score_zone_infeasible_has_zero_final_score():
    result = score_zone(ZONE_D)
    assert result.feasible is False
    assert result.final_score == 0.0


def test_score_zone_has_reasons():
    result = score_zone(ZONE_B)
    assert len(result.reasons) >= 2


# ── rank_zones tests ──────────────────────────────────────────────────────────

def test_zone_b_is_recommended():
    """Zone B should be top-ranked and recommended given its high scores."""
    ranked = rank_zones(ALL_ZONES)
    recommended = [r for r in ranked if r.is_recommended]
    assert len(recommended) == 1
    assert recommended[0].wildfire_name == "Zone B"


def test_infeasible_zone_is_not_recommended():
    ranked = rank_zones(ALL_ZONES)
    for result in ranked:
        if result.wildfire_name == "Zone D":
            assert result.is_recommended is False
            assert result.feasible is False


def test_ranks_are_sequential():
    ranked = rank_zones(ALL_ZONES)
    ranks = [r.rank for r in ranked]
    assert ranks == list(range(1, len(ranked) + 1))


def test_feasible_zones_ranked_before_infeasible():
    ranked = rank_zones(ALL_ZONES)
    feasible_ranks = [r.rank for r in ranked if r.feasible]
    infeasible_ranks = [r.rank for r in ranked if not r.feasible]
    if feasible_ranks and infeasible_ranks:
        assert max(feasible_ranks) < min(infeasible_ranks)


def test_all_zones_are_included_in_result():
    ranked = rank_zones(ALL_ZONES)
    assert len(ranked) == len(ALL_ZONES)


def test_only_single_zone_feasible_is_still_recommended():
    ranked = rank_zones([ZONE_D, ZONE_B])
    recommended = [r for r in ranked if r.is_recommended]
    assert len(recommended) == 1
    assert recommended[0].wildfire_name == "Zone B"


def test_all_infeasible_no_recommendation():
    zone_d2 = ZoneInput(
        wildfire_id=5, wildfire_name="Zone E",
        severity=50.0, fire_growth_rate=40.0, detection_recency_hours=3.0,
        population_exposed=10_000, hospital_risk=20.0, critical_infrastructure_risk=20.0,
        visibility_score=0.0, observation_window_minutes=0.0, is_available=False,
    )
    ranked = rank_zones([ZONE_D, zone_d2])
    recommended = [r for r in ranked if r.is_recommended]
    assert len(recommended) == 0


def test_deterministic_ranking():
    first = rank_zones(ALL_ZONES)
    second = rank_zones(ALL_ZONES)
    assert [r.wildfire_id for r in first] == [r.wildfire_id for r in second]
    assert [r.final_score for r in first] == [r.final_score for r in second]


def test_higher_severity_zone_ranks_above_lower():
    ranked = rank_zones(ALL_ZONES)
    rank_b = next(r.rank for r in ranked if r.wildfire_name == "Zone B")
    rank_c = next(r.rank for r in ranked if r.wildfire_name == "Zone C")
    assert rank_b < rank_c
