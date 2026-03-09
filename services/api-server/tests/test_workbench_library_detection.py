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


def _build_sensitive_docx() -> bytes:
    return _build_docx(
        ("Heading1", "第一章 项目概况"),
        ("Normal", "项目经理张三于2026年3月8日提交报价，金额100万元，工期180日历天。"),
    )


def _create_project_and_headers(client: TestClient) -> tuple[int, dict[str, str]]:
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    project = client.post("/api/v1/projects", json={"name": "Library Detection Project"}, headers=headers)
    assert project.status_code == 201, project.text
    return project.json()["id"], headers


def _upload_document(
    client: TestClient,
    *,
    project_id: int,
    headers: dict[str, str],
    document_type: str,
    filename: str,
    payload: bytes,
) -> int:
    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": document_type},
        files={"file": (filename, payload, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=headers,
    )
    assert uploaded.status_code == 201, uploaded.text
    return uploaded.json()["id"]


def test_library_run_check_detects_sensitive_markers_from_uploaded_document() -> None:
    client = TestClient(app)
    project_id, headers = _create_project_and_headers(client)
    document_id = _upload_document(
        client,
        project_id=project_id,
        headers=headers,
        document_type="proposal",
        filename="sensitive-library.docx",
        payload=_build_sensitive_docx(),
    )

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


def test_library_entry_for_norm_document_auto_runs_clause_detection_and_model_summary(monkeypatch) -> None:
    client = TestClient(app)
    project_id, headers = _create_project_and_headers(client)
    document_id = _upload_document(
        client,
        project_id=project_id,
        headers=headers,
        document_type="norm",
        filename="construction-norm.docx",
        payload=_build_docx(
            ("Heading1", "第一章 总则"),
            ("Normal", "1.0.1 本规范适用于建筑电气安装工程。"),
            ("Normal", "1.0.2 施工前应完成图纸会审。"),
            ("Heading1", "第二章 质量要求"),
            ("Normal", "2.1 材料管理。"),
            ("Normal", "2.1.1 材料进场应提供出厂合格证。"),
        ),
    )
    monkeypatch.setattr(
        "app.services.norm_ingestion_checks._try_model_supplement_summary",
        lambda **_kwargs: "本规范覆盖适用范围、施工准备与质量验收要求，建议按章-条双索引入库。",
    )

    entry = client.post(
        "/api/v1/workbench/library/entries",
        json={
            "project_id": project_id,
            "source_document_id": document_id,
            "category": "company_performance_asset",
            "title": "房建电气安装规范",
            "owner_name": "技术质量部",
        },
        headers=headers,
    )
    assert entry.status_code == 201, entry.text

    payload = entry.json()
    assert payload["detection_status"] == "checked"
    assert "规则抽条款号得到" in payload["detected_summary"]
    assert "1.0.1" in payload["detected_summary"]
    assert "摘要补全（1M模型补结）" in payload["detected_summary"]
    assert "规则验树通过" in payload["detected_summary"]


def test_library_entry_for_norm_document_flags_tree_issues_and_uses_summary_fallback(monkeypatch) -> None:
    client = TestClient(app)
    project_id, headers = _create_project_and_headers(client)
    document_id = _upload_document(
        client,
        project_id=project_id,
        headers=headers,
        document_type="norm",
        filename="broken-tree-norm.docx",
        payload=_build_docx(
            ("Heading1", "第一章 总则"),
            ("Normal", "1.2.1 未建立父条款时直接出现三级条款。"),
            ("Heading1", "第二章 验收要求"),
            ("Normal", "2.1.1 竣工验收前应完成隐蔽工程记录。"),
        ),
    )
    monkeypatch.setattr(
        "app.services.norm_ingestion_checks._try_model_supplement_summary",
        lambda **_kwargs: None,
    )

    entry = client.post(
        "/api/v1/workbench/library/entries",
        json={
            "project_id": project_id,
            "source_document_id": document_id,
            "category": "company_performance_asset",
            "title": "结构异常规范",
            "owner_name": "工程管理部",
        },
        headers=headers,
    )
    assert entry.status_code == 201, entry.text

    payload = entry.json()
    assert payload["detection_status"] == "attention_needed"
    assert "摘要补全（规则摘要回退）" in payload["detected_summary"]
    assert "缺少父条款 1.2" in payload["detected_summary"]
