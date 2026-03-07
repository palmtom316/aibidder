import logging

from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_request_emits_structured_log_and_request_id(caplog) -> None:
    caplog.set_level(logging.INFO, logger="aibidder.request")
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    record = next(
        item
        for item in caplog.records
        if item.name == "aibidder.request" and getattr(item, "path", None) == "/health"
    )
    assert record.msg == "request.completed"
    assert record.method == "GET"
    assert record.path == "/health"
    assert record.status_code == 200
    assert record.request_id == response.headers["X-Request-ID"]
    assert record.duration_ms >= 0
