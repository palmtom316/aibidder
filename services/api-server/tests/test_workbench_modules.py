from fastapi.testclient import TestClient

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


def _create_project(client: TestClient, token: str, name: str = "Workbench Project") -> dict:
    response = client.post(
        "/api/v1/projects",
        json={"name": name},
        headers=_auth_headers(token),
    )
    assert response.status_code == 201
    return response.json()


def _create_document(
    client: TestClient,
    token: str,
    project_id: int,
    filename: str = "tender.docx",
    document_type: str = "tender",
) -> dict:
    response = client.post(
        f"/api/v1/projects/{project_id}/documents",
        json={"filename": filename, "document_type": document_type},
        headers=_auth_headers(token),
    )
    assert response.status_code == 201
    return response.json()


def test_workbench_overview_exposes_all_product_modules() -> None:
    client = TestClient(app)
    token = _login()
    project = _create_project(client, token, name="Overview Project")

    response = client.get(
        f"/api/v1/workbench/overview?project_id={project['id']}",
        headers=_auth_headers(token),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["project_id"] == project["id"]
    assert [module["module_key"] for module in payload["modules"]] == [
        "knowledge_library",
        "tender_decomposition",
        "bid_generation",
        "bid_review",
        "layout_finalize",
        "bid_management",
    ]
    assert [module["title"] for module in payload["modules"]] == [
        "投标资料库",
        "招标解析",
        "标书生成",
        "标书检测",
        "排版定稿",
        "标书管理",
    ]


def test_workbench_module_records_can_be_created_and_counted() -> None:
    client = TestClient(app)
    token = _login()
    project = _create_project(client, token, name="Pipeline Project")
    document = _create_document(client, token, project["id"], filename="招标文件.docx", document_type="tender")

    library_entry = client.post(
        "/api/v1/workbench/library/entries",
        json={
            "project_id": project["id"],
            "source_document_id": document["id"],
            "category": "excellent_bid",
            "title": "2025 输变电优秀标书",
            "owner_name": "市场经营中心",
        },
        headers=_auth_headers(token),
    )
    assert library_entry.status_code == 201
    library_entry_id = library_entry.json()["id"]

    library_check = client.post(
        f"/api/v1/workbench/library/entries/{library_entry_id}/run-check",
        headers=_auth_headers(token),
    )
    assert library_check.status_code == 200
    assert library_check.json()["detection_status"] == "checked"

    decomposition = client.post(
        "/api/v1/workbench/decomposition/runs",
        json={
            "project_id": project["id"],
            "source_document_id": document["id"],
            "run_name": "招标文件七类拆解",
        },
        headers=_auth_headers(token),
    )
    assert decomposition.status_code == 201

    generation = client.post(
        "/api/v1/workbench/generation/jobs",
        json={
            "project_id": project["id"],
            "source_document_id": document["id"],
            "job_name": "技术标初稿生成",
            "target_sections": 7,
        },
        headers=_auth_headers(token),
    )
    assert generation.status_code == 201

    review = client.post(
        "/api/v1/workbench/review/runs",
        json={
            "project_id": project["id"],
            "source_document_id": document["id"],
            "run_name": "模拟打分与合规复核",
            "review_mode": "simulated_scoring",
        },
        headers=_auth_headers(token),
    )
    assert review.status_code == 201

    layout = client.post(
        "/api/v1/workbench/layout/jobs",
        json={
            "project_id": project["id"],
            "source_document_id": document["id"],
            "job_name": "企业模板排版",
            "template_name": "corporate-default",
        },
        headers=_auth_headers(token),
    )
    assert layout.status_code == 201

    submission = client.post(
        "/api/v1/workbench/submission-records",
        json={
            "project_id": project["id"],
            "source_document_id": document["id"],
            "title": "国网项目投标包",
            "status": "draft",
        },
        headers=_auth_headers(token),
    )
    assert submission.status_code == 201

    overview = client.get(
        f"/api/v1/workbench/overview?project_id={project['id']}",
        headers=_auth_headers(token),
    )
    assert overview.status_code == 200
    overview_payload = {module["module_key"]: module for module in overview.json()["modules"]}
    assert overview_payload["knowledge_library"]["count"] >= 1
    assert overview_payload["tender_decomposition"]["count"] == 1
    assert overview_payload["bid_generation"]["count"] == 1
    assert overview_payload["bid_review"]["count"] == 1
    assert overview_payload["layout_finalize"]["count"] == 1
    assert overview_payload["bid_management"]["count"] == 1
