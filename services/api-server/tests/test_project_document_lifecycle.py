import json
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import DocumentArtifact, DocumentVersion
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
