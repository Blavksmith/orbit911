from sqlalchemy.orm import Session

from app.models import Wildfire, Satellite, ObservationOpportunity


def test_wildfire_model_create(create_tables):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as db:
        fire = Wildfire(
            name="Zone B",
            latitude=37.5,
            longitude=-119.5,
            severity=85.0,
            fire_growth_rate=70.0,
            detection_recency_hours=2.5,
            population_exposed=42000,
            hospital_risk=90.0,
            critical_infrastructure_risk=60.0,
        )
        db.add(fire)
        db.commit()
        db.refresh(fire)

        assert fire.id is not None
        assert fire.name == "Zone B"
        assert fire.severity == 85.0
        assert fire.population_exposed == 42000


def test_satellite_model_create(create_tables):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as db:
        sat = Satellite(
            name="SAT-1",
            latitude=38.0,
            longitude=-120.0,
            is_available=True,
            visibility_score=95.0,
            observation_window_minutes=12.0,
            battery_level=88.0,
        )
        db.add(sat)
        db.commit()
        db.refresh(sat)

        assert sat.id is not None
        assert sat.name == "SAT-1"
        assert sat.is_available is True


def test_observation_opportunity_model_create(create_tables):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as db:
        fire = Wildfire(
            name="Zone A",
            latitude=36.0,
            longitude=-118.0,
            severity=60.0,
            fire_growth_rate=40.0,
            detection_recency_hours=5.0,
            population_exposed=10000,
        )
        sat = Satellite(
            name="SAT-2",
            latitude=36.5,
            longitude=-118.5,
            observation_window_minutes=8.0,
        )
        db.add_all([fire, sat])
        db.commit()

        opp = ObservationOpportunity(
            wildfire_id=fire.id,
            satellite_id=sat.id,
            visibility_score=80.0,
            observation_window_minutes=8.0,
            is_available=True,
        )
        db.add(opp)
        db.commit()
        db.refresh(opp)

        assert opp.id is not None
        assert opp.wildfire_id == fire.id
        assert opp.satellite_id == sat.id
        assert opp.is_available is True
