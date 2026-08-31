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
