from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user, require_roles
from app.api.deps.pagination import PaginationParams, pagination_params
from app.db.models import (
    Document,
    HistoricalBidDocument,
    HistoricalBidSection,
    HistoricalReuseUnit,
    Project,
    ProjectMember,
    UserRole,
)
from app.db.session import get_db
from app.schemas.auth import UserIdentity
from app.schemas.historical_bid import (
    HistoricalBidImportRequest,
    HistoricalBidResponse,
    HistoricalBidSectionResponse,
    HistoricalReusePackResponse,
    HistoricalReuseUnitResponse,
)
from app.services.audit import record_audit_event
from app.services.historical_bid_ingestion import rebuild_historical_bid_sections
from app.services.historical_search import search_reuse_units
from app.services.reuse_pack_builder import build_reuse_pack
from app.services.reuse_unit_builder import rebuild_reuse_units

router = APIRouter(prefix="/api/v1/historical-bids", tags=["historical-bids"])


def _get_accessible_document(document_id: int, current_user: UserIdentity, db: Session) -> Document:
    document = db.scalar(
        select(Document)
        .join(Project, Project.id == Document.project_id)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(
            Document.id == document_id,
            Project.organization_id == current_user.organization_id,
            ProjectMember.user_id == current_user.id,
        )
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.post("/import", response_model=HistoricalBidResponse, status_code=status.HTTP_201_CREATED)
def import_historical_bid(
    payload: HistoricalBidImportRequest,
    request: Request,
    current_user: UserIdentity = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)),
    db: Session = Depends(get_db),
) -> HistoricalBidDocument:
    _get_accessible_document(payload.document_id, current_user, db)

    existing = db.scalar(
        select(HistoricalBidDocument).where(HistoricalBidDocument.document_id == payload.document_id)
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Historical bid already exists")

    historical_bid = HistoricalBidDocument(
        organization_id=current_user.organization_id,
        document_id=payload.document_id,
        source_type=payload.source_type,
        project_type=payload.project_type,
        region=payload.region,
        year=payload.year,
        is_recommended=payload.is_recommended,
    )
    db.add(historical_bid)
    db.flush()
    record_audit_event(
        db,
        action="historical_bid.imported",
        resource_type="historical_bid",
        resource_id=str(historical_bid.id),
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        document_id=payload.document_id,
        request_id=getattr(request.state, "request_id", ""),
        detail={"project_type": payload.project_type, "region": payload.region, "year": payload.year},
    )
    db.commit()
    db.refresh(historical_bid)
    return historical_bid


@router.get("", response_model=list[HistoricalBidResponse])
def list_historical_bids(
    pagination: PaginationParams = Depends(pagination_params),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[HistoricalBidDocument]:
    stmt = (
        select(HistoricalBidDocument)
        .where(HistoricalBidDocument.organization_id == current_user.organization_id)
        .order_by(HistoricalBidDocument.id.asc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    return list(db.scalars(stmt))


def _get_historical_bid(historical_bid_id: int, current_user: UserIdentity, db: Session) -> HistoricalBidDocument:
    historical_bid = db.scalar(
        select(HistoricalBidDocument).where(
            HistoricalBidDocument.id == historical_bid_id,
            HistoricalBidDocument.organization_id == current_user.organization_id,
        )
    )
    if historical_bid is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Historical bid not found")
    return historical_bid


@router.post("/{historical_bid_id}/rebuild-sections", response_model=list[HistoricalBidSectionResponse])
def rebuild_sections(
    historical_bid_id: int,
    request: Request,
    current_user: UserIdentity = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)),
    db: Session = Depends(get_db),
) -> list[HistoricalBidSection]:
    historical_bid = _get_historical_bid(historical_bid_id, current_user, db)
    sections = rebuild_historical_bid_sections(db, historical_bid)
    record_audit_event(
        db,
        action="historical_bid.sections.rebuilt",
        resource_type="historical_bid",
        resource_id=str(historical_bid_id),
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        document_id=historical_bid.document_id,
        request_id=getattr(request.state, "request_id", ""),
        detail={"section_count": len(sections)},
    )
    db.commit()
    return sections


@router.get("/{historical_bid_id}/sections", response_model=list[HistoricalBidSectionResponse])
def list_sections(
    historical_bid_id: int,
    pagination: PaginationParams = Depends(pagination_params),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[HistoricalBidSection]:
    _get_historical_bid(historical_bid_id, current_user, db)
    stmt = (
        select(HistoricalBidSection)
        .where(HistoricalBidSection.historical_bid_document_id == historical_bid_id)
        .order_by(HistoricalBidSection.id.asc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    return list(db.scalars(stmt))


@router.post("/{historical_bid_id}/rebuild-reuse-units", response_model=list[HistoricalReuseUnitResponse])
def rebuild_historical_reuse_units(
    historical_bid_id: int,
    request: Request,
    current_user: UserIdentity = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)),
    db: Session = Depends(get_db),
) -> list[HistoricalReuseUnit]:
    historical_bid = _get_historical_bid(historical_bid_id, current_user, db)
    reuse_units = rebuild_reuse_units(db, historical_bid)
    record_audit_event(
        db,
        action="historical_bid.reuse_units.rebuilt",
        resource_type="historical_bid",
        resource_id=str(historical_bid_id),
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        document_id=historical_bid.document_id,
        request_id=getattr(request.state, "request_id", ""),
        detail={"reuse_unit_count": len(reuse_units)},
    )
    db.commit()
    return reuse_units


@router.get("/{historical_bid_id}/reuse-units", response_model=list[HistoricalReuseUnitResponse])
def list_reuse_units(
    historical_bid_id: int,
    pagination: PaginationParams = Depends(pagination_params),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[HistoricalReuseUnit]:
    _get_historical_bid(historical_bid_id, current_user, db)
    stmt = (
        select(HistoricalReuseUnit)
        .join(HistoricalBidSection, HistoricalBidSection.id == HistoricalReuseUnit.historical_bid_section_id)
        .where(HistoricalBidSection.historical_bid_document_id == historical_bid_id)
        .order_by(HistoricalReuseUnit.id.asc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    return list(db.scalars(stmt))


@router.get("/reuse-units/search", response_model=HistoricalReusePackResponse)
def search_historical_reuse_units(
    project_type: str,
    section_type: str,
    q: str | None = None,
    pagination: PaginationParams = Depends(pagination_params),
    current_user: UserIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    reuse_units = search_reuse_units(
        db=db,
        organization_id=current_user.organization_id,
        project_type=project_type,
        section_type=section_type,
        q=q,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    pack = build_reuse_pack(reuse_units)
    return {
        "query": {
            "project_type": project_type,
            "section_type": section_type,
            "q": q,
        },
        **pack,
    }
