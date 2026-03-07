import pytest

from fastapi.testclient import TestClient

from app.api.routes.auth import _FAILED_LOGIN_ATTEMPTS
from app.main import app


@pytest.fixture(autouse=True)
def _reset_login_rate_limit_state() -> None:
    _FAILED_LOGIN_ATTEMPTS.clear()


def test_login_returns_access_token() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "admin123456"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "access_token" in payload
    assert "refresh_token" in payload
    assert payload["token_type"] == "bearer"


def test_refresh_returns_new_access_token() -> None:
    client = TestClient(app)
    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "admin123456"},
    )
    assert login_response.status_code == 200

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login_response.json()["refresh_token"]},
    )

    assert refresh_response.status_code == 200
    assert refresh_response.json()["access_token"]
    assert refresh_response.json()["refresh_token"]


def test_login_is_rate_limited_after_repeated_failures() -> None:
    _FAILED_LOGIN_ATTEMPTS.clear()
    client = TestClient(app)

    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "admin@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    blocked = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "wrong-password"},
    )
    assert blocked.status_code == 429


def test_create_project_requires_admin_or_project_manager() -> None:
    client = TestClient(app)

    login = client.post(
        "/api/v1/auth/login",
        data={"username": "writer@example.com", "password": "writer123456"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    response = client.post(
        "/api/v1/projects",
        json={"name": "Forbidden Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_login_returns_refresh_token_and_refresh_endpoint_rotates_access_token() -> None:
    client = TestClient(app)

    login = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "admin123456"},
    )
    assert login.status_code == 200
    payload = login.json()
    assert "refresh_token" in payload

    refreshed = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": payload["refresh_token"]},
    )
    assert refreshed.status_code == 200
    refreshed_payload = refreshed.json()
    assert refreshed_payload["token_type"] == "bearer"
    assert refreshed_payload["access_token"]
    assert refreshed_payload["refresh_token"]
