from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import EvidenceUnit
from app.db.session import SessionLocal
from app.main import app
from tests.test_historical_bid_ingestion import _build_minimal_docx, _login


def _upload_project_document(
    client: TestClient,
    token: str,
    *,
    project_name: str | None,
    document_type: str,
    filename: str,
) -> tuple[int, int]:
    if project_name is not None:
        project_response = client.post(
            "/api/v1/projects",
            json={"name": project_name},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]
    else:
        raise AssertionError("project_name is required when no existing project is provided")

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
    return project_id, uploaded.json()["id"]


def test_evidence_unit_rebuild_api_creates_traceable_units_for_tender() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")
    project_id, document_id = _upload_project_document(
        client,
        token,
        project_name="Evidence Rebuild Project",
        document_type="tender",
        filename="requirements.docx",
    )

    rebuilt = client.post(
        f"/api/v1/projects/{project_id}/documents/{document_id}/rebuild-evidence-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rebuilt.status_code == 200, rebuilt.text
    payload = rebuilt.json()
    assert len(payload) == 4

    section_summary = next(item for item in payload if item["unit_type"] == "section_summary")
    paragraph = next(item for item in payload if item["unit_type"] == "paragraph")

    assert section_summary["document_type"] == "tender"
    assert section_summary["section_title"] == "第一章 项目概况"
    assert section_summary["anchor"] == "section-1"
    assert section_summary["page_start"] == 1
    assert paragraph["content"] == "本项目工期180日历天。"

    listed = client.get(
        f"/api/v1/projects/{project_id}/documents/{document_id}/evidence-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed.status_code == 200, listed.text
    assert len(listed.json()) == 4


def test_evidence_unit_rebuild_api_rejects_proposal_documents() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")
    project_id, document_id = _upload_project_document(
        client,
        token,
        project_name="Proposal Evidence Boundary Project",
        document_type="proposal",
        filename="proposal.docx",
    )

    rebuilt = client.post(
        f"/api/v1/projects/{project_id}/documents/{document_id}/rebuild-evidence-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rebuilt.status_code == 400
    assert rebuilt.json()["detail"] == "Only tender and norm documents can build evidence units"


def test_evidence_unit_rebuild_api_requires_project_membership() -> None:
    client = TestClient(app)
    manager_token = _login(client, "project_manager@example.com", "manager123456")
    project_id, document_id = _upload_project_document(
        client,
        manager_token,
        project_name="Evidence Membership Project",
        document_type="norm",
        filename="norm.docx",
    )

    writer_token = _login(client, "writer@example.com", "writer123456")
    response = client.get(
        f"/api/v1/projects/{project_id}/documents/{document_id}/evidence-units",
        headers={"Authorization": f"Bearer {writer_token}"},
    )
    assert response.status_code == 403


def test_evidence_unit_rebuild_replaces_existing_units_for_latest_version() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")
    project_id, document_id = _upload_project_document(
        client,
        token,
        project_name="Evidence Replace Project",
        document_type="tender",
        filename="replace.docx",
    )

    first_rebuild = client.post(
        f"/api/v1/projects/{project_id}/documents/{document_id}/rebuild-evidence-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first_rebuild.status_code == 200, first_rebuild.text

    second_rebuild = client.post(
        f"/api/v1/projects/{project_id}/documents/{document_id}/rebuild-evidence-units",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert second_rebuild.status_code == 200, second_rebuild.text
    assert len(second_rebuild.json()) == 4

    with SessionLocal() as db:
        stored_units = list(
            db.scalars(
                select(EvidenceUnit).where(EvidenceUnit.document_id == document_id).order_by(EvidenceUnit.id.asc())
            )
        )

    assert len(stored_units) == 4
