import json
import time
from pathlib import Path
from collections.abc import Callable, Sequence
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.core.config import settings
from app.core.storage import build_download_response
from app.api.pagination import slice_results
from app.db.models import (
    DecompositionRun,
    Document,
    EquipmentAsset,
    GeneratedSection,
    GenerationJob,
    KnowledgeBaseEntry,
    LayoutJob,
    PersonnelAsset,
    Project,
    ProjectCredential,
    ProjectMember,
    Qualification,
    RenderedOutput,
    ReviewIssue,
    VerificationIssue,
    ReviewRun,
    SubmissionRecord,
)
from app.db.session import get_db
from app.schemas.auth import UserIdentity
from app.schemas.workbench import (
    DecompositionRunResponse,
    EquipmentAssetCreate,
    EquipmentAssetResponse,
    EquipmentAssetUpdate,
    GeneratedSectionResponse,
    GenerationJobCreate,
    GenerationJobResponse,
    KnowledgeBaseEntryCreate,
    KnowledgeBaseEntryResponse,
    LayoutJobCreate,
    LayoutJobResponse,
    ModuleSummary,
    PersonnelAssetCreate,
    PersonnelAssetResponse,
    PersonnelAssetUpdate,
    PipelineRunCreate,
    ProjectCredentialCreate,
    ProjectCredentialResponse,
    ProjectCredentialUpdate,
    QualificationCreate,
    QualificationResponse,
    QualificationUpdate,
    RenderedOutputResponse,
    ReviewIssueResponse,
    VerificationIssueResponse,
    ReviewRunCreate,
    ReviewRunResponse,
    SubmissionRecordCreate,
    SubmissionRecordResponse,
    WorkbenchOverviewResponse,
)
from app.services.audit_log import write_audit_log
from app.services.generation_pipeline import execute_generation_job
from app.services.knowledge_base_checks import run_knowledge_base_entry_check
from app.services.layout_pipeline import execute_layout_job
from app.services.review_pipeline import execute_review_run, remediate_review_issue
from app.services.tender_decomposition import execute_decomposition_run
from app.services.workbench_pipeline_tasks import dispatch_workbench_pipeline_task

router = APIRouter(prefix="/api/v1/workbench", tags=["workbench"])


def _encode_sse(payload: dict) -> str:
    return f"event: progress\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _stream_progress_event(fetch_payload: Callable[[], dict], *, timeout_seconds: float = 5.0, poll_interval: float = 0.1) -> StreamingResponse:
    def event_iterator():
        deadline = time.monotonic() + timeout_seconds
        last_payload: str | None = None
        while True:
            payload = fetch_payload()
            encoded = _encode_sse(payload)
            if encoded != last_payload:
                yield encoded
                last_payload = encoded
            status_value = str(payload.get("status", "")).lower()
            if status_value in {"completed", "failed", "approved", "missing"}:
                break
            if time.monotonic() >= deadline:
                break
            time.sleep(poll_interval)

    return StreamingResponse(event_iterator(), media_type="text/event-stream")

MODULE_TITLES = {
    "knowledge_library": "投标资料库",
    "tender_decomposition": "标书分析",
    "bid_generation": "标书生成",
    "bid_review": "标书评审",
    "layout_finalize": "排版定稿",
    "bid_management": "标书管理",
}

MODULE_DESCRIPTIONS = {
    "knowledge_library": "历史标书、优秀标书、公司资质及业绩、设施设备、人员资质及业绩的统一入库、查询与敏感信息清洗。",
    "tender_decomposition": "上传 PDF 招标文件，拆解为基本信息、资格要求、评审标准、投标要求、废标条款、提交清单、合同风险，并可与原文对照显示。",
    "bid_generation": "以招标文件拆解和资料库为约束，AI 先生成标书框架，批准后分章节编写标书初稿。",
    "bid_review": "对标书初稿进行多维评审、模拟评分、废标分析，不合格打回重写，形成合格标书。",
    "layout_finalize": "将合格标书按招标文件要求进行排版，形成最终打印版标书。",
    "bid_management": "存放查询生成的标书文件，记录中标情况，优秀标书回灌投标资料库。",
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
    category: str | None = Query(None, min_length=1, max_length=64),
    q: str | None = Query(None, min_length=1, max_length=255),
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[KnowledgeBaseEntry]:
    if project_id is not None:
        _require_project_access(project_id, current_user, db)

    if created_from is not None and created_to is not None and created_from > created_to:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="created_from must be <= created_to")

    stmt = select(KnowledgeBaseEntry).where(KnowledgeBaseEntry.organization_id == current_user.organization_id)
    if project_id is not None:
        stmt = stmt.where(KnowledgeBaseEntry.project_id == project_id)
    if category is not None:
        stmt = stmt.where(KnowledgeBaseEntry.category == category)
    if q is not None:
        keyword = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                KnowledgeBaseEntry.title.ilike(keyword),
                KnowledgeBaseEntry.owner_name.ilike(keyword),
                KnowledgeBaseEntry.category.ilike(keyword),
            )
        )
    if created_from is not None:
        stmt = stmt.where(KnowledgeBaseEntry.created_at >= created_from)
    if created_to is not None:
        stmt = stmt.where(KnowledgeBaseEntry.created_at <= created_to)
    stmt = stmt.order_by(KnowledgeBaseEntry.created_at.desc(), KnowledgeBaseEntry.id.desc())
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

    entry.detection_status, entry.detected_summary = run_knowledge_base_entry_check(db, entry)
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


def _list_library_records(db: Session, current_user: UserIdentity, model: type) -> list:
    stmt = (
        select(model)
        .where(model.organization_id == current_user.organization_id)
        .order_by(model.created_at.desc(), model.id.desc())
    )
    return list(db.scalars(stmt))


def _get_library_record_or_404(db: Session, current_user: UserIdentity, model: type, record_id: int, detail: str):
    record = db.scalar(
        select(model).where(
            model.id == record_id,
            model.organization_id == current_user.organization_id,
        )
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return record


def _create_library_record(
    *,
    db: Session,
    current_user: UserIdentity,
    request: Request,
    model: type,
    resource_type: str,
    action: str,
    values: dict,
):
    record = model(
        organization_id=current_user.organization_id,
        **values,
    )
    db.add(record)
    db.flush()
    write_audit_log(
        db,
        action=action,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        resource_type=resource_type,
        resource_id=record.id,
        request_id=getattr(request.state, "request_id", ""),
        detail=values,
    )
    db.commit()
    db.refresh(record)
    return record


def _update_library_record(
    *,
    db: Session,
    current_user: UserIdentity,
    request: Request,
    model: type,
    record_id: int,
    resource_type: str,
    action: str,
    detail: str,
    values: dict,
):
    record = _get_library_record_or_404(db, current_user, model, record_id, detail)
    for field, value in values.items():
        setattr(record, field, value)
    write_audit_log(
        db,
        action=action,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        resource_type=resource_type,
        resource_id=record.id,
        request_id=getattr(request.state, "request_id", ""),
        detail=values,
    )
    db.commit()
    db.refresh(record)
    return record


def _delete_library_record(
    *,
    db: Session,
    current_user: UserIdentity,
    request: Request,
    model: type,
    record_id: int,
    resource_type: str,
    action: str,
    detail: str,
) -> None:
    record = _get_library_record_or_404(db, current_user, model, record_id, detail)
    write_audit_log(
        db,
        action=action,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        resource_type=resource_type,
        resource_id=record.id,
        request_id=getattr(request.state, "request_id", ""),
        detail={"deleted": True},
    )
    db.delete(record)
    db.commit()


@router.get("/library/qualifications", response_model=list[QualificationResponse])
def list_qualifications(
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Qualification]:
    return _list_library_records(db, current_user, Qualification)


@router.post("/library/qualifications", response_model=QualificationResponse, status_code=status.HTTP_201_CREATED)
def create_qualification(
    payload: QualificationCreate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Qualification:
    return _create_library_record(
        db=db,
        current_user=current_user,
        request=request,
        model=Qualification,
        resource_type="qualification",
        action="workbench.library.qualification.create",
        values=payload.model_dump(),
    )


@router.patch("/library/qualifications/{qualification_id}", response_model=QualificationResponse)
def update_qualification(
    qualification_id: int,
    payload: QualificationUpdate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Qualification:
    return _update_library_record(
        db=db,
        current_user=current_user,
        request=request,
        model=Qualification,
        record_id=qualification_id,
        resource_type="qualification",
        action="workbench.library.qualification.update",
        detail="Qualification not found",
        values=payload.model_dump(exclude_unset=True),
    )


@router.delete("/library/qualifications/{qualification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_qualification(
    qualification_id: int,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    _delete_library_record(
        db=db,
        current_user=current_user,
        request=request,
        model=Qualification,
        record_id=qualification_id,
        resource_type="qualification",
        action="workbench.library.qualification.delete",
        detail="Qualification not found",
    )


@router.get("/library/personnel-assets", response_model=list[PersonnelAssetResponse])
def list_personnel_assets(
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PersonnelAsset]:
    return _list_library_records(db, current_user, PersonnelAsset)


@router.post("/library/personnel-assets", response_model=PersonnelAssetResponse, status_code=status.HTTP_201_CREATED)
def create_personnel_asset(
    payload: PersonnelAssetCreate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PersonnelAsset:
    return _create_library_record(
        db=db,
        current_user=current_user,
        request=request,
        model=PersonnelAsset,
        resource_type="personnel_asset",
        action="workbench.library.personnel_asset.create",
        values=payload.model_dump(),
    )


@router.patch("/library/personnel-assets/{personnel_asset_id}", response_model=PersonnelAssetResponse)
def update_personnel_asset(
    personnel_asset_id: int,
    payload: PersonnelAssetUpdate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PersonnelAsset:
    return _update_library_record(
        db=db,
        current_user=current_user,
        request=request,
        model=PersonnelAsset,
        record_id=personnel_asset_id,
        resource_type="personnel_asset",
        action="workbench.library.personnel_asset.update",
        detail="Personnel asset not found",
        values=payload.model_dump(exclude_unset=True),
    )


@router.delete("/library/personnel-assets/{personnel_asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_personnel_asset(
    personnel_asset_id: int,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    _delete_library_record(
        db=db,
        current_user=current_user,
        request=request,
        model=PersonnelAsset,
        record_id=personnel_asset_id,
        resource_type="personnel_asset",
        action="workbench.library.personnel_asset.delete",
        detail="Personnel asset not found",
    )


@router.get("/library/equipment-assets", response_model=list[EquipmentAssetResponse])
def list_equipment_assets(
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[EquipmentAsset]:
    return _list_library_records(db, current_user, EquipmentAsset)


@router.post("/library/equipment-assets", response_model=EquipmentAssetResponse, status_code=status.HTTP_201_CREATED)
def create_equipment_asset(
    payload: EquipmentAssetCreate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EquipmentAsset:
    return _create_library_record(
        db=db,
        current_user=current_user,
        request=request,
        model=EquipmentAsset,
        resource_type="equipment_asset",
        action="workbench.library.equipment_asset.create",
        values=payload.model_dump(),
    )


@router.patch("/library/equipment-assets/{equipment_asset_id}", response_model=EquipmentAssetResponse)
def update_equipment_asset(
    equipment_asset_id: int,
    payload: EquipmentAssetUpdate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EquipmentAsset:
    return _update_library_record(
        db=db,
        current_user=current_user,
        request=request,
        model=EquipmentAsset,
        record_id=equipment_asset_id,
        resource_type="equipment_asset",
        action="workbench.library.equipment_asset.update",
        detail="Equipment asset not found",
        values=payload.model_dump(exclude_unset=True),
    )


@router.delete("/library/equipment-assets/{equipment_asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment_asset(
    equipment_asset_id: int,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    _delete_library_record(
        db=db,
        current_user=current_user,
        request=request,
        model=EquipmentAsset,
        record_id=equipment_asset_id,
        resource_type="equipment_asset",
        action="workbench.library.equipment_asset.delete",
        detail="Equipment asset not found",
    )


@router.get("/library/project-credentials", response_model=list[ProjectCredentialResponse])
def list_project_credentials(
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectCredential]:
    return _list_library_records(db, current_user, ProjectCredential)


@router.post("/library/project-credentials", response_model=ProjectCredentialResponse, status_code=status.HTTP_201_CREATED)
def create_project_credential(
    payload: ProjectCredentialCreate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectCredential:
    return _create_library_record(
        db=db,
        current_user=current_user,
        request=request,
        model=ProjectCredential,
        resource_type="project_credential",
        action="workbench.library.project_credential.create",
        values=payload.model_dump(),
    )


@router.patch("/library/project-credentials/{project_credential_id}", response_model=ProjectCredentialResponse)
def update_project_credential(
    project_credential_id: int,
    payload: ProjectCredentialUpdate,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectCredential:
    return _update_library_record(
        db=db,
        current_user=current_user,
        request=request,
        model=ProjectCredential,
        record_id=project_credential_id,
        resource_type="project_credential",
        action="workbench.library.project_credential.update",
        detail="Project credential not found",
        values=payload.model_dump(exclude_unset=True),
    )


@router.delete("/library/project-credentials/{project_credential_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_credential(
    project_credential_id: int,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    _delete_library_record(
        db=db,
        current_user=current_user,
        request=request,
        model=ProjectCredential,
        record_id=project_credential_id,
        resource_type="project_credential",
        action="workbench.library.project_credential.delete",
        detail="Project credential not found",
    )


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
    run = _create_run_record(
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
    if settings.async_workbench_pipelines and dispatch_workbench_pipeline_task(pipeline_type="decomposition", record_id=run.id):
        return run
    return execute_decomposition_run(db, run)


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
    job = _create_run_record(
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
            "status": "queued",
        },
    )
    if settings.async_workbench_pipelines and dispatch_workbench_pipeline_task(pipeline_type="generation", record_id=job.id):
        return job
    return execute_generation_job(db, job)


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
    run = _create_run_record(
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
    if settings.async_workbench_pipelines and dispatch_workbench_pipeline_task(pipeline_type="review", record_id=run.id):
        return run
    return execute_review_run(db, run)


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
    job = _create_run_record(
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
    if settings.async_workbench_pipelines and dispatch_workbench_pipeline_task(pipeline_type="layout", record_id=job.id):
        return job
    return execute_layout_job(db, job)


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


@router.get("/decomposition/runs/{run_id}/events")
def stream_decomposition_run_events(
    run_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = db.scalar(
        select(DecompositionRun).where(
            DecompositionRun.id == run_id,
            DecompositionRun.organization_id == current_user.organization_id,
        )
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decomposition run not found")

    def fetch_payload() -> dict:
        db.expire_all()
        refreshed = db.scalar(
            select(DecompositionRun).where(
                DecompositionRun.id == run_id,
                DecompositionRun.organization_id == current_user.organization_id,
            )
        )
        if refreshed is None:
            return {"id": run_id, "status": "missing", "progress_pct": 0}
        return {"id": refreshed.id, "status": refreshed.status, "progress_pct": refreshed.progress_pct}

    return _stream_progress_event(fetch_payload)


@router.get("/generation/jobs/{job_id}/sections", response_model=list[GeneratedSectionResponse])
def list_generation_job_sections(
    job_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sequence[GeneratedSection]:
    job = db.scalar(
        select(GenerationJob).where(
            GenerationJob.id == job_id,
            GenerationJob.organization_id == current_user.organization_id,
        )
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation job not found")
    stmt = select(GeneratedSection).where(
        GeneratedSection.project_id == job.project_id,
        GeneratedSection.source_document_id == job.source_document_id,
    )
    return list(db.scalars(stmt.order_by(GeneratedSection.id.asc())))


@router.get("/generation/jobs/{job_id}/verification-issues", response_model=list[VerificationIssueResponse])
def list_generation_job_verification_issues(
    job_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sequence[VerificationIssue]:
    job = db.scalar(
        select(GenerationJob).where(
            GenerationJob.id == job_id,
            GenerationJob.organization_id == current_user.organization_id,
        )
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation job not found")

    section_ids = select(GeneratedSection.id).where(
        GeneratedSection.project_id == job.project_id,
        GeneratedSection.source_document_id == job.source_document_id,
    )
    stmt = select(VerificationIssue).where(VerificationIssue.generated_section_id.in_(section_ids))
    return list(db.scalars(stmt.order_by(VerificationIssue.id.asc())))


@router.post("/generation/jobs/{job_id}/approve-outline", response_model=GenerationJobResponse)
def approve_generation_outline(
    job_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GenerationJob:
    job = db.scalar(
        select(GenerationJob).where(
            GenerationJob.id == job_id,
            GenerationJob.organization_id == current_user.organization_id,
        )
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation job not found")

    job.status = "approved"
    db.commit()
    db.refresh(job)
    return job


@router.get("/generation/jobs/{job_id}/events")
def stream_generation_job_events(
    job_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.scalar(
        select(GenerationJob).where(
            GenerationJob.id == job_id,
            GenerationJob.organization_id == current_user.organization_id,
        )
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation job not found")

    def fetch_payload() -> dict:
        db.expire_all()
        refreshed = db.scalar(
            select(GenerationJob).where(
                GenerationJob.id == job_id,
                GenerationJob.organization_id == current_user.organization_id,
            )
        )
        if refreshed is None:
            return {"id": job_id, "status": "missing", "target_sections": 0}
        return {"id": refreshed.id, "status": refreshed.status, "target_sections": refreshed.target_sections}

    return _stream_progress_event(fetch_payload)


@router.get("/review/runs/{run_id}/issues", response_model=list[ReviewIssueResponse])
def list_review_run_issues(
    run_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sequence[ReviewIssue]:
    run = db.scalar(
        select(ReviewRun).where(
            ReviewRun.id == run_id,
            ReviewRun.organization_id == current_user.organization_id,
        )
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review run not found")
    stmt = select(ReviewIssue).where(ReviewIssue.review_run_id == run_id)
    return list(db.scalars(stmt.order_by(ReviewIssue.id.asc())))


@router.post("/review/issues/{issue_id}/remediate", response_model=GeneratedSectionResponse)
def remediate_issue(
    issue_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GeneratedSection:
    issue = db.scalar(
        select(ReviewIssue).where(
            ReviewIssue.id == issue_id,
            ReviewIssue.organization_id == current_user.organization_id,
        )
    )
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review issue not found")
    if issue.generated_section_id is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Review issue cannot be remediated")

    try:
        return remediate_review_issue(db, issue)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/review/runs/{run_id}/confirm-pass", response_model=ReviewRunResponse)
def confirm_review_run_pass(
    run_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReviewRun:
    run = db.scalar(
        select(ReviewRun).where(
            ReviewRun.id == run_id,
            ReviewRun.organization_id == current_user.organization_id,
        )
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review run not found")
    if run.blocking_issue_count > 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Blocking issues must be resolved before confirmation")

    run.status = "approved"
    db.commit()
    db.refresh(run)
    return run


@router.get("/review/runs/{run_id}/events")
def stream_review_run_events(
    run_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = db.scalar(
        select(ReviewRun).where(
            ReviewRun.id == run_id,
            ReviewRun.organization_id == current_user.organization_id,
        )
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review run not found")

    def fetch_payload() -> dict:
        db.expire_all()
        refreshed = db.scalar(
            select(ReviewRun).where(
                ReviewRun.id == run_id,
                ReviewRun.organization_id == current_user.organization_id,
            )
        )
        if refreshed is None:
            return {"id": run_id, "status": "missing", "blocking_issue_count": 0}
        return {"id": refreshed.id, "status": refreshed.status, "blocking_issue_count": refreshed.blocking_issue_count}

    return _stream_progress_event(fetch_payload)


@router.get("/layout/jobs/{job_id}/outputs", response_model=list[RenderedOutputResponse])
def list_layout_job_outputs(
    job_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sequence[RenderedOutput]:
    job = db.scalar(
        select(LayoutJob).where(
            LayoutJob.id == job_id,
            LayoutJob.organization_id == current_user.organization_id,
        )
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layout job not found")
    stmt = select(RenderedOutput).where(RenderedOutput.layout_job_id == job_id)
    return list(db.scalars(stmt.order_by(RenderedOutput.id.asc())))


@router.get("/layout/jobs/{job_id}/events")
def stream_layout_job_events(
    job_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.scalar(
        select(LayoutJob).where(
            LayoutJob.id == job_id,
            LayoutJob.organization_id == current_user.organization_id,
        )
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layout job not found")

    def fetch_payload() -> dict:
        db.expire_all()
        refreshed = db.scalar(
            select(LayoutJob).where(
                LayoutJob.id == job_id,
                LayoutJob.organization_id == current_user.organization_id,
            )
        )
        if refreshed is None:
            return {"id": job_id, "status": "missing", "template_name": ""}
        return {"id": refreshed.id, "status": refreshed.status, "template_name": refreshed.template_name}

    return _stream_progress_event(fetch_payload)


@router.get("/layout/outputs/{output_id}/download")
def download_layout_output(
    output_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    output = db.scalar(
        select(RenderedOutput).where(
            RenderedOutput.id == output_id,
            RenderedOutput.organization_id == current_user.organization_id,
        )
    )
    if output is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendered output not found")

    return build_download_response(output.storage_path)


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


@router.post(
    "/submission-records/{record_id}/feed-to-library",
    response_model=KnowledgeBaseEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
def feed_submission_record_to_library(
    record_id: int,
    request: Request,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> KnowledgeBaseEntry:
    record = db.scalar(
        select(SubmissionRecord).where(
            SubmissionRecord.id == record_id,
            SubmissionRecord.organization_id == current_user.organization_id,
        )
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission record not found")

    entry = KnowledgeBaseEntry(
        organization_id=current_user.organization_id,
        project_id=record.project_id,
        source_document_id=record.source_document_id,
        category="excellent_bid" if record.status == "won" else "historical_bid",
        title=record.title,
        owner_name="标书管理",
        created_by_user_id=current_user.id,
    )
    db.add(entry)
    db.flush()
    write_audit_log(
        db,
        action="workbench.submission.feed_to_library",
        organization_id=current_user.organization_id,
        project_id=record.project_id,
        user_id=current_user.id,
        resource_type="knowledge_base_entry",
        resource_id=entry.id,
        request_id=getattr(request.state, "request_id", ""),
        detail={"submission_record_id": record.id, "category": entry.category},
    )
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/submission-records", response_model=list[SubmissionRecordResponse])
def list_submission_records(
    project_id: int | None = None,
    status: str | None = None,
    q: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sequence[SubmissionRecord]:
    if project_id is not None:
        _require_project_access(project_id, current_user, db)
    if created_from is not None and created_to is not None and created_from > created_to:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="created_from must be <= created_to")

    stmt = select(SubmissionRecord).where(SubmissionRecord.organization_id == current_user.organization_id)
    if project_id is not None:
        stmt = stmt.where(SubmissionRecord.project_id == project_id)
    if status is not None:
        stmt = stmt.where(SubmissionRecord.status == status)
    if q is not None:
        keyword = f"%{q.strip()}%"
        stmt = stmt.where(SubmissionRecord.title.ilike(keyword))
    if created_from is not None:
        stmt = stmt.where(SubmissionRecord.created_at >= created_from)
    if created_to is not None:
        stmt = stmt.where(SubmissionRecord.created_at <= created_to)
    stmt = stmt.order_by(SubmissionRecord.created_at.desc(), SubmissionRecord.id.desc())
    return slice_results(list(db.scalars(stmt)), offset=offset, limit=limit)
