from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi.testclient import TestClient

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


def _upload_parsed_docx_document(client: TestClient, token: str, project_name: str) -> int:
    project_response = client.post(
        "/api/v1/projects",
        json={"name": project_name},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    docx_payload = _build_minimal_docx(
        ("Heading1", "第一章 项目概况"),
        ("Normal", "本项目用于历史标书入库测试。"),
        ("Heading1", "第二章 质量保证措施"),
        ("Normal", "项目经理张三承诺于2024年12月31日前完成浙江示范工程质量目标。"),
    )
    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "proposal"},
        files={
            "file": (
                "historical-outline.docx",
                docx_payload,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert uploaded.status_code == 201
    return uploaded.json()["id"]


def test_import_historical_bid_from_parsed_document_and_list_records() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")
    document_id = _upload_parsed_docx_document(client, token, "Historical Import Project")

    imported = client.post(
        "/api/v1/historical-bids/import",
        json={
            "document_id": document_id,
            "source_type": "won_bid",
            "project_type": "power_engineering",
            "region": "zhejiang",
            "year": 2024,
            "is_recommended": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert imported.status_code == 201, imported.text
    payload = imported.json()
    assert payload["document_id"] == document_id
    assert payload["source_type"] == "won_bid"
    assert payload["project_type"] == "power_engineering"
    assert payload["region"] == "zhejiang"
    assert payload["year"] == 2024
    assert payload["is_recommended"] is True

    listed = client.get(
        "/api/v1/historical-bids",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed.status_code == 200
    assert any(item["document_id"] == document_id for item in listed.json())


def test_rebuild_historical_bid_sections_and_list_them() -> None:
    client = TestClient(app)
    token = _login(client, "project_manager@example.com", "manager123456")
    document_id = _upload_parsed_docx_document(client, token, "Historical Section Project")

    imported = client.post(
        "/api/v1/historical-bids/import",
        json={
            "document_id": document_id,
            "source_type": "excellent_sample",
            "project_type": "power_engineering",
            "region": "zhejiang",
            "year": 2023,
            "is_recommended": False,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert imported.status_code == 201, imported.text
    historical_bid_id = imported.json()["id"]

    rebuilt = client.post(
        f"/api/v1/historical-bids/{historical_bid_id}/rebuild-sections",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rebuilt.status_code == 200

    sections = client.get(
        f"/api/v1/historical-bids/{historical_bid_id}/sections",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert sections.status_code == 200
    payload = sections.json()
    assert len(payload) == 2
    assert payload[0]["title"] == "第一章 项目概况"
    assert payload[0]["section_type"] == "project_overview"
    assert payload[0]["anchor"] == "section-1"
    assert payload[1]["title"] == "第二章 质量保证措施"
    assert payload[1]["section_type"] == "quality_assurance"
