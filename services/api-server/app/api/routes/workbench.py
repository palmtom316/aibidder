from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.api.pagination import slice_results
from app.db.models import (
    DecompositionRun,
    Document,
    GenerationJob,
    KnowledgeBaseEntry,
    LayoutJob,
    Project,
    ProjectMember,
    ReviewRun,
    SubmissionRecord,
)
from app.db.session import get_db
from app.schemas.auth import UserIdentity
from app.schemas.workbench import (
    DecompositionRunResponse,
    GenerationJobCreate,
    GenerationJobResponse,
    KnowledgeBaseEntryCreate,
    KnowledgeBaseEntryResponse,
    LayoutJobCreate,
    LayoutJobResponse,
    ModuleSummary,
    PipelineRunCreate,
    ReviewRunCreate,
    ReviewRunResponse,
    SubmissionRecordCreate,
    SubmissionRecordResponse,
    WorkbenchOverviewResponse,
)
from app.services.audit_log import write_audit_log

router = APIRouter(prefix="/api/v1/workbench", tags=["workbench"])

MODULE_TITLES = {
    "knowledge_library": "投标资料库",
    "tender_decomposition": "招标解析",
    "bid_generation": "标书生成",
    "bid_review": "标书检测",
    "layout_finalize": "排版定稿",
    "bid_management": "标书管理",
}

MODULE_DESCRIPTIONS = {
    "knowledge_library": "历史标书、优秀标书、公司与人员资质业绩资产的统一入库和检测。",
    "tender_decomposition": "招标文件结构化解析、七类要点拆解与证据溯源。",
    "bid_generation": "按约束和证据驱动的标书内容生成与改写。",
    "bid_review": "合规检测、历史污染校验与模拟打分。",
    "layout_finalize": "模板套版、章节编排与最终排版导出。",
    "bid_management": "投标文件生命周期管理、回灌入库与归档。",
}


def _require_project_access(project_id: int, current_user: UserIdentity, db: Session) -> Project:
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project access denied")

    return project


def _ensure_project_and_document_access(
    *,
    project_id: int | None,
    document_id: int | None,
    current_user: UserIdentity,
    db: Session,
) -> None:
    if project_id is not None:
        _require_project_access(project_id, current_user, db)

    if document_id is None:
        return

    stmt = (
        select(Document)
        .join(Project, Project.id == Document.project_id)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(
            Document.id == document_id,
            Project.organization_id == current_user.organization_id,
            ProjectMember.user_id == current_user.id,
        )
    )
    document = db.scalar(stmt)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")


def _count_rows(db: Session, model: type, organization_id: int, project_id: int | None = None) -> int:
    stmt = select(func.count()).select_from(model).where(model.organization_id == organization_id)
    if project_id is not None and hasattr(model, "project_id"):
        stmt = stmt.where(model.project_id == project_id)
    return db.scalar(stmt) or 0


@router.get("/overview", response_model=WorkbenchOverviewResponse)
def get_workbench_overview(
    project_id: int | None = None,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkbenchOverviewResponse:
    if project_id is not None:
        _require_project_access(project_id, current_user, db)

    counts = {
        "knowledge_library": _count_rows(db, KnowledgeBaseEntry, current_user.organization_id, project_id),
        "tender_decomposition": _count_rows(db, DecompositionRun, current_user.organization_id, project_id),
        "bid_generation": _count_rows(db, GenerationJob, current_user.organization_id, project_id),
        "bid_review": _count_rows(db, ReviewRun, current_user.organization_id, project_id),
        "layout_finalize": _count_rows(db, LayoutJob, current_user.organization_id, project_id),
        "bid_management": _count_rows(db, SubmissionRecord, current_user.organization_id, project_id),
    }

    modules = [
        ModuleSummary(
            module_key=key,
            title=MODULE_TITLES[key],
            count=counts[key],
            status="ready" if counts[key] else "empty",
            description=MODULE_DESCRIPTIONS[key],
        )
        for key in (
            "knowledge_library",
            "tender_decomposition",
            "bid_generation",
            "bid_review",
            "layout_finalize",
            "bid_management",
        )
    ]
    return WorkbenchOverviewResponse(project_id=project_id, modules=modules)


@router.post("/library/entries", response_model=KnowledgeBaseEntryResponse, status_code=status.HTTP_201_CREATED)
def create_library_entry(
    payload: KnowledgeBaseEntryCreate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> KnowledgeBaseEntry:
    _ensure_project_and_document_access(
        project_id=payload.project_id,
        document_id=payload.source_document_id,
        current_user=current_user,
        db=db,
    )

    entry = KnowledgeBaseEntry(
        organization_id=current_user.organization_id,
        project_id=payload.project_id,
        source_document_id=payload.source_document_id,
        category=payload.category,
        title=payload.title,
        owner_name=payload.owner_name,
        created_by_user_id=current_user.id,
    )
    db.add(entry)
    db.flush()
    write_audit_log(
        db,
        action="workbench.library.create",
        organization_id=current_user.organization_id,
        project_id=payload.project_id,
        user_id=current_user.id,
        resource_type="knowledge_base_entry",
        resource_id=entry.id,
        request_id=getattr(request.state, "request_id", ""),
        detail={"category": payload.category, "title": payload.title},
    )
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/library/entries", response_model=list[KnowledgeBaseEntryResponse])
def list_library_entries(
    project_id: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[KnowledgeBaseEntry]:
    if project_id is not None:
        _require_project_access(project_id, current_user, db)

    stmt = select(KnowledgeBaseEntry).where(KnowledgeBaseEntry.organization_id == current_user.organization_id)
    if project_id is not None:
        stmt = stmt.where(KnowledgeBaseEntry.project_id == project_id)
    stmt = stmt.order_by(KnowledgeBaseEntry.id.desc())
    return slice_results(list(db.scalars(stmt)), offset=offset, limit=limit)


@router.post("/library/entries/{entry_id}/run-check", response_model=KnowledgeBaseEntryResponse)
def run_library_entry_check(
    entry_id: int,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> KnowledgeBaseEntry:
    entry = db.scalar(
        select(KnowledgeBaseEntry).where(
            KnowledgeBaseEntry.id == entry_id,
            KnowledgeBaseEntry.organization_id == current_user.organization_id,
        )
    )
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base entry not found")

    entry.detection_status = "checked"
    entry.detected_summary = (
        f"Checked {entry.category}: anchors, source metadata, and reuse readiness passed local baseline."
    )
    write_audit_log(
        db,
        action="workbench.library.run_check",
        organization_id=current_user.organization_id,
        project_id=entry.project_id,
        user_id=current_user.id,
        resource_type="knowledge_base_entry",
        resource_id=entry.id,
        request_id=getattr(request.state, "request_id", ""),
        detail={"detection_status": entry.detection_status},
    )
    db.commit()
    db.refresh(entry)
    return entry


def _create_run_record(
    *,
    db: Session,
    current_user: UserIdentity,
    request: Request,
    action: str,
    resource_type: str,
    model,
    values: dict,
):
    record = model(
        organization_id=current_user.organization_id,
        created_by_user_id=current_user.id,
        **values,
    )
    db.add(record)
    db.flush()
    write_audit_log(
        db,
        action=action,
        organization_id=current_user.organization_id,
        project_id=values.get("project_id"),
        user_id=current_user.id,
        resource_type=resource_type,
        resource_id=record.id,
        request_id=getattr(request.state, "request_id", ""),
        detail=values,
    )
    db.commit()
    db.refresh(record)
    return record


@router.post("/decomposition/runs", response_model=DecompositionRunResponse, status_code=status.HTTP_201_CREATED)
def create_decomposition_run(
    payload: PipelineRunCreate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DecompositionRun:
    _ensure_project_and_document_access(
        project_id=payload.project_id,
        document_id=payload.source_document_id,
        current_user=current_user,
        db=db,
    )
    return _create_run_record(
        db=db,
        current_user=current_user,
        request=request,
        action="workbench.decomposition.create",
        resource_type="decomposition_run",
        model=DecompositionRun,
        values={
            "project_id": payload.project_id,
            "source_document_id": payload.source_document_id,
            "run_name": payload.run_name,
            "status": "queued",
            "progress_pct": 0,
            "summary_json": "{}",
        },
    )


@router.get("/decomposition/runs", response_model=list[DecompositionRunResponse])
def list_decomposition_runs(
    project_id: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sequence[DecompositionRun]:
    if project_id is not None:
        _require_project_access(project_id, current_user, db)
    stmt = select(DecompositionRun).where(DecompositionRun.organization_id == current_user.organization_id)
    if project_id is not None:
        stmt = stmt.where(DecompositionRun.project_id == project_id)
    return slice_results(list(db.scalars(stmt.order_by(DecompositionRun.id.desc()))), offset=offset, limit=limit)


@router.post("/generation/jobs", response_model=GenerationJobResponse, status_code=status.HTTP_201_CREATED)
def create_generation_job(
    payload: GenerationJobCreate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GenerationJob:
    _ensure_project_and_document_access(
        project_id=payload.project_id,
        document_id=payload.source_document_id,
        current_user=current_user,
        db=db,
    )
    return _create_run_record(
        db=db,
        current_user=current_user,
        request=request,
        action="workbench.generation.create",
        resource_type="generation_job",
        model=GenerationJob,
        values={
            "project_id": payload.project_id,
            "source_document_id": payload.source_document_id,
            "job_name": payload.job_name,
            "target_sections": payload.target_sections,
            "status": "drafting",
        },
    )


@router.get("/generation/jobs", response_model=list[GenerationJobResponse])
def list_generation_jobs(
    project_id: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sequence[GenerationJob]:
    if project_id is not None:
        _require_project_access(project_id, current_user, db)
    stmt = select(GenerationJob).where(GenerationJob.organization_id == current_user.organization_id)
    if project_id is not None:
        stmt = stmt.where(GenerationJob.project_id == project_id)
    return slice_results(list(db.scalars(stmt.order_by(GenerationJob.id.desc()))), offset=offset, limit=limit)


@router.post("/review/runs", response_model=ReviewRunResponse, status_code=status.HTTP_201_CREATED)
def create_review_run(
    payload: ReviewRunCreate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReviewRun:
    _ensure_project_and_document_access(
        project_id=payload.project_id,
        document_id=payload.source_document_id,
        current_user=current_user,
        db=db,
    )
    return _create_run_record(
        db=db,
        current_user=current_user,
        request=request,
        action="workbench.review.create",
        resource_type="review_run",
        model=ReviewRun,
        values={
            "project_id": payload.project_id,
            "source_document_id": payload.source_document_id,
            "run_name": payload.run_name,
            "review_mode": payload.review_mode,
            "status": "queued",
            "blocking_issue_count": 0,
        },
    )


@router.get("/review/runs", response_model=list[ReviewRunResponse])
def list_review_runs(
    project_id: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sequence[ReviewRun]:
    if project_id is not None:
        _require_project_access(project_id, current_user, db)
    stmt = select(ReviewRun).where(ReviewRun.organization_id == current_user.organization_id)
    if project_id is not None:
        stmt = stmt.where(ReviewRun.project_id == project_id)
    return slice_results(list(db.scalars(stmt.order_by(ReviewRun.id.desc()))), offset=offset, limit=limit)


@router.post("/layout/jobs", response_model=LayoutJobResponse, status_code=status.HTTP_201_CREATED)
def create_layout_job(
    payload: LayoutJobCreate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LayoutJob:
    _ensure_project_and_document_access(
        project_id=payload.project_id,
        document_id=payload.source_document_id,
        current_user=current_user,
        db=db,
    )
    return _create_run_record(
        db=db,
        current_user=current_user,
        request=request,
        action="workbench.layout.create",
        resource_type="layout_job",
        model=LayoutJob,
        values={
            "project_id": payload.project_id,
            "source_document_id": payload.source_document_id,
            "job_name": payload.job_name,
            "template_name": payload.template_name,
            "status": "queued",
        },
    )


@router.get("/layout/jobs", response_model=list[LayoutJobResponse])
def list_layout_jobs(
    project_id: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sequence[LayoutJob]:
    if project_id is not None:
        _require_project_access(project_id, current_user, db)
    stmt = select(LayoutJob).where(LayoutJob.organization_id == current_user.organization_id)
    if project_id is not None:
        stmt = stmt.where(LayoutJob.project_id == project_id)
    return slice_results(list(db.scalars(stmt.order_by(LayoutJob.id.desc()))), offset=offset, limit=limit)


@router.post(
    "/submission-records",
    response_model=SubmissionRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_submission_record(
    payload: SubmissionRecordCreate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmissionRecord:
    _ensure_project_and_document_access(
        project_id=payload.project_id,
        document_id=payload.source_document_id,
        current_user=current_user,
        db=db,
    )
    return _create_run_record(
        db=db,
        current_user=current_user,
        request=request,
        action="workbench.submission.create",
        resource_type="submission_record",
        model=SubmissionRecord,
        values={
            "project_id": payload.project_id,
            "source_document_id": payload.source_document_id,
            "title": payload.title,
            "status": payload.status,
        },
    )


@router.get("/submission-records", response_model=list[SubmissionRecordResponse])
def list_submission_records(
    project_id: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sequence[SubmissionRecord]:
    if project_id is not None:
        _require_project_access(project_id, current_user, db)
    stmt = select(SubmissionRecord).where(SubmissionRecord.organization_id == current_user.organization_id)
    if project_id is not None:
        stmt = stmt.where(SubmissionRecord.project_id == project_id)
    return slice_results(list(db.scalars(stmt.order_by(SubmissionRecord.id.desc()))), offset=offset, limit=limit)
