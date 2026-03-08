from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile
import json

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import RequirementConstraint, TenderRequirement
from app.db.session import SessionLocal
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
<w:p>
  <w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr>
  <w:r><w:t>{title}</w:t></w:r>
</w:p>
<w:p>
  <w:r><w:t>{text}</w:t></w:r>
</w:p>
""".strip()
        )

    document = f"""<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">
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


def test_decomposition_run_builds_seven_category_summary_and_requirement_rows() -> None:
    client = TestClient(app)
    token = _login(client)

    created_project = client.post(
        "/api/v1/projects",
        json={"name": "Tender Decomposition Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert created_project.status_code == 201
    project_id = created_project.json()["id"]

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/documents/upload",
        data={"document_type": "tender"},
        files={
            "file": (
                "tender-analysis.docx",
                _build_tender_docx(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]

    created_run = client.post(
        "/api/v1/workbench/decomposition/runs",
        json={
            "project_id": project_id,
            "source_document_id": document_id,
            "run_name": "招标文件七类拆解",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert created_run.status_code == 201, created_run.text

    payload = created_run.json()
    assert payload["status"] == "completed"
    assert payload["progress_pct"] == 100
    summary = json.loads(payload["summary_json"])
    assert summary["source_document_id"] == document_id
    assert {category["category_key"] for category in summary["categories"]} == {
        "basic_info",
        "qualification_requirements",
        "evaluation_criteria",
        "bidding_requirements",
        "invalid_bid_terms",
        "submission_checklist",
        "contract_risks",
    }
    assert summary["totals"]["items"] >= 7

    with SessionLocal() as db:
        requirements = list(
            db.scalars(
                select(TenderRequirement).where(
                    TenderRequirement.project_id == project_id,
                    TenderRequirement.source_document_id == document_id,
                )
            )
        )
        constraints = list(
            db.scalars(
                select(RequirementConstraint).where(RequirementConstraint.project_id == project_id)
            )
        )

    assert len(requirements) >= 7
    assert any(row.requirement_type == "qualification_requirements" for row in requirements)
    assert any(row.source_anchor.startswith("section-") for row in requirements)
    assert constraints
