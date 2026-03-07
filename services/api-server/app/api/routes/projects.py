from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user, require_roles
from app.core.document_ingestion import ingest_document
from app.core.storage import save_upload, validate_upload
from app.db.models import (
    Document,
    DocumentArtifact,
    DocumentVersion,
    EvidenceUnit,
    HistoricalBidDocument,
    HistoricalBidSection,
    HistoricalRiskMark,
    HistoricalReuseUnit,
    Project,
    ProjectMember,
    User,
    UserRole,
)
from app.db.session import get_db
from app.schemas.auth import UserIdentity
from app.schemas.evidence import EvidenceSearchResult, EvidenceUnitResponse
from app.schemas.project import (
    DocumentCreate,
    DocumentResponse,
    ProjectCreate,
    ProjectMemberCreate,
    ProjectMemberResponse,
    ProjectResponse,
)
from app.schemas.writing_runtime import (
    HistoricalLeakageVerificationRequest,
    HistoricalLeakageVerificationResponse,
)
from app.services.evidence_search import search_evidence_units
from app.services.evidence_unit_builder import (
    list_evidence_units_for_document,
    rebuild_evidence_units_for_document,
    supports_evidence_units,
)
from app.services.historical_leakage_checker import verify_historical_leakage

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def _serialize_project_member(member: ProjectMember, user_email: str) -> ProjectMemberResponse:
    return ProjectMemberResponse(
        project_id=member.project_id,
        user_id=member.user_id,
        user_email=user_email,
        role=member.role,
        created_at=member.created_at,
    )


def _get_project_for_member(project_id: int, current_user: UserIdentity, db: Session) -> Project:
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


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: ProjectCreate,
    current_user: UserIdentity = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)),
    db: Session = Depends(get_db),
) -> Project:
    project = Project(
        organization_id=current_user.organization_id,
        name=payload.name,
        created_by_user_id=current_user.id,
    )
    db.add(project)
    db.flush()

    db.add(
        ProjectMember(
            project_id=project.id,
            user_id=current_user.id,
            role=current_user.role,
        )
    )

    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Project]:
    stmt = (
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(
            Project.organization_id == current_user.organization_id,
            ProjectMember.user_id == current_user.id,
        )
        .order_by(Project.id.asc())
    )
    return list(db.scalars(stmt))


@router.get("/{project_id}/members", response_model=list[ProjectMemberResponse])
def list_project_members(
    project_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectMemberResponse]:
    _get_project_for_member(project_id, current_user, db)

    rows = db.execute(
        select(ProjectMember, User.email)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.id.asc())
    ).all()
    return [_serialize_project_member(member, user_email) for member, user_email in rows]


@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_project_member(
    project_id: int,
    payload: ProjectMemberCreate,
    current_user: UserIdentity = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)),
    db: Session = Depends(get_db),
) -> ProjectMemberResponse:
    _get_project_for_member(project_id, current_user, db)

    target_user = db.scalar(
        select(User).where(
            User.email == payload.user_email,
            User.organization_id == current_user.organization_id,
            User.is_active.is_(True),
        )
    )
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing_member = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == target_user.id,
        )
    )
    if existing_member is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project member already exists")

    project_member = ProjectMember(
        project_id=project_id,
        user_id=target_user.id,
        role=payload.role,
    )
    db.add(project_member)
    db.commit()
    db.refresh(project_member)
    return _serialize_project_member(project_member, target_user.email)


@router.post(
    "/{project_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_document(
    project_id: int,
    payload: DocumentCreate,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Document:
    _get_project_for_member(project_id, current_user, db)

    document = Document(
        project_id=project_id,
        filename=payload.filename,
        document_type=payload.document_type,
        created_by_user_id=current_user.id,
    )
    db.add(document)
    db.flush()

    db.add(
        DocumentVersion(
            document_id=document.id,
            version_no=1,
            status="uploaded",
        )
    )

    db.commit()
    db.refresh(document)
    return document


def _get_project_document(project_id: int, document_id: int, db: Session) -> Document:
    document = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.project_id == project_id,
        )
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.get("/{project_id}/documents", response_model=list[DocumentResponse])
def list_documents(
    project_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Document]:
    _get_project_for_member(project_id, current_user, db)

    stmt = select(Document).where(Document.project_id == project_id).order_by(Document.id.asc())
    return list(db.scalars(stmt))


@router.post(
    "/{project_id}/documents/{document_id}/rebuild-evidence-units",
    response_model=list[EvidenceUnitResponse],
)
def rebuild_document_evidence_units(
    project_id: int,
    document_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[EvidenceUnit]:
    _get_project_for_member(project_id, current_user, db)
    document = _get_project_document(project_id, document_id, db)
    try:
        return rebuild_evidence_units_for_document(db, document)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "/{project_id}/documents/{document_id}/evidence-units",
    response_model=list[EvidenceUnitResponse],
)
def list_document_evidence_units(
    project_id: int,
    document_id: int,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[EvidenceUnit]:
    _get_project_for_member(project_id, current_user, db)
    _get_project_document(project_id, document_id, db)
    return list_evidence_units_for_document(db, document_id)


@router.get(
    "/{project_id}/evidence/search",
    response_model=list[EvidenceSearchResult],
)
def search_project_evidence(
    project_id: int,
    q: str,
    document_type: str | None = None,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[EvidenceSearchResult]:
    _get_project_for_member(project_id, current_user, db)
    rows = search_evidence_units(db, project_id=project_id, q=q, document_type=document_type)
    return [
        EvidenceSearchResult(
            id=evidence_unit.id,
            document_id=evidence_unit.document_id,
            filename=filename,
            document_type=evidence_unit.document_type,
            unit_type=evidence_unit.unit_type,
            section_title=evidence_unit.section_title,
            anchor=evidence_unit.anchor,
            page_start=evidence_unit.page_start,
            page_end=evidence_unit.page_end,
            content=evidence_unit.content,
        )
        for evidence_unit, filename in rows
    ]


@router.post(
    "/{project_id}/documents/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    project_id: int,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Document:
    _get_project_for_member(project_id, current_user, db)

    try:
        validate_upload(file.filename or "")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    storage_path = save_upload(project_id, file)

    document = Document(
        project_id=project_id,
        filename=file.filename or "upload",
        document_type=document_type,
        created_by_user_id=current_user.id,
    )
    db.add(document)
    db.flush()

    document_version = DocumentVersion(
        document_id=document.id,
        version_no=1,
        status="uploaded",
    )
    db.add(document_version)
    db.flush()

    db.add(
        DocumentArtifact(
            document_version_id=document_version.id,
            artifact_type="source",
            storage_path=storage_path,
        )
    )

    ingestion_result = ingest_document(
        project_id=project_id,
        document_id=document.id,
        version_no=document_version.version_no,
        source_path=storage_path,
        filename=file.filename or "upload",
    )
    for artifact in ingestion_result.artifacts:
        db.add(
            DocumentArtifact(
                document_version_id=document_version.id,
                artifact_type=artifact.artifact_type,
                storage_path=artifact.storage_path,
            )
        )
    document_version.status = ingestion_result.status

    if ingestion_result.status == "parsed" and supports_evidence_units(document.document_type):
        db.flush()
        rebuild_evidence_units_for_document(db, document)

    db.commit()
    db.refresh(document)
    return document


def _load_history_candidate_terms(
    *,
    reuse_unit_ids: list[int],
    organization_id: int,
    db: Session,
) -> list[str]:
    if not reuse_unit_ids:
        return []

    stmt = (
        select(HistoricalRiskMark.raw_value)
        .join(HistoricalReuseUnit, HistoricalReuseUnit.id == HistoricalRiskMark.historical_reuse_unit_id)
        .join(HistoricalBidSection, HistoricalBidSection.id == HistoricalReuseUnit.historical_bid_section_id)
        .join(HistoricalBidDocument, HistoricalBidDocument.id == HistoricalBidSection.historical_bid_document_id)
        .where(
            HistoricalReuseUnit.id.in_(reuse_unit_ids),
            HistoricalBidDocument.organization_id == organization_id,
        )
    )
    return [value for value in db.scalars(stmt) if value]


@router.post(
    "/{project_id}/sections/{section_id}/verify-historical-leakage",
    response_model=HistoricalLeakageVerificationResponse,
)
def verify_section_historical_leakage(
    project_id: int,
    section_id: str,
    payload: HistoricalLeakageVerificationRequest,
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HistoricalLeakageVerificationResponse:
    _get_project_for_member(project_id, current_user, db)
    legacy_terms = set(payload.forbidden_legacy_terms)
    legacy_terms.update(
        _load_history_candidate_terms(
            reuse_unit_ids=payload.history_candidate_pack.reuse_unit_ids,
            organization_id=current_user.organization_id,
            db=db,
        )
    )
    return verify_historical_leakage(
        draft_text=payload.draft_text,
        forbidden_legacy_terms=sorted(legacy_terms),
    )
