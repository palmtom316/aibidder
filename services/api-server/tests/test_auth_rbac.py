from fastapi.testclient import TestClient

from app.main import app


def test_login_returns_access_token() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "admin123456"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "access_token" in payload
    assert payload["token_type"] == "bearer"


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
