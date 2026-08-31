def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "Orbit911"
    assert "timestamp" in body


def test_health_timestamp_format(client):
    response = client.get("/health")
    timestamp = response.json()["timestamp"]
    # Should include UTC offset (+00:00)
    assert "+00:00" in timestamp
