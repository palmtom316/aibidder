from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import HistoricalBidDocument, HistoricalBidSection, HistoricalReuseUnit


def search_reuse_units(
    db: Session,
    organization_id: int,
    project_type: str,
    section_type: str,
) -> list[HistoricalReuseUnit]:
    stmt = (
        select(HistoricalReuseUnit)
        .join(HistoricalBidSection, HistoricalBidSection.id == HistoricalReuseUnit.historical_bid_section_id)
        .join(HistoricalBidDocument, HistoricalBidDocument.id == HistoricalBidSection.historical_bid_document_id)
        .where(
            HistoricalBidDocument.organization_id == organization_id,
            HistoricalBidDocument.project_type == project_type,
            HistoricalBidSection.section_type == section_type,
        )
        .order_by(HistoricalReuseUnit.fact_density_score.asc(), HistoricalReuseUnit.id.asc())
    )
    return list(db.scalars(stmt))
