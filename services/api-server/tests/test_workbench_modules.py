from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.db.models import KnowledgeBaseEntry
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
        "标书分析",
        "标书生成",
        "标书评审",
        "排版定稿",
        "标书管理",
    ]


def test_library_entries_support_category_and_keyword_filters() -> None:
    client = TestClient(app)
    token = _login()
    project = _create_project(client, token, name="Library Filter Project")
    document = _create_document(client, token, project["id"], filename="资料库.docx", document_type="proposal")

    for payload in (
        {
            "project_id": project["id"],
            "source_document_id": document["id"],
            "category": "excellent_bid",
            "title": "2025 输变电优秀标书",
            "owner_name": "市场经营中心",
        },
        {
            "project_id": project["id"],
            "source_document_id": document["id"],
            "category": "company_qualification",
            "title": "电力总承包一级资质",
            "owner_name": "资质管理部",
        },
        {
            "project_id": project["id"],
            "source_document_id": document["id"],
            "category": "personnel_qualification",
            "title": "一级建造师证书",
            "owner_name": "人力资源部",
        },
    ):
        response = client.post(
            "/api/v1/workbench/library/entries",
            json=payload,
            headers=_auth_headers(token),
        )
        assert response.status_code == 201

    by_category = client.get(
        f"/api/v1/workbench/library/entries?project_id={project['id']}&category=company_qualification",
        headers=_auth_headers(token),
    )
    assert by_category.status_code == 200
    assert [row["title"] for row in by_category.json()] == ["电力总承包一级资质"]

    by_keyword = client.get(
        f"/api/v1/workbench/library/entries?project_id={project['id']}&q=资质",
        headers=_auth_headers(token),
    )
    assert by_keyword.status_code == 200
    assert {row["title"] for row in by_keyword.json()} == {"电力总承包一级资质"}


def test_library_entries_support_created_at_range_filters() -> None:
    client = TestClient(app)
    token = _login()
    project = _create_project(client, token, name="Library Date Range Project")
    document = _create_document(client, token, project["id"], filename="日期筛选.docx", document_type="proposal")

    created_entry_ids: list[int] = []
    for payload in (
        {
            "project_id": project["id"],
            "source_document_id": document["id"],
            "category": "excellent_bid",
            "title": "近期开标项目",
            "owner_name": "市场经营中心",
        },
        {
            "project_id": project["id"],
            "source_document_id": document["id"],
            "category": "historical_bid",
            "title": "往年历史标书",
            "owner_name": "档案室",
        },
    ):
        response = client.post(
            "/api/v1/workbench/library/entries",
            json=payload,
            headers=_auth_headers(token),
        )
        assert response.status_code == 201
        created_entry_ids.append(response.json()["id"])

    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        newest = db.get(KnowledgeBaseEntry, created_entry_ids[0])
        oldest = db.get(KnowledgeBaseEntry, created_entry_ids[1])
        assert newest is not None
        assert oldest is not None
        newest.created_at = now
        oldest.created_at = now - timedelta(days=10)
        db.commit()

    created_from = (now - timedelta(days=2)).isoformat()
    created_to = (now - timedelta(days=2)).isoformat()

    recent_only = client.get(
        "/api/v1/workbench/library/entries",
        params={"project_id": project["id"], "created_from": created_from},
        headers=_auth_headers(token),
    )
    assert recent_only.status_code == 200
    assert [row["title"] for row in recent_only.json()] == ["近期开标项目"]

    older_only = client.get(
        "/api/v1/workbench/library/entries",
        params={"project_id": project["id"], "created_to": created_to},
        headers=_auth_headers(token),
    )
    assert older_only.status_code == 200
    assert [row["title"] for row in older_only.json()] == ["往年历史标书"]


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
