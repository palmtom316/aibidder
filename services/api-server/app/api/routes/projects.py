from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user, require_roles
from app.core.document_parser import dump_structured_payload, parse_document
from app.core.storage import save_generated_artifact, save_upload, validate_upload
from app.db.models import Document, DocumentArtifact, DocumentVersion, Project, ProjectMember, User, UserRole
from app.db.session import get_db
from app.schemas.auth import UserIdentity
from app.schemas.project import (
    DocumentCreate,
    DocumentResponse,
    ProjectCreate,
    ProjectMemberCreate,
    ProjectMemberResponse,
    ProjectResponse,
)

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

    parsed_document = parse_document(storage_path, file.filename or "upload")
    if parsed_document is not None:
        markdown_path = save_generated_artifact(
            project_id=project_id,
            document_id=document.id,
            version_no=document_version.version_no,
            artifact_type="markdown",
            content=parsed_document.markdown,
            extension=".md",
        )
        json_path = save_generated_artifact(
            project_id=project_id,
            document_id=document.id,
            version_no=document_version.version_no,
            artifact_type="json",
            content=dump_structured_payload(parsed_document),
            extension=".json",
        )
        db.add(
            DocumentArtifact(
                document_version_id=document_version.id,
                artifact_type="markdown",
                storage_path=markdown_path,
            )
        )
        db.add(
            DocumentArtifact(
                document_version_id=document_version.id,
                artifact_type="json",
                storage_path=json_path,
            )
        )
        document_version.status = "parsed"

    db.commit()
    db.refresh(document)
    return document
