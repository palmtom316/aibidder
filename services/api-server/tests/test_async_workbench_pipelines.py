from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from tests.test_workbench_pipeline import _build_tender_docx



def _login(client: TestClient, username: str = "admin@example.com", password: str = "admin123456") -> str:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]



def test_workbench_create_endpoints_can_queue_async_pipeline_tasks(monkeypatch) -> None:
    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    dispatched: list[tuple[str, int]] = []

    from app.api.routes import workbench as workbench_route

    monkeypatch.setattr(settings, "async_workbench_pipelines", True)
    monkeypatch.setattr(
        workbench_route,
        "dispatch_workbench_pipeline_task",
        lambda *, pipeline_type, record_id: dispatched.append((pipeline_type, record_id)) or True,
    )

    project = client.post("/api/v1/projects", json={"name": "Async Pipeline Project"}, headers=headers)
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={
            "file": (
                "async-pipeline.docx",
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
    assert decomposition.json()["status"] == "queued"

    generation = client.post(
        "/api/v1/workbench/generation/jobs",
        json={"project_id": project_id, "source_document_id": document_id, "job_name": "技术标生成", "target_sections": 3},
        headers=headers,
    )
    assert generation.status_code == 201, generation.text
    assert generation.json()["status"] == "queued"

    review = client.post(
        "/api/v1/workbench/review/runs",
        json={"project_id": project_id, "source_document_id": document_id, "run_name": "合规评审", "review_mode": "compliance_review"},
        headers=headers,
    )
    assert review.status_code == 201, review.text
    assert review.json()["status"] == "queued"

    layout = client.post(
        "/api/v1/workbench/layout/jobs",
        json={"project_id": project_id, "source_document_id": document_id, "job_name": "企业模板排版", "template_name": "corporate-default"},
        headers=headers,
    )
    assert layout.status_code == 201, layout.text
    assert layout.json()["status"] == "queued"

    assert [item[0] for item in dispatched] == ["decomposition", "generation", "review", "layout"]


def test_decomposition_sse_stream_emits_progress_until_terminal_state(monkeypatch) -> None:
    import threading
    import time

    from app.api.routes import workbench as workbench_route
    from app.db.models import DecompositionRun
    from app.db.session import SessionLocal

    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    monkeypatch.setattr(settings, "async_workbench_pipelines", True)
    monkeypatch.setattr(workbench_route, "dispatch_workbench_pipeline_task", lambda **_: True)

    project = client.post("/api/v1/projects", json={"name": "Async SSE Project"}, headers=headers)
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={
            "file": (
                "async-sse.docx",
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
    run_id = decomposition.json()["id"]

    def complete_run() -> None:
        time.sleep(0.15)
        with SessionLocal() as db:
            run = db.get(DecompositionRun, run_id)
            assert run is not None
            run.status = "completed"
            run.progress_pct = 100
            db.commit()

    updater = threading.Thread(target=complete_run, daemon=True)
    updater.start()

    with client.stream("GET", f"/api/v1/workbench/decomposition/runs/{run_id}/events", headers=headers) as response:
        assert response.status_code == 200, response.text
        body = b"".join(response.iter_bytes())

    updater.join(timeout=1)
    decoded = body.decode("utf-8")
    assert decoded.count("event: progress") >= 2
    assert "queued" in decoded
    assert "completed" in decoded
