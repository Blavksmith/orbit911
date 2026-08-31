from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ObservationOpportunity(Base):
    """
    Represents a potential satellite observation of a wildfire zone.

    An opportunity is created when a satellite *could* observe a wildfire
    (based on orbit geometry, window availability, etc.).  The decision engine
    will later score these opportunities and recommend the best one.

    Visibility, window, and availability are stored here because they may
    differ per satellite–wildfire pair and can be simulated independently of
    the satellite's global state.
    """

    __tablename__ = "observation_opportunities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Relationships
    wildfire_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("wildfires.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    satellite_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("satellites.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    wildfire: Mapped["Wildfire"] = relationship("Wildfire", lazy="select")  # noqa: F821
    satellite: Mapped["Satellite"] = relationship("Satellite", lazy="select")  # noqa: F821

    # Feasibility fields for this specific opportunity
    visibility_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Visibility quality for this satellite–wildfire pair, 0–100",
    )
    observation_window_minutes: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Available observation window in minutes for this opportunity",
    )
    is_available: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether this opportunity is currently actionable",
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "visibility_score >= 0 AND visibility_score <= 100",
            name="ck_opportunity_visibility",
        ),
        CheckConstraint(
            "observation_window_minutes >= 0",
            name="ck_opportunity_obs_window",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<ObservationOpportunity id={self.id} "
            f"wildfire_id={self.wildfire_id} satellite_id={self.satellite_id} "
            f"available={self.is_available}>"
        )
