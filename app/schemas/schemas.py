from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Wildfire ──────────────────────────────────────────────────────────────────

class WildfireBase(BaseModel):
    name: str = Field(..., max_length=100)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    severity: float = Field(..., ge=0, le=100)
    fire_growth_rate: float = Field(..., ge=0, le=100)
    detection_recency_hours: float = Field(..., ge=0)
    population_exposed: int = Field(default=0, ge=0)
    hospital_risk: float = Field(default=0.0, ge=0, le=100)
    critical_infrastructure_risk: float = Field(default=0.0, ge=0, le=100)


class WildfireCreate(WildfireBase):
    pass


class WildfireRead(WildfireBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Satellite ─────────────────────────────────────────────────────────────────

class SatelliteBase(BaseModel):
    name: str = Field(..., max_length=100)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    is_available: bool = True
    visibility_score: float = Field(default=100.0, ge=0, le=100)
    observation_window_minutes: float = Field(default=0.0, ge=0)
    battery_level: float = Field(default=100.0, ge=0, le=100)


class SatelliteCreate(SatelliteBase):
    pass


class SatelliteRead(SatelliteBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Observation Opportunity ───────────────────────────────────────────────────

class ObservationOpportunityBase(BaseModel):
    wildfire_id: int
    satellite_id: int
    visibility_score: float = Field(..., ge=0, le=100)
    observation_window_minutes: float = Field(..., ge=0)
    is_available: bool = True


class ObservationOpportunityCreate(ObservationOpportunityBase):
    pass


class ObservationOpportunityRead(ObservationOpportunityBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Recommendation API response models ───────────────────────────────────────

class PriorityBreakdownResponse(BaseModel):
    """Sub-score breakdown for the priority calculation."""
    human_impact: float
    fire_severity: float
    urgency: float
    infrastructure: float
    time_sensitivity: float


class FeasibilityBreakdownResponse(BaseModel):
    """Sub-score breakdown for the feasibility calculation."""
    visibility_score: float
    window_score: float
    availability_score: float


class ZoneRankingItem(BaseModel):
    """One ranked zone in the recommendation response."""
    rank: int
    wildfire_id: int
    wildfire_name: str
    emergency_priority: float
    satellite_feasibility: float
    final_score: float
    feasible: bool
    is_recommended: bool
    reasons: list[str]
    priority_breakdown: PriorityBreakdownResponse
    feasibility_breakdown: FeasibilityBreakdownResponse


class RecommendationDetail(BaseModel):
    """Detail block for the single recommended target."""
    emergency_priority: float
    satellite_feasibility: float
    final_score: float
    reasons: list[str]


class RecommendationResponse(BaseModel):
    """Full recommendation response returned by GET /api/recommendation."""
    recommended_target: Optional[str]          # wildfire name, or None if all infeasible
    recommended_wildfire_id: Optional[int]     # wildfire id for map highlighting
    recommendation: Optional[RecommendationDetail]
    ranking: list[ZoneRankingItem]
    total_zones: int
    feasible_zones: int


class ObservationConfirmationRequest(BaseModel):
    """Simulated tasking request for a recommended observation."""
    wildfire_id: int = Field(..., gt=0)
    satellite_id: int = Field(..., gt=0)


class ObservationConfirmationResponse(BaseModel):
    """Result of queuing a simulated observation."""
    status: str
    wildfire_id: int
    satellite_id: int
    message: str


# ── What-If schemas ───────────────────────────────────────────────────────────

class WildfireOverride(BaseModel):
    """
    Temporary overrides for a single wildfire zone's fields.
    Only provided fields are changed; omitted fields keep their stored values.
    All numeric fields use the same 0–100 scale as the model.
    """
    severity: Optional[float] = Field(default=None, ge=0, le=100)
    fire_growth_rate: Optional[float] = Field(default=None, ge=0, le=100)
    detection_recency_hours: Optional[float] = Field(default=None, ge=0)
    population_exposed: Optional[int] = Field(default=None, ge=0)
    hospital_risk: Optional[float] = Field(default=None, ge=0, le=100)
    critical_infrastructure_risk: Optional[float] = Field(default=None, ge=0, le=100)


class OpportunityOverride(BaseModel):
    """
    Temporary overrides for a wildfire's best observation opportunity.
    Setting is_available=False simulates the satellite becoming unavailable.
    """
    visibility_score: Optional[float] = Field(default=None, ge=0, le=100)
    observation_window_minutes: Optional[float] = Field(default=None, ge=0)
    is_available: Optional[bool] = None


class ZoneOverride(BaseModel):
    """Combined overrides for one wildfire zone (wildfire fields + opportunity fields)."""
    wildfire: Optional[WildfireOverride] = None
    opportunity: Optional[OpportunityOverride] = None


class WhatIfRequest(BaseModel):
    """
    Request body for POST /api/recommendation/what-if.

    `overrides` maps wildfire_id (as a string key) to the changes to apply.

    Example — make Zone B unobservable:
        { "overrides": { "2": { "opportunity": { "is_available": false } } } }

    Example — increase Zone B fire growth and hospital risk:
        { "overrides": { "2": { "wildfire": { "fire_growth_rate": 100, "hospital_risk": 100 } } } }
    """
    overrides: dict[str, ZoneOverride] = Field(
        default_factory=dict,
        description="Map of wildfire_id (string) → ZoneOverride with temporary changes.",
    )


class ScoreChange(BaseModel):
    """Before/after score comparison for one zone."""
    wildfire_id: int
    wildfire_name: str
    original_emergency_priority: float
    new_emergency_priority: float
    original_satellite_feasibility: float
    new_satellite_feasibility: float
    original_final_score: float
    new_final_score: float
    original_feasible: bool
    new_feasible: bool


class WhatIfResponse(BaseModel):
    """
    Response for POST /api/recommendation/what-if.

    Contains the original recommendation, the new recommendation after applying
    the overrides, a per-zone score comparison, and a plain-English explanation
    of what changed and why.
    """
    # Recommendations
    original_recommendation: Optional[str]
    original_wildfire_id: Optional[int]
    new_recommendation: Optional[str]
    new_wildfire_id: Optional[int]
    recommendation_changed: bool

    # Full rankings (before and after)
    original_ranking: list[ZoneRankingItem]
    new_ranking: list[ZoneRankingItem]

    # Applied overrides expressed as human-readable strings
    changes: list[str]

    # Explanation of why the recommendation changed (or didn't)
    reasons: list[str]

    # Per-zone score delta (only zones that actually changed)
    score_changes: list[ScoreChange]
