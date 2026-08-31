from datetime import datetime

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
