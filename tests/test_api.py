"""
API tests — wildfires, satellites, and recommendation endpoints.

Uses the in-memory SQLite test database defined in conftest.py.
Each test that needs data inserts its own fixtures so tests are independent.
"""

import pytest
from app.models import Wildfire, Satellite, ObservationOpportunity


# ── fixtures ──────────────────────────────────────────────────────────────────

def _make_wildfire(**kwargs) -> dict:
    defaults = dict(
        name="Test Fire",
        latitude=35.0, longitude=-118.0,
        severity=80.0,
        fire_growth_rate=70.0,
        detection_recency_hours=2.0,
        population_exposed=20_000,
        hospital_risk=60.0,
        critical_infrastructure_risk=50.0,
    )
    defaults.update(kwargs)
    return defaults


def _make_satellite(**kwargs) -> dict:
    defaults = dict(
        name="SAT-TEST",
        latitude=35.1, longitude=-118.1,
        is_available=True,
        visibility_score=90.0,
        observation_window_minutes=15.0,
        battery_level=85.0,
    )
    defaults.update(kwargs)
    return defaults


@pytest.fixture
def seeded_db(client):
    """
    Inserts one wildfire + one satellite + one opportunity into the test DB.
    Returns (wildfire_id, satellite_id) so tests can reference them.
    Uses the same TestingSessionLocal as conftest so tables are guaranteed to exist.
    """
    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        wf = Wildfire(**_make_wildfire(name="Zone B"))
        db.add(wf)
        db.flush()

        sat = Satellite(**_make_satellite(name="SAT-1"))
        db.add(sat)
        db.flush()

        opp = ObservationOpportunity(
            wildfire_id=wf.id,
            satellite_id=sat.id,
            visibility_score=90.0,
            observation_window_minutes=15.0,
            is_available=True,
        )
        db.add(opp)
        db.commit()
        db.refresh(wf)
        db.refresh(sat)

        wf_id, sat_id = wf.id, sat.id
    finally:
        db.close()

    yield wf_id, sat_id

    # Cleanup after test
    db = TestingSessionLocal()
    try:
        db.query(ObservationOpportunity).delete()
        db.query(Wildfire).delete()
        db.query(Satellite).delete()
        db.commit()
    finally:
        db.close()


# ── GET /api/wildfires ────────────────────────────────────────────────────────

def test_list_wildfires_empty(client):
    response = client.get("/api/wildfires")
    assert response.status_code == 200
    assert response.json() == []


def test_list_wildfires_returns_inserted(client, seeded_db):
    response = client.get("/api/wildfires")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    names = [wf["name"] for wf in data]
    assert "Zone B" in names


def test_list_wildfires_fields(client, seeded_db):
    response = client.get("/api/wildfires")
    item = response.json()[0]
    for field in ("id", "name", "latitude", "longitude", "severity",
                  "fire_growth_rate", "detection_recency_hours",
                  "population_exposed", "hospital_risk",
                  "critical_infrastructure_risk"):
        assert field in item, f"Missing field: {field}"


# ── GET /api/wildfires/{id} ───────────────────────────────────────────────────

def test_get_wildfire_by_id(client, seeded_db):
    wf_id, _ = seeded_db
    response = client.get(f"/api/wildfires/{wf_id}")
    assert response.status_code == 200
    assert response.json()["id"] == wf_id
    assert response.json()["name"] == "Zone B"


def test_get_wildfire_not_found(client):
    response = client.get("/api/wildfires/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ── GET /api/satellites ───────────────────────────────────────────────────────

def test_list_satellites_empty(client):
    response = client.get("/api/satellites")
    assert response.status_code == 200
    assert response.json() == []


def test_list_satellites_returns_inserted(client, seeded_db):
    response = client.get("/api/satellites")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    names = [s["name"] for s in data]
    assert "SAT-1" in names


def test_list_satellites_fields(client, seeded_db):
    response = client.get("/api/satellites")
    item = response.json()[0]
    for field in ("id", "name", "latitude", "longitude", "is_available",
                  "visibility_score", "observation_window_minutes", "battery_level"):
        assert field in item, f"Missing field: {field}"


def test_get_satellite_not_found(client):
    response = client.get("/api/satellites/99999")
    assert response.status_code == 404


# ── GET /api/recommendation ───────────────────────────────────────────────────

def test_recommendation_no_data_returns_404(client):
    response = client.get("/api/recommendation")
    assert response.status_code == 404


def test_recommendation_returns_200_with_data(client, seeded_db):
    response = client.get("/api/recommendation")
    assert response.status_code == 200


def test_recommendation_response_structure(client, seeded_db):
    response = client.get("/api/recommendation")
    body = response.json()
    for field in ("recommended_target", "recommended_wildfire_id",
                  "recommendation", "ranking", "total_zones", "feasible_zones"):
        assert field in body, f"Missing top-level field: {field}"


def test_recommendation_has_ranked_zones(client, seeded_db):
    response = client.get("/api/recommendation")
    body = response.json()
    assert len(body["ranking"]) >= 1


def test_recommendation_target_is_zone_b(client, seeded_db):
    response = client.get("/api/recommendation")
    body = response.json()
    assert body["recommended_target"] == "Zone B"


def test_recommendation_detail_fields(client, seeded_db):
    response = client.get("/api/recommendation")
    detail = response.json()["recommendation"]
    assert detail is not None
    for field in ("emergency_priority", "satellite_feasibility", "final_score", "reasons"):
        assert field in detail


def test_recommendation_reasons_not_empty(client, seeded_db):
    response = client.get("/api/recommendation")
    reasons = response.json()["recommendation"]["reasons"]
    assert isinstance(reasons, list)
    assert len(reasons) >= 1


def test_ranking_item_fields(client, seeded_db):
    response = client.get("/api/recommendation")
    item = response.json()["ranking"][0]
    for field in ("rank", "wildfire_id", "wildfire_name", "emergency_priority",
                  "satellite_feasibility", "final_score", "feasible",
                  "is_recommended", "reasons",
                  "priority_breakdown", "feasibility_breakdown"):
        assert field in item, f"Missing ranking field: {field}"


def test_ranking_first_item_is_recommended(client, seeded_db):
    response = client.get("/api/recommendation")
    ranking = response.json()["ranking"]
    assert ranking[0]["is_recommended"] is True
    assert ranking[0]["rank"] == 1


def test_total_zones_count(client, seeded_db):
    response = client.get("/api/recommendation")
    body = response.json()
    assert body["total_zones"] == len(body["ranking"])


def test_feasible_zones_count(client, seeded_db):
    response = client.get("/api/recommendation")
    body = response.json()
    counted = sum(1 for r in body["ranking"] if r["feasible"])
    assert body["feasible_zones"] == counted


# ── POST /api/recommendation/recalculate ─────────────────────────────────────

def test_recalculate_no_data_returns_404(client):
    response = client.post("/api/recommendation/recalculate")
    assert response.status_code == 404


def test_recalculate_matches_get(client, seeded_db):
    get_resp = client.get("/api/recommendation")
    post_resp = client.post("/api/recommendation/recalculate")
    assert get_resp.status_code == 200
    assert post_resp.status_code == 200
    # Both should produce identical deterministic results
    assert get_resp.json()["recommended_target"] == post_resp.json()["recommended_target"]
    assert get_resp.json()["ranking"][0]["final_score"] == post_resp.json()["ranking"][0]["final_score"]


# ── POST /api/recommendation/confirm ─────────────────────────────────────────

def test_confirm_observation_queues_available_satellite(client, seeded_db):
    wildfire_id, satellite_id = seeded_db

    response = client.post(
        "/api/recommendation/confirm",
        json={"wildfire_id": wildfire_id, "satellite_id": satellite_id},
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "confirmed",
        "wildfire_id": wildfire_id,
        "satellite_id": satellite_id,
        "message": "Observation for Zone B confirmed and queued.",
    }


def test_confirm_observation_rejects_missing_wildfire(client, seeded_db):
    _, satellite_id = seeded_db

    response = client.post(
        "/api/recommendation/confirm",
        json={"wildfire_id": 99999, "satellite_id": satellite_id},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Wildfire not found."


def test_confirm_observation_rejects_missing_satellite(client, seeded_db):
    wildfire_id, _ = seeded_db

    response = client.post(
        "/api/recommendation/confirm",
        json={"wildfire_id": wildfire_id, "satellite_id": 99999},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Satellite not found."


def test_confirm_observation_rejects_unavailable_satellite(client, seeded_db):
    wildfire_id, satellite_id = seeded_db
    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        satellite = db.get(Satellite, satellite_id)
        satellite.is_available = False
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/api/recommendation/confirm",
        json={"wildfire_id": wildfire_id, "satellite_id": satellite_id},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Satellite is not available for tasking."


def test_confirm_observation_rejects_stale_recommendation(client, seeded_db):
    wildfire_id, satellite_id = seeded_db
    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        lower_priority_wildfire = Wildfire(**_make_wildfire(
            name="Zone Lower",
            severity=10.0,
            fire_growth_rate=10.0,
            population_exposed=100,
            hospital_risk=0.0,
            critical_infrastructure_risk=0.0,
        ))
        db.add(lower_priority_wildfire)
        db.flush()
        db.add(ObservationOpportunity(
            wildfire_id=lower_priority_wildfire.id,
            satellite_id=satellite_id,
            visibility_score=90.0,
            observation_window_minutes=15.0,
            is_available=True,
        ))
        db.commit()
        stale_wildfire_id = lower_priority_wildfire.id
    finally:
        db.close()

    response = client.post(
        "/api/recommendation/confirm",
        json={"wildfire_id": stale_wildfire_id, "satellite_id": satellite_id},
    )

    assert stale_wildfire_id != wildfire_id
    assert response.status_code == 409
    assert response.json()["detail"] == "Selected wildfire is no longer the current recommended target."
