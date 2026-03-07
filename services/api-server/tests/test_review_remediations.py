from io import BytesIO
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select

from app.core.config import Settings
from app.core.document_parser import parse_document
from app.db.models import AuditLog
from app.db.session import SessionLocal
from app.main import app


def _build_docx_with_table() -> bytes:
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
    document = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>第二章 资格审查</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>资质</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>一级</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>人员</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>项目经理</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>"""

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)
    return buffer.getvalue()


def test_prod_settings_require_non_default_jwt_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(env="prod", jwt_secret_key="change-me-in-production")


def test_login_returns_refresh_token_and_writes_audit_log() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "admin123456"},
        headers={"X-Forwarded-For": "198.51.100.10"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["access_token"]
    assert payload["refresh_token"]

    refreshed = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": payload["refresh_token"]},
        headers={"X-Forwarded-For": "198.51.100.10"},
    )
    assert refreshed.status_code == 200, refreshed.text
    assert refreshed.json()["access_token"]
    assert refreshed.json()["refresh_token"] != payload["refresh_token"]

    with SessionLocal() as db:
        logs = list(
            db.scalars(
                select(AuditLog)
                .where(AuditLog.action == "auth.login.succeeded")
                .order_by(AuditLog.id.desc())
            )
        )

    assert logs
    assert logs[0].actor_email == "admin@example.com"


def test_login_rate_limit_blocks_repeated_failures() -> None:
    client = TestClient(app)
    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "admin@example.com", "password": "wrong-password"},
            headers={"X-Forwarded-For": "198.51.100.11"},
        )
        assert response.status_code == 401

    blocked = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "wrong-password"},
        headers={"X-Forwarded-For": "198.51.100.11"},
    )
    assert blocked.status_code == 429


def test_list_projects_supports_limit_offset_and_total_count() -> None:
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        data={"username": "project_manager@example.com", "password": "manager123456"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    for index in range(3):
        created = client.post(
            "/api/v1/projects",
            json={"name": f"Paged Project {index}"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert created.status_code == 201

    listed = client.get(
        "/api/v1/projects",
        params={"limit": 2, "offset": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed.status_code == 200
    assert listed.headers["X-Total-Count"]
    assert len(listed.json()) == 2


def test_docx_parser_extracts_table_rows_into_markdown_and_sections() -> None:
    payload = _build_docx_with_table()
    with NamedTemporaryFile(suffix=".docx") as temp_file:
        temp_file.write(payload)
        temp_file.flush()
        parsed = parse_document(temp_file.name, "qualification.docx")

    assert parsed is not None
    assert "资质" in parsed.markdown
    assert "一级" in parsed.markdown
    section = parsed.structured_payload["sections"][0]
    assert "项目经理" in section["content"]
