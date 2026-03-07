from fastapi.testclient import TestClient

from app.main import app
from tests.test_evidence_unit_rebuild import _upload_project_document
from tests.test_historical_bid_ingestion import _build_minimal_docx, _login


def _upload_document_to_existing_project(
    client: TestClient,
    token: str,
    *,
    project_id: int,
    document_type: str,
    filename: str,
) -> int:
    docx_payload = _build_minimal_docx(
        ("Heading1", "第一章 项目概况"),
        ("Normal", "本项目工期180日历天。"),
        ("Heading1", "第二章 质量保证措施"),
        ("Normal", "投标人应建立质量保证体系。"),
    )
    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": document_type},
        files={
            "file": (
                filename,
                docx_payload,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert uploaded.status_code == 201, uploaded.text
    return uploaded.json()["id"]


def test_search_project_evidence_api_returns_traceable_results() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")

    project_id, tender_document_id = _upload_project_document(
        client,
        token,
        project_name="Evidence Search Project",
        document_type="tender",
        filename="tender.docx",
    )
    norm_document_id = _upload_document_to_existing_project(
        client,
        token,
        project_id=project_id,
        document_type="norm",
        filename="norm.docx",
    )

    rebuild_tender = client.post(
        f"/api/v1/projects/{project_id}/documents/{tender_document_id}/rebuild-evidence-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rebuild_tender.status_code == 200, rebuild_tender.text

    rebuild_norm = client.post(
        f"/api/v1/projects/{project_id}/documents/{norm_document_id}/rebuild-evidence-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rebuild_norm.status_code == 200, rebuild_norm.text

    search = client.get(
        f"/api/v1/projects/{project_id}/evidence/search",
        params={"q": "质量保证体系"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert search.status_code == 200, search.text
    payload = search.json()
    assert len(payload) >= 1
    assert payload[0]["filename"] == "tender.docx"
    assert payload[0]["section_title"] == "第二章 质量保证措施"
    assert payload[0]["anchor"] == "section-2"
    assert payload[0]["page_start"] == 1
    assert "质量保证体系" in payload[0]["content"]


def test_search_project_evidence_api_excludes_proposal_documents() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")
    project_id, tender_document_id = _upload_project_document(
        client,
        token,
        project_name="Evidence Search Boundary Project",
        document_type="tender",
        filename="tender.docx",
    )

    rebuild = client.post(
        f"/api/v1/projects/{project_id}/documents/{tender_document_id}/rebuild-evidence-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rebuild.status_code == 200, rebuild.text

    proposal_document_id = _upload_document_to_existing_project(
        client,
        token,
        project_id=project_id,
        document_type="proposal",
        filename="proposal.docx",
    )

    proposal_rebuild = client.post(
        f"/api/v1/projects/{project_id}/documents/{proposal_document_id}/rebuild-evidence-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert proposal_rebuild.status_code == 404 or proposal_rebuild.status_code == 400

    search = client.get(
        f"/api/v1/projects/{project_id}/evidence/search",
        params={"q": "质量保证体系"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert search.status_code == 200, search.text
    filenames = {item["filename"] for item in search.json()}
    assert "proposal.docx" not in filenames


def test_search_project_evidence_api_can_filter_document_type() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")
    project_id, tender_document_id = _upload_project_document(
        client,
        token,
        project_name="Evidence Search Filter Project",
        document_type="tender",
        filename="tender.docx",
    )
    norm_document_id = _upload_document_to_existing_project(
        client,
        token,
        project_id=project_id,
        document_type="norm",
        filename="norm.docx",
    )

    rebuild_tender = client.post(
        f"/api/v1/projects/{project_id}/documents/{tender_document_id}/rebuild-evidence-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rebuild_tender.status_code == 200, rebuild_tender.text
    rebuild_norm = client.post(
        f"/api/v1/projects/{project_id}/documents/{norm_document_id}/rebuild-evidence-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rebuild_norm.status_code == 200, rebuild_norm.text

    search = client.get(
        f"/api/v1/projects/{project_id}/evidence/search",
        params={"q": "质量保证体系", "document_type": "norm"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert search.status_code == 200, search.text
    payload = search.json()
    assert payload
    assert all(item["document_type"] == "norm" for item in payload)
