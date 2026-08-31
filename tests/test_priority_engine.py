"""
Tests for the Priority Engine.

All inputs are chosen to produce deterministic, predictable outputs so
expected values can be hand-verified against the PRD formula.
"""

import pytest
from app.engine.priority_engine import (
    calculate_priority,
    _population_to_score,
    _staleness_to_urgency,
    MAX_POPULATION,
)


# ── Population normalisation ──────────────────────────────────────────────────

def test_population_zero_scores_zero():
    assert _population_to_score(0) == 0.0


def test_population_at_max_scores_100():
    assert _population_to_score(MAX_POPULATION) == 100.0


def test_population_above_max_clamped():
    assert _population_to_score(MAX_POPULATION * 2) == 100.0


def test_population_half_max_scores_50():
    assert _population_to_score(MAX_POPULATION // 2) == 50.0


# ── Staleness urgency curve ───────────────────────────────────────────────────

def test_staleness_recently_detected_is_high():
    """Fire detected 1 h ago → high urgency."""
    assert _staleness_to_urgency(1.0) == 100.0


def test_staleness_12h_is_minimum():
    """12 h mark is the minimum of the decay curve (~40)."""
    score = _staleness_to_urgency(12.0)
    assert 38.0 <= score <= 42.0


def test_staleness_over_24h_is_max():
    """Very stale fire (> 24 h) → urgency back to 100 (unknown state)."""
    assert _staleness_to_urgency(25.0) == 100.0


# ── Emergency Priority Score ─────────────────────────────────────────────────

# Shared high-severity input (mirrors PRD "Zone B" scenario)
HIGH_SEVERITY_ZONE = dict(
    severity=90.0,
    fire_growth_rate=80.0,
    detection_recency_hours=1.0,
    population_exposed=42_000,
    hospital_risk=90.0,
    critical_infrastructure_risk=70.0,
    time_sensitivity=80.0,
)


def test_high_severity_zone_scores_above_70():
    result = calculate_priority(**HIGH_SEVERITY_ZONE)
    assert result.emergency_priority >= 70.0


def test_low_severity_zone_scores_below_high():
    low_zone = dict(
        severity=20.0,
        fire_growth_rate=10.0,
        detection_recency_hours=6.0,
        population_exposed=500,
        hospital_risk=5.0,
        critical_infrastructure_risk=5.0,
    )
    high = calculate_priority(**HIGH_SEVERITY_ZONE)
    low = calculate_priority(**low_zone)
    assert high.emergency_priority > low.emergency_priority


def test_score_is_clamped_to_0_100():
    # Extreme values should not produce out-of-range scores
    result = calculate_priority(
        severity=100.0,
        fire_growth_rate=100.0,
        detection_recency_hours=0.0,
        population_exposed=MAX_POPULATION * 10,
        hospital_risk=100.0,
        critical_infrastructure_risk=100.0,
        time_sensitivity=100.0,
    )
    assert 0.0 <= result.emergency_priority <= 100.0


def test_zero_values_score_zero_or_near():
    result = calculate_priority(
        severity=0.0,
        fire_growth_rate=0.0,
        detection_recency_hours=0.0,
        population_exposed=0,
        hospital_risk=0.0,
        critical_infrastructure_risk=0.0,
        time_sensitivity=0.0,
    )
    # detection_recency=0 gives staleness=100, so urgency will be ~50 (0+100)/2
    # that means the score won't be 0, but it should still be low
    assert result.emergency_priority < 30.0


def test_reasons_populated_for_high_severity():
    result = calculate_priority(**HIGH_SEVERITY_ZONE)
    assert len(result.reasons) >= 3


def test_hospital_risk_reason_appears():
    result = calculate_priority(**HIGH_SEVERITY_ZONE)
    reason_text = " ".join(result.reasons).lower()
    assert "hospital" in reason_text


def test_sub_scores_are_in_range():
    result = calculate_priority(**HIGH_SEVERITY_ZONE)
    for score in (
        result.human_impact,
        result.fire_severity,
        result.urgency,
        result.infrastructure,
        result.time_sensitivity,
    ):
        assert 0.0 <= score <= 100.0


def test_deterministic_same_inputs_same_output():
    a = calculate_priority(**HIGH_SEVERITY_ZONE)
    b = calculate_priority(**HIGH_SEVERITY_ZONE)
    assert a.emergency_priority == b.emergency_priority
    assert a.reasons == b.reasons
