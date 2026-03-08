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



def _build_tender_docx() -> bytes:
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
<w:p><w:r><w:t>项目名称：浙江输变电工程。</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr><w:r><w:t>第二章 资格要求</w:t></w:r></w:p>
<w:p><w:r><w:t>投标人须具备电力工程施工总承包一级资质。</w:t></w:r></w:p>
</w:body></w:document>"""
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)
    return buffer.getvalue()



def test_project_document_source_artifact_can_be_downloaded() -> None:
    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    project = client.post("/api/v1/projects", json={"name": "Artifact Download Project"}, headers=headers)
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    source_bytes = _build_tender_docx()
    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={
            "file": (
                "downloadable.docx",
                source_bytes,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers=headers,
    )
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]

    downloaded = client.get(
        f"/api/v1/projects/{project_id}/documents/{document_id}/artifacts/source",
        headers=headers,
    )
    assert downloaded.status_code == 200, downloaded.text
    assert downloaded.content == source_bytes



def test_layout_output_can_be_downloaded() -> None:
    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    project = client.post("/api/v1/projects", json={"name": "Layout Download Project"}, headers=headers)
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={
            "file": (
                "layout-download.docx",
                _build_tender_docx(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers=headers,
    )
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]

    decomposition = client.post(
        "/api/v1/workbench/decomposition/runs",
        json={"project_id": project_id, "source_document_id": document_id, "run_name": "七类拆解"},
        headers=headers,
    )
    assert decomposition.status_code == 201, decomposition.text

    generation = client.post(
        "/api/v1/workbench/generation/jobs",
        json={
            "project_id": project_id,
            "source_document_id": document_id,
            "job_name": "技术标初稿生成",
            "target_sections": 3,
        },
        headers=headers,
    )
    assert generation.status_code == 201, generation.text

    layout = client.post(
        "/api/v1/workbench/layout/jobs",
        json={
            "project_id": project_id,
            "source_document_id": document_id,
            "job_name": "企业模板排版",
            "template_name": "corporate-default",
        },
        headers=headers,
    )
    assert layout.status_code == 201, layout.text
    layout_id = layout.json()["id"]

    outputs = client.get(f"/api/v1/workbench/layout/jobs/{layout_id}/outputs", headers=headers)
    assert outputs.status_code == 200, outputs.text
    output_id = outputs.json()[0]["id"]

    downloaded = client.get(f"/api/v1/workbench/layout/outputs/{output_id}/download", headers=headers)
    assert downloaded.status_code == 200, downloaded.text
    assert downloaded.content.startswith(b"PK")
