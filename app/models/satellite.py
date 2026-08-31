from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Satellite(Base):
    """
    Represents an Earth-observation satellite.

    For the hackathon MVP, satellite positions and availability can be
    simulated.  The fields here reflect what the decision engine needs to
    assess whether an observation window is feasible.
    """

    __tablename__ = "satellites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)

    # Current orbital position
    latitude: Mapped[float] = mapped_column(
        Float, nullable=False, comment="Current sub-satellite latitude, -90 to 90"
    )
    longitude: Mapped[float] = mapped_column(
        Float, nullable=False, comment="Current sub-satellite longitude, -180 to 180"
    )

    # Operational status
    is_available: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether the satellite is currently available for tasking",
    )
    visibility_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=100.0,
        comment="Current visibility quality score, 0 (blocked) – 100 (clear)",
    )
    observation_window_minutes: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        comment="Minutes remaining in current observation window",
    )
    battery_level: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=100.0,
        comment="Battery charge percentage, 0–100",
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("latitude >= -90 AND latitude <= 90", name="ck_satellite_latitude"),
        CheckConstraint("longitude >= -180 AND longitude <= 180", name="ck_satellite_longitude"),
        CheckConstraint(
            "visibility_score >= 0 AND visibility_score <= 100",
            name="ck_satellite_visibility",
        ),
        CheckConstraint(
            "battery_level >= 0 AND battery_level <= 100",
            name="ck_satellite_battery",
        ),
        CheckConstraint(
            "observation_window_minutes >= 0",
            name="ck_satellite_obs_window",
        ),
    )

    def __repr__(self) -> str:
        return f"<Satellite id={self.id} name={self.name!r} available={self.is_available}>"
