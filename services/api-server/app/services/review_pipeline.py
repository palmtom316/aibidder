import json

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.models import GeneratedSection, ReviewIssue, ReviewRun, TenderRequirement


def execute_review_run(db: Session, run: ReviewRun) -> ReviewRun:
    if run.source_document_id is None:
        run.status = "failed"
        db.commit()
        db.refresh(run)
        return run

    sections = list(
        db.scalars(
            select(GeneratedSection).where(
                GeneratedSection.project_id == run.project_id,
                GeneratedSection.source_document_id == run.source_document_id,
            )
        )
    )
    db.execute(delete(ReviewIssue).where(ReviewIssue.review_run_id == run.id))
    db.flush()

    issues: list[ReviewIssue] = []
    requirements = list(
        db.scalars(
            select(TenderRequirement).where(
                TenderRequirement.project_id == run.project_id,
                TenderRequirement.source_document_id == run.source_document_id,
            )
        )
    )
    requirement_types = {item.requirement_type for item in requirements}

    if not sections:
        issues.append(
            ReviewIssue(
                organization_id=run.organization_id,
                project_id=run.project_id,
                review_run_id=run.id,
                severity="error",
                category="generation",
                title="缺少生成内容",
                detail="尚未找到任何生成章节，请先执行标书生成。",
                is_blocking=True,
                status="open",
            )
        )
    else:
        for section in sections:
            evidence = json.loads(section.evidence_summary_json or "[]")
            if len(section.draft_text.strip()) < 30:
                issues.append(
                    ReviewIssue(
                        organization_id=run.organization_id,
                        project_id=run.project_id,
                        review_run_id=run.id,
                        generated_section_id=section.id,
                        severity="warning",
                        category="content",
                        title=f"{section.title}内容偏少",
                        detail="建议补充更完整的章节响应内容。",
                        is_blocking=False,
                        status="open",
                    )
                )
            if not evidence:
                issues.append(
                    ReviewIssue(
                        organization_id=run.organization_id,
                        project_id=run.project_id,
                        review_run_id=run.id,
                        generated_section_id=section.id,
                        severity="error",
                        category="evidence",
                        title=f"{section.title}缺少证据绑定",
                        detail="该章节未引用任何拆解要求，需要补充证据来源。",
                        is_blocking=True,
                        status="open",
                    )
                )

        if "contract_risks" in requirement_types:
            issues.append(
                ReviewIssue(
                    organization_id=run.organization_id,
                    project_id=run.project_id,
                    review_run_id=run.id,
                    severity="warning",
                    category="contract_risk",
                    title="合同风险需人工复核",
                    detail="检测到合同风险条款，建议人工复核付款周期与违约责任。",
                    is_blocking=False,
                    status="open",
                )
            )

    for issue in issues:
        db.add(issue)

    blocking_count = sum(1 for issue in issues if issue.is_blocking)
    run.blocking_issue_count = blocking_count
    run.simulated_score = max(60, 100 - len(issues) * 5 - blocking_count * 10)
    run.status = "completed"
    db.commit()
    db.refresh(run)
    return run



def remediate_review_issue(db: Session, issue: ReviewIssue) -> GeneratedSection:
    if issue.generated_section_id is None:
        raise ValueError("Review issue is not bound to a generated section")

    section = db.get(GeneratedSection, issue.generated_section_id)
    if section is None:
        raise ValueError("Generated section not found")

    remediation_lines = [
        section.draft_text.strip(),
        "整改说明：已根据评审意见补充该章节响应内容，并补强关键约束的落实说明。",
        f"- 问题类型：{issue.category}",
        f"- 处理意见：{issue.detail}",
    ]
    section.draft_text = "\n".join(line for line in remediation_lines if line)
    section.status = "rewritten"
    issue.status = "resolved"

    blocking_open_count = db.scalar(
        select(func.count())
        .select_from(ReviewIssue)
        .where(
            ReviewIssue.review_run_id == issue.review_run_id,
            ReviewIssue.is_blocking.is_(True),
            ReviewIssue.status != "resolved",
        )
    ) or 0

    run = db.get(ReviewRun, issue.review_run_id)
    if run is not None:
        run.blocking_issue_count = int(blocking_open_count)
        if run.simulated_score is not None:
            run.simulated_score = min(100, run.simulated_score + 5)

    db.commit()
    db.refresh(section)
    return section
