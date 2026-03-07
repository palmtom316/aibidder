import json
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import AuditLog, DocumentArtifact, DocumentVersion, EvidenceUnit
from app.db.session import SessionLocal
from app.main import app


def _login(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _build_minimal_docx(*paragraphs: tuple[str, str]) -> bytes:
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""
    body = []
    for style, text in paragraphs:
        body.append(
            f"""
<w:p>
  <w:pPr><w:pStyle w:val="{style}"/></w:pPr>
  <w:r><w:t>{text}</w:t></w:r>
</w:p>""".strip()
        )

    document = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(body)}
  </w:body>
</w:document>"""

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)
    return buffer.getvalue()


def test_create_and_list_project() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")

    created = client.post(
        "/api/v1/projects",
        json={"name": "Phase A Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert created.status_code == 201
    created_payload = created.json()
    assert created_payload["name"] == "Phase A Project"
    assert "id" in created_payload

    listed = client.get(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed.status_code == 200
    assert any(item["name"] == "Phase A Project" for item in listed.json())


def test_project_and_document_lists_support_limit_offset_pagination() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")

    baseline_projects = client.get(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert baseline_projects.status_code == 200
    baseline_project_count = len(baseline_projects.json())

    created_project_ids: list[int] = []
    for name in ["Paged Project A", "Paged Project B", "Paged Project C"]:
        created = client.post(
            "/api/v1/projects",
            json={"name": name},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert created.status_code == 201
        created_project_ids.append(created.json()["id"])

    listed_projects = client.get(
        "/api/v1/projects",
        params={"limit": 2, "offset": baseline_project_count + 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed_projects.status_code == 200
    projects_payload = listed_projects.json()
    assert len(projects_payload) == 2
    assert projects_payload[0]["id"] == created_project_ids[1]
    assert projects_payload[1]["id"] == created_project_ids[2]

    project_id = created_project_ids[0]
    baseline_documents = client.get(
        f"/api/v1/projects/{project_id}/documents",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert baseline_documents.status_code == 200
    baseline_document_count = len(baseline_documents.json())

    for index in range(3):
        created = client.post(
            f"/api/v1/projects/{project_id}/documents",
            json={"filename": f"paged-{index}.pdf", "document_type": "tender"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert created.status_code == 201

    listed_documents = client.get(
        f"/api/v1/projects/{project_id}/documents",
        params={"limit": 2, "offset": baseline_document_count + 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed_documents.status_code == 200
    documents_payload = listed_documents.json()
    assert len(documents_payload) == 2
    assert documents_payload[0]["filename"] == "paged-1.pdf"
    assert documents_payload[1]["filename"] == "paged-0.pdf"


def test_create_and_list_documents() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Docs Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    created = client.post(
        f"/api/v1/projects/{project_id}/documents",
        json={"filename": "tender.pdf", "document_type": "tender"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert created.status_code == 201
    assert created.json()["filename"] == "tender.pdf"

    listed = client.get(
        f"/api/v1/projects/{project_id}/documents",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["document_type"] == "tender"


def test_upload_document_creates_version_and_artifact() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Upload Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={"file": ("requirements.pdf", b"%PDF-1.4 stub", "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert uploaded.status_code == 201
    payload = uploaded.json()
    assert payload["filename"] == "requirements.pdf"

    with SessionLocal() as db:
        version = db.scalar(
            select(DocumentVersion).where(DocumentVersion.document_id == payload["id"])
        )
        artifacts = list(
            db.scalars(
                select(DocumentArtifact).where(DocumentArtifact.document_version_id == version.id)
            )
        )

    assert version is not None
    assert version.status == "parsed"
    artifact_types = {artifact.artifact_type for artifact in artifacts}
    assert artifact_types == {"source", "markdown", "json", "parse_log"}
    assert all(Path(artifact.storage_path).exists() for artifact in artifacts)

    parse_log_artifact = next(artifact for artifact in artifacts if artifact.artifact_type == "parse_log")
    parse_log = json.loads(Path(parse_log_artifact.storage_path).read_text())
    assert parse_log["parser"] == "pdf_fallback"
    assert parse_log["transitions"] == ["uploaded", "parsing", "parsed"]


def test_audit_logs_capture_login_project_creation_and_document_upload() -> None:
    client = TestClient(app)
    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": "project_manager@example.com", "password": "manager123456"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Audit Trail Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={"file": ("audit.pdf", b"%PDF-1.4 audit", "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert uploaded.status_code == 201

    with SessionLocal() as db:
        actions = list(
            db.scalars(
                select(AuditLog.action).order_by(AuditLog.id.asc())
            )
        )

    assert "auth.login.succeeded" in actions
    assert "project.create" in actions
    assert "document.upload.completed" in actions


def test_upload_rejects_unsupported_file_extension() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Upload Validation Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={"file": ("notes.txt", b"not supported", "text/plain")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert uploaded.status_code == 400
    assert uploaded.json()["detail"] == "Unsupported file type"


def test_upload_docx_creates_markdown_and_json_artifacts_with_anchors() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Parsed Upload Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    docx_payload = _build_minimal_docx(
        ("Heading1", "第一章 项目概况"),
        ("Normal", "本项目用于验证解析产物。"),
        ("Heading1", "第二章 技术方案"),
        ("Normal", "需保留章节锚点。"),
    )
    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={
            "file": (
                "outline.docx",
                docx_payload,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert uploaded.status_code == 201
    payload = uploaded.json()

    with SessionLocal() as db:
        version = db.scalar(
            select(DocumentVersion).where(DocumentVersion.document_id == payload["id"])
        )
        artifacts = list(
            db.scalars(
                select(DocumentArtifact).where(DocumentArtifact.document_version_id == version.id)
            )
        )

    assert version is not None
    assert version.status == "parsed"
    artifact_types = {artifact.artifact_type for artifact in artifacts}
    assert artifact_types == {"source", "markdown", "json", "parse_log"}

    markdown_artifact = next(artifact for artifact in artifacts if artifact.artifact_type == "markdown")
    json_artifact = next(artifact for artifact in artifacts if artifact.artifact_type == "json")
    parse_log_artifact = next(artifact for artifact in artifacts if artifact.artifact_type == "parse_log")
    markdown_text = Path(markdown_artifact.storage_path).read_text()
    parsed_payload = json.loads(Path(json_artifact.storage_path).read_text())
    parse_log = json.loads(Path(parse_log_artifact.storage_path).read_text())

    assert "# 第一章 项目概况" in markdown_text
    assert "# 第二章 技术方案" in markdown_text
    assert parsed_payload["sections"][0]["title"] == "第一章 项目概况"
    assert parsed_payload["sections"][0]["anchor"] == "section-1"
    assert parsed_payload["sections"][1]["title"] == "第二章 技术方案"
    assert parse_log["parser"] == "docx_ooxml"
    assert parse_log["transitions"] == ["uploaded", "parsing", "parsed"]


def test_upload_tender_docx_auto_builds_evidence_units() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Tender Evidence Auto Build Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    docx_payload = _build_minimal_docx(
        ("Heading1", "第一章 项目概况"),
        ("Normal", "本项目工期180日历天。"),
        ("Heading1", "第二章 质量保证措施"),
        ("Normal", "投标人应建立质量保证体系。"),
    )
    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={
            "file": (
                "tender-evidence.docx",
                docx_payload,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]

    with SessionLocal() as db:
        stored_units = list(
            db.scalars(
                select(EvidenceUnit).where(EvidenceUnit.document_id == document_id).order_by(EvidenceUnit.id.asc())
            )
        )

    assert len(stored_units) == 4
    assert {item.document_type for item in stored_units} == {"tender"}

    search = client.get(
        f"/api/v1/projects/{project_id}/evidence/search",
        params={"q": "质量保证体系"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert search.status_code == 200, search.text
    payload = search.json()
    assert any(item["document_id"] == document_id for item in payload)


def test_upload_norm_docx_auto_builds_evidence_units_and_proposal_does_not() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Norm Evidence Auto Build Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    docx_payload = _build_minimal_docx(
        ("Heading1", "第一章 项目概况"),
        ("Normal", "本项目工期180日历天。"),
        ("Heading1", "第二章 质量保证措施"),
        ("Normal", "投标人应建立质量保证体系。"),
    )

    norm_uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "norm"},
        files={
            "file": (
                "norm-evidence.docx",
                docx_payload,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert norm_uploaded.status_code == 201, norm_uploaded.text
    norm_document_id = norm_uploaded.json()["id"]

    proposal_uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "proposal"},
        files={
            "file": (
                "proposal-skip.docx",
                docx_payload,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert proposal_uploaded.status_code == 201, proposal_uploaded.text
    proposal_document_id = proposal_uploaded.json()["id"]

    with SessionLocal() as db:
        norm_units = list(
            db.scalars(
                select(EvidenceUnit).where(EvidenceUnit.document_id == norm_document_id).order_by(EvidenceUnit.id.asc())
            )
        )
        proposal_units = list(
            db.scalars(
                select(EvidenceUnit)
                .where(EvidenceUnit.document_id == proposal_document_id)
                .order_by(EvidenceUnit.id.asc())
            )
        )

    assert len(norm_units) == 4
    assert {item.document_type for item in norm_units} == {"norm"}
    assert proposal_units == []


def test_upload_doc_normalizes_to_docx_then_parses() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Legacy Doc Upload Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    doc_payload = _build_minimal_docx(
        ("Heading1", "第一章 施工组织设计"),
        ("Normal", "兼容旧版 doc 文件。"),
    )
    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "proposal"},
        files={"file": ("legacy-proposal.doc", doc_payload, "application/msword")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert uploaded.status_code == 201
    payload = uploaded.json()

    with SessionLocal() as db:
        version = db.scalar(
            select(DocumentVersion).where(DocumentVersion.document_id == payload["id"])
        )
        artifacts = list(
            db.scalars(
                select(DocumentArtifact).where(DocumentArtifact.document_version_id == version.id)
            )
        )

    assert version is not None
    assert version.status == "parsed"

    artifact_types = {artifact.artifact_type for artifact in artifacts}
    assert artifact_types == {"source", "normalized_source", "markdown", "json", "parse_log"}

    normalized_artifact = next(
        artifact for artifact in artifacts if artifact.artifact_type == "normalized_source"
    )
    parse_log_artifact = next(artifact for artifact in artifacts if artifact.artifact_type == "parse_log")
    parsed_payload = json.loads(
        Path(next(artifact for artifact in artifacts if artifact.artifact_type == "json").storage_path).read_text()
    )
    parse_log = json.loads(Path(parse_log_artifact.storage_path).read_text())

    assert normalized_artifact.storage_path.endswith(".docx")
    assert Path(normalized_artifact.storage_path).exists()
    assert parsed_payload["document"]["normalized_from"] == "doc"
    assert parse_log["parser"] == "docx_ooxml"
    assert parse_log["transitions"] == ["uploaded", "normalizing", "normalized", "parsing", "parsed"]


def test_project_manager_can_add_member_and_member_can_view_project() -> None:
    client = TestClient(app)
    manager_token = _login(client, "project_manager@example.com", "manager123456")

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Member Managed Project"},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    added = client.post(
        f"/api/v1/projects/{project_id}/members",
        json={"user_email": "writer@example.com", "role": "writer"},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert added.status_code == 201
    assert added.json()["user_email"] == "writer@example.com"
    assert added.json()["role"] == "writer"

    members = client.get(
        f"/api/v1/projects/{project_id}/members",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert members.status_code == 200
    assert any(item["user_email"] == "writer@example.com" for item in members.json())

    writer_token = _login(client, "writer@example.com", "writer123456")
    visible_projects = client.get(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {writer_token}"},
    )
    assert visible_projects.status_code == 200
    assert any(item["id"] == project_id for item in visible_projects.json())


def test_writer_cannot_manage_project_members() -> None:
    client = TestClient(app)
    manager_token = _login(client, "project_manager@example.com", "manager123456")

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Protected Members Project"},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    writer_token = _login(client, "writer@example.com", "writer123456")
    response = client.post(
        f"/api/v1/projects/{project_id}/members",
        json={"user_email": "writer@example.com", "role": "writer"},
        headers={"Authorization": f"Bearer {writer_token}"},
    )
    assert response.status_code == 403
