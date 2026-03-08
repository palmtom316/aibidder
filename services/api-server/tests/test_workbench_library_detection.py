from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi.testclient import TestClient

from app.main import app


def _login(client: TestClient, username: str = "admin@example.com", password: str = "admin123456") -> str:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]



def _build_sensitive_docx() -> bytes:
    content_types = """<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">
  <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>
  <Default Extension=\"xml\" ContentType=\"application/xml\"/>
  <Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>
</Types>"""
    rels = """<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>
</Relationships>"""
    document = """<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>
<w:p><w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr><w:r><w:t>第一章 项目概况</w:t></w:r></w:p>
<w:p><w:r><w:t>项目经理张三于2026年3月8日提交报价，金额100万元，工期180日历天。</w:t></w:r></w:p>
</w:body></w:document>"""
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)
    return buffer.getvalue()



def test_library_run_check_detects_sensitive_markers_from_uploaded_document() -> None:
    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    project = client.post("/api/v1/projects", json={"name": "Library Detection Project"}, headers=headers)
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "proposal"},
        files={
            "file": (
                "sensitive-library.docx",
                _build_sensitive_docx(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers=headers,
    )
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]

    entry = client.post(
        "/api/v1/workbench/library/entries",
        json={
            "project_id": project_id,
            "source_document_id": document_id,
            "category": "excellent_bid",
            "title": "含敏感信息的历史标书",
            "owner_name": "经营管理部",
        },
        headers=headers,
    )
    assert entry.status_code == 201, entry.text
    entry_id = entry.json()["id"]

    checked = client.post(f"/api/v1/workbench/library/entries/{entry_id}/run-check", headers=headers)
    assert checked.status_code == 200, checked.text
    payload = checked.json()
    assert payload["detection_status"] == "attention_needed"
    assert "[PERSON_NAME]" in payload["detected_summary"]
    assert "[DATE]" in payload["detected_summary"]
    assert "[MONEY]" in payload["detected_summary"]
