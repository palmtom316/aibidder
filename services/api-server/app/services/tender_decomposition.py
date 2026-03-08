import json
from datetime import datetime, timezone
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.storage import read_text_artifact

from app.db.models import (
    DecompositionRun,
    DocumentArtifact,
    DocumentVersion,
    RequirementConstraint,
    TenderRequirement,
)

CATEGORY_DEFINITIONS = [
    {
        "key": "basic_info",
        "label": "基本信息",
        "keywords": ["项目概况", "项目名称", "招标人", "工程名称", "基本情况"],
        "priority": "normal",
        "severity": "info",
    },
    {
        "key": "qualification_requirements",
        "label": "资格要求",
        "keywords": ["资格要求", "资质", "资格审查", "建造师", "项目经理", "许可证"],
        "priority": "high",
        "severity": "error",
    },
    {
        "key": "evaluation_criteria",
        "label": "评审标准",
        "keywords": ["评审标准", "评分", "商务部分", "技术部分", "报价部分", "打分"],
        "priority": "high",
        "severity": "warning",
    },
    {
        "key": "bidding_requirements",
        "label": "投标要求",
        "keywords": ["投标要求", "提交", "密封", "截止", "投标文件应", "递交"],
        "priority": "high",
        "severity": "warning",
    },
    {
        "key": "invalid_bid_terms",
        "label": "废标条款",
        "keywords": ["废标", "否决", "无效标", "将被否决", "不予受理"],
        "priority": "critical",
        "severity": "error",
    },
    {
        "key": "submission_checklist",
        "label": "提交清单",
        "keywords": ["提交清单", "营业执照", "证书", "原件", "扫描件", "附件"],
        "priority": "high",
        "severity": "warning",
    },
    {
        "key": "contract_risks",
        "label": "合同风险",
        "keywords": ["合同", "付款", "违约金", "索赔", "风险", "工期责任"],
        "priority": "high",
        "severity": "warning",
    },
]
CATEGORY_MAP = {item["key"]: item for item in CATEGORY_DEFINITIONS}


def execute_decomposition_run(db: Session, run: DecompositionRun) -> DecompositionRun:
    if run.source_document_id is None:
        run.status = "failed"
        run.progress_pct = 100
        run.summary_json = json.dumps({"error": "missing_source_document_id"}, ensure_ascii=False)
        db.commit()
        db.refresh(run)
        return run

    payload = _load_document_payload(db, run.source_document_id)
    if payload is None:
        run.status = "failed"
        run.progress_pct = 100
        run.summary_json = json.dumps({"error": "parsed_document_not_found"}, ensure_ascii=False)
        db.commit()
        db.refresh(run)
        return run

    sections = payload.get("sections", [])
    categorized_items = {definition["key"]: [] for definition in CATEGORY_DEFINITIONS}

    _clear_previous_results(db, run.project_id, run.source_document_id)

    for index, section in enumerate(sections, start=1):
        title = (section.get("title") or f"Section {index}").strip()
        content = (section.get("content") or title).strip()
        anchor = (section.get("anchor") or f"section-{index}").strip()
        page = int(section.get("page") or 1)
        category_key = _classify_section(title=title, content=content)
        category = CATEGORY_MAP[category_key]
        item = {
            "title": title,
            "detail": content,
            "source_anchor": anchor,
            "page": page,
            "source_excerpt": _short_excerpt(content),
            "priority": category["priority"],
        }
        categorized_items[category_key].append(item)

        requirement = TenderRequirement(
            organization_id=run.organization_id,
            project_id=run.project_id,
            source_document_id=run.source_document_id,
            requirement_type=category_key,
            title=title,
            detail=content,
            source_anchor=anchor,
            priority=category["priority"],
            created_by_user_id=run.created_by_user_id,
        )
        db.add(requirement)
        db.flush()

        if _should_create_constraint(category_key, content):
            db.add(
                RequirementConstraint(
                    organization_id=run.organization_id,
                    project_id=run.project_id,
                    tender_requirement_id=requirement.id,
                    constraint_type=category_key,
                    constraint_key=title[:128],
                    expected_value=content,
                    severity=category["severity"],
                    source_anchor=anchor,
                )
            )

    summary = {
        "source_document_id": run.source_document_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "categories": [
            {
                "category_key": definition["key"],
                "label": definition["label"],
                "count": len(categorized_items[definition["key"]]),
                "items": categorized_items[definition["key"]],
            }
            for definition in CATEGORY_DEFINITIONS
        ],
        "totals": {
            "sections": len(sections),
            "items": sum(len(items) for items in categorized_items.values()),
        },
    }
    run.status = "completed"
    run.progress_pct = 100
    run.summary_json = json.dumps(summary, ensure_ascii=False)
    db.commit()
    db.refresh(run)
    return run


def _load_document_payload(db: Session, document_id: int) -> dict | None:
    json_artifact = db.scalar(
        select(DocumentArtifact)
        .join(DocumentVersion, DocumentVersion.id == DocumentArtifact.document_version_id)
        .where(
            DocumentVersion.document_id == document_id,
            DocumentArtifact.artifact_type == "json",
        )
        .order_by(DocumentVersion.version_no.desc(), DocumentArtifact.id.desc())
    )
    if json_artifact is None:
        return None
    return json.loads(read_text_artifact(json_artifact.storage_path))


def _clear_previous_results(db: Session, project_id: int, source_document_id: int) -> None:
    requirement_ids = list(
        db.scalars(
            select(TenderRequirement.id).where(
                TenderRequirement.project_id == project_id,
                TenderRequirement.source_document_id == source_document_id,
            )
        )
    )
    if requirement_ids:
        db.execute(delete(RequirementConstraint).where(RequirementConstraint.tender_requirement_id.in_(requirement_ids)))
    db.execute(
        delete(TenderRequirement).where(
            TenderRequirement.project_id == project_id,
            TenderRequirement.source_document_id == source_document_id,
        )
    )
    db.flush()


def _classify_section(*, title: str, content: str) -> str:
    text = f"{title}\n{content}".lower()
    for definition in CATEGORY_DEFINITIONS:
        if any(keyword.lower() in text for keyword in definition["keywords"]):
            return definition["key"]
    return "basic_info"


def _should_create_constraint(category_key: str, content: str) -> bool:
    if category_key in {"basic_info"}:
        return False
    markers = ("须", "应", "需", "不得", "否决", "提交", "付款", "违约")
    return any(marker in content for marker in markers)


def _short_excerpt(content: str, limit: int = 160) -> str:
    compact = " ".join(content.split())
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit].rstrip()}..."
