from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import settings
from app.db.models import DocumentArtifact, DocumentVersion
from app.db.session import SessionLocal
from app.main import app
from tests.test_project_document_lifecycle import _build_minimal_docx


def _login(client: TestClient, username: str = "project_manager@example.com", password: str = "manager123456") -> str:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]



def test_upload_document_can_queue_async_ingestion(monkeypatch) -> None:
    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    dispatched_ids: list[int] = []

    from app.api.routes import projects as projects_route

    monkeypatch.setattr(settings, "async_document_ingestion", True)
    monkeypatch.setattr(
        projects_route,
        "dispatch_document_ingestion_task",
        lambda *, document_version_id: dispatched_ids.append(document_version_id) or True,
    )

    project = client.post("/api/v1/projects", json={"name": "Async Upload Project"}, headers=headers)
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={
            "file": (
                "queued-upload.docx",
                _build_minimal_docx(("Heading1", "第一章 概况"), ("Normal", "等待异步解析。")),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers=headers,
    )
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]

    with SessionLocal() as db:
        version = db.scalar(select(DocumentVersion).where(DocumentVersion.document_id == document_id))
        artifacts = list(
            db.scalars(select(DocumentArtifact).where(DocumentArtifact.document_version_id == version.id))
        )

    assert version is not None
    assert version.status == "queued"
    assert dispatched_ids == [version.id]
    assert {artifact.artifact_type for artifact in artifacts} == {"source"}
