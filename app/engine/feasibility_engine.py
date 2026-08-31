"""
feasibility_engine.py
=====================
Calculates the Satellite Feasibility Score (0–100) for an observation
opportunity.

A feasibility score represents how practical it is for a satellite to observe
a wildfire zone right now.  It is derived from three factors:

    Feasibility = (visibility_weight × visibility_score
                   + window_weight   × window_score
                   + avail_weight    × availability_score) / 100

If the opportunity is marked unavailable, the feasibility score is 0 and the
opportunity is flagged as not feasible.

Window normalisation
--------------------
A very short window (< MIN_WINDOW_MINUTES) is considered barely usable.
A window >= MAX_WINDOW_MINUTES is considered ideal (100).
Values between are linearly scaled.
"""

from dataclasses import dataclass

# Sub-factor weights (must sum to 1.0)
WEIGHT_VISIBILITY = 0.50
WEIGHT_WINDOW = 0.30
WEIGHT_AVAILABILITY = 0.20

# Window normalisation bounds (minutes)
MIN_WINDOW_MINUTES = 1.0    # Below this → score 0
MAX_WINDOW_MINUTES = 20.0   # Above this → score 100


@dataclass(frozen=True)
class FeasibilityBreakdown:
    """Breakdown of satellite feasibility for one observation opportunity."""

    visibility_score: float       # 0–100 (as provided)
    window_score: float           # 0–100 (normalised from minutes)
    availability_score: float     # 0 or 100
    satellite_feasibility: float  # 0–100 (weighted total)
    feasible: bool                # True if the opportunity is actionable
    time_sensitivity: float       # 0–100 — urgency driven by window length,
                                  # fed back into priority engine
    reasons: list[str]


def _window_to_score(window_minutes: float) -> float:
    """Normalise observation window length to 0–100."""
    if window_minutes <= 0:
        return 0.0
    if window_minutes >= MAX_WINDOW_MINUTES:
        return 100.0
    return (window_minutes - MIN_WINDOW_MINUTES) / (MAX_WINDOW_MINUTES - MIN_WINDOW_MINUTES) * 100.0


def _window_to_time_sensitivity(window_minutes: float) -> float:
    """
    Derive a Time Sensitivity score from the window length.

    Short windows are *more* time-sensitive (act now or lose the opportunity).
    Inverts the window score so a short window → high sensitivity.
    """
    return max(0.0, 100.0 - _window_to_score(window_minutes))


def calculate_feasibility(
    *,
    visibility_score: float,
    observation_window_minutes: float,
    is_available: bool,
) -> FeasibilityBreakdown:
    """
    Calculate the Satellite Feasibility Score for one observation opportunity.

    Parameters
    ----------
    visibility_score             : Visibility quality, 0–100.
    observation_window_minutes   : Minutes remaining in the observation window.
    is_available                 : Whether the satellite/opportunity is actionable.

    Returns
    -------
    FeasibilityBreakdown with sub-scores, the weighted total, feasibility flag,
    and time-sensitivity score.
    """
    reasons: list[str] = []

    # Hard gate: unavailable satellite → infeasible immediately
    if not is_available:
        reasons.append("Satellite not available for tasking")
        return FeasibilityBreakdown(
            visibility_score=visibility_score,
            window_score=0.0,
            availability_score=0.0,
            satellite_feasibility=0.0,
            feasible=False,
            time_sensitivity=0.0,
            reasons=reasons,
        )

    window_score = _window_to_score(observation_window_minutes)
    avail_score = 100.0
    time_sensitivity = _window_to_time_sensitivity(observation_window_minutes)

    satellite_feasibility = (
        WEIGHT_VISIBILITY * visibility_score
        + WEIGHT_WINDOW * window_score
        + WEIGHT_AVAILABILITY * avail_score
    )
    # Clamp to 0–100
    satellite_feasibility = max(0.0, min(100.0, satellite_feasibility))

    # Feasibility gate: window must exist at all
    feasible = observation_window_minutes > 0 and visibility_score > 0

    # ── Reasons ───────────────────────────────────────────────────────────────
    if visibility_score >= 80:
        reasons.append("Good satellite visibility")
    elif visibility_score >= 50:
        reasons.append("Moderate satellite visibility")
    else:
        reasons.append("Poor satellite visibility")

    if observation_window_minutes <= 0:
        reasons.append("No observation window available")
    elif observation_window_minutes <= 5:
        reasons.append(f"Short observation window ({observation_window_minutes:.0f} min) — act now")
    elif observation_window_minutes <= 10:
        reasons.append(f"Narrow observation window ({observation_window_minutes:.0f} min)")
    else:
        reasons.append(f"Adequate observation window ({observation_window_minutes:.0f} min)")

    return FeasibilityBreakdown(
        visibility_score=round(visibility_score, 2),
        window_score=round(window_score, 2),
        availability_score=round(avail_score, 2),
        satellite_feasibility=round(satellite_feasibility, 2),
        feasible=feasible,
        time_sensitivity=round(time_sensitivity, 2),
        reasons=reasons,
    )
