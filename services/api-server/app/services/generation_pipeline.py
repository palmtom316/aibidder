import json

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import (
    EvidenceUnit,
    GeneratedSection,
    GenerationJob,
    SectionEvidenceBinding,
    TenderRequirement,
    VerificationIssue,
)

SECTION_BLUEPRINTS = [
    ("project_overview", "项目概况", ["basic_info"]),
    ("qualification_response", "资格响应", ["qualification_requirements"]),
    ("evaluation_response", "评审响应", ["evaluation_criteria"]),
    (
        "compliance_commitment",
        "投标承诺",
        ["bidding_requirements", "invalid_bid_terms", "submission_checklist", "contract_risks"],
    ),
]


def execute_generation_job(db: Session, job: GenerationJob) -> GenerationJob:
    if job.source_document_id is None:
        job.status = "failed"
        db.commit()
        db.refresh(job)
        return job

    requirements = list(
        db.scalars(
            select(TenderRequirement).where(
                TenderRequirement.project_id == job.project_id,
                TenderRequirement.source_document_id == job.source_document_id,
            )
        )
    )
    if not requirements:
        job.status = "failed"
        db.commit()
        db.refresh(job)
        return job

    generated_ids = list(
        db.scalars(
            select(GeneratedSection.id).where(
                GeneratedSection.project_id == job.project_id,
                GeneratedSection.source_document_id == job.source_document_id,
            )
        )
    )
    if generated_ids:
        db.execute(delete(SectionEvidenceBinding).where(SectionEvidenceBinding.generated_section_id.in_(generated_ids)))
        db.execute(delete(VerificationIssue).where(VerificationIssue.generated_section_id.in_(generated_ids)))
    db.execute(
        delete(GeneratedSection).where(
            GeneratedSection.project_id == job.project_id,
            GeneratedSection.source_document_id == job.source_document_id,
        )
    )
    db.flush()

    evidence_by_anchor = _load_evidence_units_by_anchor(db, project_id=job.project_id, source_document_id=job.source_document_id)

    created_count = 0
    by_type: dict[str, list[TenderRequirement]] = {}
    for requirement in requirements:
        by_type.setdefault(requirement.requirement_type, []).append(requirement)

    for section_key, title, categories in SECTION_BLUEPRINTS:
        matched = [item for category in categories for item in by_type.get(category, [])]
        if not matched:
            continue

        draft_lines = [f"{title}："]
        evidence = []
        section_missing_anchors: list[str] = []
        for item in matched:
            draft_lines.append(f"- {item.title}：{item.detail}")
            evidence.append(
                {
                    "requirement_type": item.requirement_type,
                    "source_anchor": item.source_anchor,
                    "priority": item.priority,
                }
            )
            if item.source_anchor and item.source_anchor not in evidence_by_anchor:
                section_missing_anchors.append(item.source_anchor)

        section = GeneratedSection(
            organization_id=job.organization_id,
            project_id=job.project_id,
            source_document_id=job.source_document_id,
            section_key=section_key,
            title=title,
            status="draft",
            draft_text="\n".join(draft_lines),
            evidence_summary_json=json.dumps(evidence, ensure_ascii=False),
            created_by_user_id=job.created_by_user_id,
        )
        db.add(section)
        db.flush()
        created_count += 1

        for item in matched:
            evidence_unit = evidence_by_anchor.get(item.source_anchor)
            db.add(
                SectionEvidenceBinding(
                    organization_id=job.organization_id,
                    project_id=job.project_id,
                    generated_section_id=section.id,
                    evidence_unit_id=getattr(evidence_unit, 'id', None),
                    binding_type="requirement_anchor",
                    quote_text=item.detail[:200],
                    anchor=item.source_anchor,
                )
            )

        if section_missing_anchors:
            db.add(
                VerificationIssue(
                    organization_id=job.organization_id,
                    project_id=job.project_id,
                    generated_section_id=section.id,
                    severity="warning",
                    issue_type="missing_evidence_binding",
                    title=f"{title}缺少可追溯证据绑定",
                    detail="未找到以下锚点对应的证据单元：" + "、".join(sorted(set(section_missing_anchors))),
                    status="open",
                )
            )

        if len(section.draft_text.strip()) < 30:
            db.add(
                VerificationIssue(
                    organization_id=job.organization_id,
                    project_id=job.project_id,
                    generated_section_id=section.id,
                    severity="warning",
                    issue_type="thin_section_content",
                    title=f"{title}生成内容偏少",
                    detail="章节内容过短，建议补充更完整的响应文本。",
                    status="open",
                )
            )

    job.status = "completed"
    job.target_sections = created_count
    db.commit()
    db.refresh(job)
    return job


def _load_evidence_units_by_anchor(db: Session, *, project_id: int, source_document_id: int) -> dict[str, EvidenceUnit]:
    units = list(
        db.scalars(
            select(EvidenceUnit)
            .where(EvidenceUnit.project_id == project_id, EvidenceUnit.document_id == source_document_id)
            .order_by(EvidenceUnit.id.asc())
        )
    )
    by_anchor: dict[str, EvidenceUnit] = {}
    for unit in units:
        if unit.anchor and unit.anchor not in by_anchor:
            by_anchor[unit.anchor] = unit
    return by_anchor
