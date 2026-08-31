"""
seed.py
=======
Populates the database with realistic demo data for Orbit911.

Run once before starting the server for the first time:

    python seed.py

Safe to re-run — clears existing data first.
"""

from app.database import SessionLocal, Base, engine
from app.models import Wildfire, Satellite, ObservationOpportunity

Base.metadata.create_all(bind=engine)


WILDFIRES = [
    dict(
        name="Zone B — Ridgecrest",
        latitude=35.62, longitude=-117.67,
        severity=90.0,
        fire_growth_rate=80.0,
        detection_recency_hours=1.0,
        population_exposed=42_000,
        hospital_risk=90.0,
        critical_infrastructure_risk=70.0,
    ),
    dict(
        name="Zone A — Antelope Valley",
        latitude=34.73, longitude=-118.15,
        severity=65.0,
        fire_growth_rate=50.0,
        detection_recency_hours=4.0,
        population_exposed=15_000,
        hospital_risk=40.0,
        critical_infrastructure_risk=30.0,
    ),
    dict(
        name="Zone C — Tehachapi",
        latitude=35.13, longitude=-118.45,
        severity=45.0,
        fire_growth_rate=30.0,
        detection_recency_hours=8.0,
        population_exposed=5_000,
        hospital_risk=10.0,
        critical_infrastructure_risk=10.0,
    ),
    dict(
        name="Zone D — Mojave Outskirts",
        latitude=35.05, longitude=-118.17,
        severity=30.0,
        fire_growth_rate=15.0,
        detection_recency_hours=12.0,
        population_exposed=2_000,
        hospital_risk=5.0,
        critical_infrastructure_risk=5.0,
    ),
]

SATELLITES = [
    dict(
        name="SAT-1 (EO-Alpha)",
        latitude=35.50, longitude=-117.80,
        is_available=True,
        visibility_score=95.0,
        observation_window_minutes=12.0,
        battery_level=88.0,
    ),
    dict(
        name="SAT-2 (EO-Beta)",
        latitude=34.90, longitude=-118.20,
        is_available=True,
        visibility_score=80.0,
        observation_window_minutes=18.0,
        battery_level=72.0,
    ),
    dict(
        name="SAT-3 (EO-Gamma)",
        latitude=35.10, longitude=-118.50,
        is_available=False,
        visibility_score=60.0,
        observation_window_minutes=0.0,
        battery_level=15.0,
    ),
]

# (wildfire_index, satellite_index, visibility, window_minutes, is_available)
OPPORTUNITIES = [
    # Zone B — best opportunity: SAT-1 has clear line of sight
    (0, 0, 95.0, 12.0, True),
    # Zone A — SAT-2 covers it
    (1, 1, 80.0, 18.0, True),
    # Zone C — SAT-2 also covers it (lower window left)
    (2, 1, 70.0, 14.0, True),
    # Zone D — only SAT-3 in range, but SAT-3 is unavailable
    (3, 2, 60.0, 0.0, False),
]


def seed():
    db = SessionLocal()
    try:
        # Clear existing data in dependency order
        db.query(ObservationOpportunity).delete()
        db.query(Wildfire).delete()
        db.query(Satellite).delete()
        db.commit()

        # Insert wildfires
        wildfire_objs = [Wildfire(**data) for data in WILDFIRES]
        db.add_all(wildfire_objs)
        db.commit()
        for wf in wildfire_objs:
            db.refresh(wf)

        # Insert satellites
        satellite_objs = [Satellite(**data) for data in SATELLITES]
        db.add_all(satellite_objs)
        db.commit()
        for sat in satellite_objs:
            db.refresh(sat)

        # Insert opportunities
        opp_objs = [
            ObservationOpportunity(
                wildfire_id=wildfire_objs[wf_i].id,
                satellite_id=satellite_objs[sat_i].id,
                visibility_score=vis,
                observation_window_minutes=window,
                is_available=avail,
            )
            for wf_i, sat_i, vis, window, avail in OPPORTUNITIES
        ]
        db.add_all(opp_objs)
        db.commit()

        print(f"[OK] Seeded {len(wildfire_objs)} wildfires, "
              f"{len(satellite_objs)} satellites, "
              f"{len(opp_objs)} observation opportunities.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
