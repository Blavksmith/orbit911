"""
Tests for the Feasibility Engine.
"""

import pytest
from app.engine.feasibility_engine import (
    calculate_feasibility,
    _window_to_score,
    _window_to_time_sensitivity,
    MIN_WINDOW_MINUTES,
    MAX_WINDOW_MINUTES,
)


# ── Window score normalisation ────────────────────────────────────────────────

def test_zero_window_scores_zero():
    assert _window_to_score(0.0) == 0.0


def test_window_at_max_scores_100():
    assert _window_to_score(MAX_WINDOW_MINUTES) == 100.0


def test_window_above_max_clamped():
    assert _window_to_score(MAX_WINDOW_MINUTES * 2) == 100.0


def test_time_sensitivity_short_window_is_high():
    """A very short window should produce high time sensitivity."""
    score = _window_to_time_sensitivity(2.0)
    assert score >= 80.0


def test_time_sensitivity_long_window_is_low():
    """A long window means lower time pressure."""
    score = _window_to_time_sensitivity(MAX_WINDOW_MINUTES)
    assert score == 0.0


# ── Unavailable satellite ─────────────────────────────────────────────────────

def test_unavailable_satellite_is_not_feasible():
    result = calculate_feasibility(
        visibility_score=95.0,
        observation_window_minutes=15.0,
        is_available=False,
    )
    assert result.feasible is False
    assert result.satellite_feasibility == 0.0


def test_unavailable_satellite_reason():
    result = calculate_feasibility(
        visibility_score=95.0,
        observation_window_minutes=15.0,
        is_available=False,
    )
    assert any("not available" in r.lower() for r in result.reasons)


# ── Zero window ───────────────────────────────────────────────────────────────

def test_zero_window_is_not_feasible():
    result = calculate_feasibility(
        visibility_score=100.0,
        observation_window_minutes=0.0,
        is_available=True,
    )
    assert result.feasible is False


# ── Good opportunity ──────────────────────────────────────────────────────────

def test_good_opportunity_is_feasible():
    result = calculate_feasibility(
        visibility_score=90.0,
        observation_window_minutes=15.0,
        is_available=True,
    )
    assert result.feasible is True
    assert result.satellite_feasibility > 70.0


def test_feasibility_score_in_range():
    result = calculate_feasibility(
        visibility_score=80.0,
        observation_window_minutes=10.0,
        is_available=True,
    )
    assert 0.0 <= result.satellite_feasibility <= 100.0


def test_high_visibility_scores_higher_than_low():
    high = calculate_feasibility(
        visibility_score=100.0,
        observation_window_minutes=15.0,
        is_available=True,
    )
    low = calculate_feasibility(
        visibility_score=20.0,
        observation_window_minutes=15.0,
        is_available=True,
    )
    assert high.satellite_feasibility > low.satellite_feasibility


def test_deterministic():
    a = calculate_feasibility(
        visibility_score=85.0,
        observation_window_minutes=12.0,
        is_available=True,
    )
    b = calculate_feasibility(
        visibility_score=85.0,
        observation_window_minutes=12.0,
        is_available=True,
    )
    assert a.satellite_feasibility == b.satellite_feasibility
