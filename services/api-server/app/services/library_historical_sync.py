from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import HistoricalBidDocument, LibraryRecord


def sync_historical_bid_from_library_record(db: Session, record: LibraryRecord) -> HistoricalBidDocument | None:
    if record.record_type not in {"historical_bid", "excellent_bid"}:
        return None
    if record.source_document_id is None:
        return None

    existing = db.scalar(
        select(HistoricalBidDocument).where(HistoricalBidDocument.document_id == record.source_document_id)
    )
    source_type = "excellent_sample" if record.record_type == "excellent_bid" else "won_bid"
    year = _derive_year(record)
    if existing is None:
        existing = HistoricalBidDocument(
            organization_id=record.organization_id,
            document_id=record.source_document_id,
            library_record_id=record.id,
            source_type=source_type,
            project_type=record.project_category,
            region="未填写",
            year=year,
            is_recommended=record.record_type == "excellent_bid",
            ingestion_status="imported",
        )
        db.add(existing)
        db.flush()
        return existing

    existing.library_record_id = record.id
    existing.source_type = source_type
    existing.project_type = record.project_category
    existing.is_recommended = record.record_type == "excellent_bid"
    if not existing.region:
        existing.region = "未填写"
    existing.year = existing.year or year
    db.flush()
    return existing


def _derive_year(record: LibraryRecord) -> int:
    try:
        created = record.created_at
    except AttributeError:
        created = None
    if isinstance(created, datetime):
        return created.year
    return datetime.utcnow().year
