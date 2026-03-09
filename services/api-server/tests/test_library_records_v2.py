from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi.testclient import TestClient

from app.main import app


def _login(client: TestClient, username: str = "admin@example.com", password: str = "admin123456") -> str:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _build_docx(*paragraphs: tuple[str, str]) -> bytes:
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
    body = []
    for style, text in paragraphs:
        style_xml = f"<w:pPr><w:pStyle w:val=\"{style}\"/></w:pPr>" if style else ""
        body.append(f"<w:p>{style_xml}<w:r><w:t>{text}</w:t></w:r></w:p>")

    document = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>"
        f"{''.join(body)}"
        "</w:body></w:document>"
    )
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)
    return buffer.getvalue()


def test_document_library_record_builds_chunks_and_searchable_result() -> None:
    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    project = client.post("/api/v1/projects", json={"name": "Library V2 Project"}, headers=headers)
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "proposal"},
        files={
            "file": (
                "excellent.docx",
                _build_docx(
                    ("Heading1", "第一章 施工组织"),
                    ("Normal", "本章重点介绍施工组织设计与现场协调。"),
                    ("Heading1", "第二章 质量保证"),
                    ("Normal", "建立全过程质量保证体系并落实责任到人。"),
                ),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers=headers,
    )
    assert uploaded.status_code == 201, uploaded.text
    source_document_id = uploaded.json()["id"]

    created = client.post(
        "/api/v1/workbench/library/document-records",
        json={
            "project_id": project_id,
            "source_document_id": source_document_id,
            "record_type": "excellent_bid",
            "title": "某配网工程优秀标书",
            "project_category": "配网工程",
            "owner_name": "经营管理部",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    payload = created.json()
    assert payload["record_type"] == "excellent_bid"
    assert payload["status"] == "awaiting_review"
    assert payload["source_priority"] == "excellent_bid"

    detail = client.get(f"/api/v1/workbench/library/records/{payload['id']}", headers=headers)
    assert detail.status_code == 200, detail.text
    detail_payload = detail.json()
    assert len(detail_payload["chunks"]) >= 2
    assert any("质量保证体系" in chunk["content"] for chunk in detail_payload["chunks"])

    search = client.get(
        "/api/v1/workbench/library/search",
        params={"q": "质量保证体系", "record_type": "excellent_bid"},
        headers=headers,
    )
    assert search.status_code == 200, search.text
    search_payload = search.json()
    assert len(search_payload) >= 1
    assert search_payload[0]["record"]["id"] == payload["id"]


def test_company_performance_record_accepts_attachment_upload_and_exposes_chunks() -> None:
    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/workbench/library/company-performances",
        json={
            "title": "某变电站总承包业绩",
            "project_id": None,
            "project_category": "变电工程",
            "owner_name": "市场经营中心",
            "contract_name": "110kV 变电站总承包合同",
            "project_features": "新建变电站及配套线路",
            "contract_amount": "1280万元",
            "start_date": "2024-02-01",
            "completion_date": "2024-12-20",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    record_id = created.json()["id"]
    assert created.json()["status"] == "published"

    attachment = client.post(
        f"/api/v1/workbench/library/records/{record_id}/attachments/upload",
        data={"attachment_role": "proof_owner_review"},
        files={
            "file": (
                "owner-review.pdf",
                "%PDF-1.4\n业主评价：施工组织优秀，质量控制到位。".encode("utf-8"),
                "application/pdf",
            )
        },
        headers=headers,
    )
    assert attachment.status_code == 201, attachment.text
    attachment_payload = attachment.json()
    assert attachment_payload["attachment_role"] == "proof_owner_review"
    assert attachment_payload["ocr_status"] in {"parsed", "stored"}

    detail = client.get(f"/api/v1/workbench/library/records/{record_id}", headers=headers)
    assert detail.status_code == 200, detail.text
    detail_payload = detail.json()
    assert len(detail_payload["attachments"]) == 1
    assert len(detail_payload["chunks"]) >= 1

    search = client.get(
        "/api/v1/workbench/library/search",
        params={"q": "质量控制到位", "record_type": "company_performance"},
        headers=headers,
    )
    assert search.status_code == 200, search.text
    search_payload = search.json()
    assert len(search_payload) >= 1
    assert search_payload[0]["record"]["id"] == record_id


def test_upload_library_document_record_creates_document_and_record_in_one_step() -> None:
    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    project = client.post("/api/v1/projects", json={"name": "Direct Upload Library Project"}, headers=headers)
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    created = client.post(
        "/api/v1/workbench/library/document-records/upload",
        data={
            "project_id": str(project_id),
            "record_type": "historical_bid",
            "title": "某用户工程历史投标文件",
            "project_category": "用户工程",
            "owner_name": "市场经营中心",
        },
        files={
            "file": (
                "history.docx",
                _build_docx(
                    ("Heading1", "第一章 项目概况"),
                    ("Normal", "本项目属于用户工程，重点在设备安装与调试。"),
                ),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    payload = created.json()
    assert payload["record_type"] == "historical_bid"
    assert payload["source_document_id"] is not None
    assert payload["project_category"] == "用户工程"

    detail = client.get(f"/api/v1/workbench/library/records/{payload['id']}", headers=headers)
    assert detail.status_code == 200, detail.text
    detail_payload = detail.json()
    assert len(detail_payload["chunks"]) >= 1
