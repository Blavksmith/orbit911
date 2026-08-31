from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Wildfire(Base):
    """
    Represents a wildfire zone that may require satellite observation.

    Severity, growth, and impact fields are normalized 0–100 scores used
    later by the decision engine.  Raw measurements (population count, lat/lon)
    are stored as-is to preserve the source data.
    """

    __tablename__ = "wildfires"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Geographic location
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    # Fire characteristics (0–100 normalized scores)
    severity: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Fire intensity score, 0 (low) – 100 (extreme)",
    )
    fire_growth_rate: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Rate of fire spread score, 0–100",
    )
    detection_recency_hours: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Hours since fire was last detected / confirmed",
    )

    # Human impact
    population_exposed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Estimated number of people in the affected area",
    )
    hospital_risk: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        comment="Risk score for nearby hospitals, 0–100",
    )
    critical_infrastructure_risk: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        comment="Risk score for critical infrastructure (power, water, etc.), 0–100",
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("severity >= 0 AND severity <= 100", name="ck_wildfire_severity"),
        CheckConstraint("fire_growth_rate >= 0 AND fire_growth_rate <= 100", name="ck_wildfire_growth"),
        CheckConstraint("hospital_risk >= 0 AND hospital_risk <= 100", name="ck_wildfire_hospital_risk"),
        CheckConstraint(
            "critical_infrastructure_risk >= 0 AND critical_infrastructure_risk <= 100",
            name="ck_wildfire_infra_risk",
        ),
    )

    def __repr__(self) -> str:
        return f"<Wildfire id={self.id} name={self.name!r} severity={self.severity}>"
