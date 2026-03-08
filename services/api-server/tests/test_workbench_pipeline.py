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
    sections = [
        ("第一章 项目概况", "项目名称：浙江输变电工程。招标人：国网浙江省电力有限公司。"),
        ("第二章 资格要求", "投标人须具备电力工程施工总承包一级资质。项目经理须具备一级建造师。"),
        ("第三章 评审标准", "商务部分40分，技术部分60分，报价部分按低价优先。"),
        ("第四章 投标要求", "投标文件应在2026年4月1日前提交，并按要求密封。"),
        ("第五章 废标条款", "未按要求签字盖章的投标文件将被否决。"),
        ("第六章 提交清单", "需提交营业执照、资质证书、人员证书原件扫描件。"),
        ("第七章 合同条款", "付款周期90天，违约金按合同总额5%计算。"),
    ]
    body = []
    for title, text in sections:
        body.append(
            f"""
<w:p><w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr><w:r><w:t>{title}</w:t></w:r></w:p>
<w:p><w:r><w:t>{text}</w:t></w:r></w:p>
""".strip()
        )
    document = f"""<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>{''.join(body)}</w:body></w:document>"""
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)
    return buffer.getvalue()


def test_workbench_pipeline_builds_generation_review_layout_and_feed_back() -> None:
    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    created_project = client.post("/api/v1/projects", json={"name": "Workbench Pipeline Project"}, headers=headers)
    assert created_project.status_code == 201
    project_id = created_project.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={
            "file": (
                "pipeline-tender.docx",
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
    assert decomposition.json()["status"] == "completed"

    generation = client.post(
        "/api/v1/workbench/generation/jobs",
        json={
            "project_id": project_id,
            "source_document_id": document_id,
            "job_name": "技术标初稿生成",
            "target_sections": 4,
        },
        headers=headers,
    )
    assert generation.status_code == 201, generation.text
    assert generation.json()["status"] == "completed"
    generation_id = generation.json()["id"]

    sections = client.get(f"/api/v1/workbench/generation/jobs/{generation_id}/sections", headers=headers)
    assert sections.status_code == 200, sections.text
    assert len(sections.json()) >= 3
    assert any(item["title"] == "资格响应" for item in sections.json())

    review = client.post(
        "/api/v1/workbench/review/runs",
        json={
            "project_id": project_id,
            "source_document_id": document_id,
            "run_name": "合规评审",
            "review_mode": "simulated_scoring",
        },
        headers=headers,
    )
    assert review.status_code == 201, review.text
    assert review.json()["status"] == "completed"
    assert review.json()["simulated_score"] is not None
    review_id = review.json()["id"]

    issues = client.get(f"/api/v1/workbench/review/runs/{review_id}/issues", headers=headers)
    assert issues.status_code == 200, issues.text
    assert issues.json()

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
    assert layout.json()["status"] == "completed"
    layout_id = layout.json()["id"]

    outputs = client.get(f"/api/v1/workbench/layout/jobs/{layout_id}/outputs", headers=headers)
    assert outputs.status_code == 200, outputs.text
    assert outputs.json()
    assert outputs.json()[0]["output_type"] == "docx"

    submission = client.post(
        "/api/v1/workbench/submission-records",
        json={
            "project_id": project_id,
            "source_document_id": document_id,
            "title": "浙江输变电项目投标文件",
            "status": "won",
        },
        headers=headers,
    )
    assert submission.status_code == 201, submission.text
    submission_id = submission.json()["id"]

    feed_back = client.post(
        f"/api/v1/workbench/submission-records/{submission_id}/feed-to-library",
        headers=headers,
    )
    assert feed_back.status_code == 201, feed_back.text
    assert feed_back.json()["category"] == "excellent_bid"
    assert feed_back.json()["title"] == "浙江输变电项目投标文件"


def test_generation_persists_verification_issues_and_evidence_binding_foreign_keys() -> None:
    from sqlalchemy import select

    from app.db.models import EvidenceUnit, SectionEvidenceBinding, VerificationIssue
    from app.db.session import SessionLocal

    client = TestClient(app)
    token = _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    created_project = client.post("/api/v1/projects", json={"name": "Verification Pipeline Project"}, headers=headers)
    assert created_project.status_code == 201, created_project.text
    project_id = created_project.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={
            "file": (
                "verification-pipeline.docx",
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
            "target_sections": 4,
        },
        headers=headers,
    )
    assert generation.status_code == 201, generation.text
    generation_id = generation.json()["id"]

    verification_response = client.get(
        f"/api/v1/workbench/generation/jobs/{generation_id}/verification-issues",
        headers=headers,
    )
    assert verification_response.status_code == 200, verification_response.text

    with SessionLocal() as db:
        evidence_unit = db.scalar(select(EvidenceUnit).where(EvidenceUnit.document_id == document_id).order_by(EvidenceUnit.id.asc()))
        assert evidence_unit is not None

        bindings = list(
            db.scalars(
                select(SectionEvidenceBinding)
                .where(SectionEvidenceBinding.project_id == project_id)
                .order_by(SectionEvidenceBinding.id.asc())
            )
        )
        assert bindings
        assert any(binding.evidence_unit_id is not None for binding in bindings)

    with SessionLocal() as db:
        db.query(EvidenceUnit).where(EvidenceUnit.document_id == document_id).delete(synchronize_session=False)
        db.commit()

    regeneration = client.post(
        "/api/v1/workbench/generation/jobs",
        json={
            "project_id": project_id,
            "source_document_id": document_id,
            "job_name": "技术标再次生成",
            "target_sections": 4,
        },
        headers=headers,
    )
    assert regeneration.status_code == 201, regeneration.text
    regeneration_id = regeneration.json()["id"]

    verification_response = client.get(
        f"/api/v1/workbench/generation/jobs/{regeneration_id}/verification-issues",
        headers=headers,
    )
    assert verification_response.status_code == 200, verification_response.text
    assert verification_response.json()
    assert any(item["issue_type"] == "missing_evidence_binding" for item in verification_response.json())

    with SessionLocal() as db:
        persisted_issues = list(
            db.scalars(
                select(VerificationIssue)
                .where(VerificationIssue.project_id == project_id)
                .order_by(VerificationIssue.id.asc())
            )
        )
        assert persisted_issues
        assert any(issue.issue_type == "missing_evidence_binding" for issue in persisted_issues)
