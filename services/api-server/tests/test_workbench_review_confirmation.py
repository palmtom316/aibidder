from fastapi.testclient import TestClient

from app.main import app
from tests.test_workbench_pipeline import _build_tender_docx



def _login(client: TestClient, username: str = "admin@example.com", password: str = "admin123456") -> str:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]



def test_review_run_can_be_confirmed_when_no_blocking_issues() -> None:
    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    project = client.post("/api/v1/projects", json={"name": "Review Confirm Project"}, headers=headers)
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={
            "file": (
                "review-confirm.docx",
                _build_tender_docx(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers=headers,
    )
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]

    decomposition = client.post(
        "/api/v1/workbench/decomposition/runs",
        json={"project_id": project_id, "source_document_id": document_id, "run_name": "七类拆解"},
        headers=headers,
    )
    assert decomposition.status_code == 201, decomposition.text

    generation = client.post(
        "/api/v1/workbench/generation/jobs",
        json={"project_id": project_id, "source_document_id": document_id, "job_name": "技术标生成", "target_sections": 4},
        headers=headers,
    )
    assert generation.status_code == 201, generation.text

    review = client.post(
        "/api/v1/workbench/review/runs",
        json={"project_id": project_id, "source_document_id": document_id, "run_name": "合规评审", "review_mode": "compliance_review"},
        headers=headers,
    )
    assert review.status_code == 201, review.text
    review_id = review.json()["id"]
    assert review.json()["blocking_issue_count"] == 0

    confirmed = client.post(f"/api/v1/workbench/review/runs/{review_id}/confirm-pass", headers=headers)
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "approved"
