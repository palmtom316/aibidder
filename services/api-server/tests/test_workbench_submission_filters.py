from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.db.models import SubmissionRecord
from app.db.session import SessionLocal
from app.main import app


def _login(email: str = "admin@example.com", password: str = "admin123456") -> str:
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]



def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}



def test_submission_records_support_status_keyword_and_date_filters() -> None:
    client = TestClient(app)
    token = _login()

    project = client.post(
        "/api/v1/projects",
        json={"name": "Submission Filter Project"},
        headers=_auth_headers(token),
    )
    assert project.status_code == 201
    project_id = project.json()["id"]

    created_ids: list[int] = []
    for payload in (
        {"title": "浙江输变电技术标", "status": "won"},
        {"title": "江苏配网商务标", "status": "submitted"},
    ):
        response = client.post(
            "/api/v1/workbench/submission-records",
            json={
                "project_id": project_id,
                "title": payload["title"],
                "status": payload["status"],
            },
            headers=_auth_headers(token),
        )
        assert response.status_code == 201, response.text
        created_ids.append(response.json()["id"])

    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        newest = db.get(SubmissionRecord, created_ids[0])
        oldest = db.get(SubmissionRecord, created_ids[1])
        assert newest is not None
        assert oldest is not None
        newest.created_at = now
        oldest.created_at = now - timedelta(days=12)
        db.commit()

    by_status = client.get(
        "/api/v1/workbench/submission-records",
        params={"project_id": project_id, "status": "won"},
        headers=_auth_headers(token),
    )
    assert by_status.status_code == 200
    assert [row["title"] for row in by_status.json()] == ["浙江输变电技术标"]

    by_keyword = client.get(
        "/api/v1/workbench/submission-records",
        params={"project_id": project_id, "q": "商务"},
        headers=_auth_headers(token),
    )
    assert by_keyword.status_code == 200
    assert [row["title"] for row in by_keyword.json()] == ["江苏配网商务标"]

    by_date = client.get(
        "/api/v1/workbench/submission-records",
        params={"project_id": project_id, "created_from": (now - timedelta(days=2)).isoformat()},
        headers=_auth_headers(token),
    )
    assert by_date.status_code == 200
    assert [row["title"] for row in by_date.json()] == ["浙江输变电技术标"]
