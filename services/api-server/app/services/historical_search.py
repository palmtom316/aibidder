from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db.models import HistoricalBidDocument, HistoricalBidSection, HistoricalReuseUnit


def search_reuse_units(
    db: Session,
    organization_id: int,
    project_type: str,
    section_type: str,
    *,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
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
    )

    query_text = (q or '').strip()
    dialect = db.bind.dialect.name if db.bind is not None else ''
    if query_text:
        if dialect == 'postgresql':
            ts_query = func.plainto_tsquery('simple', query_text)
            rank = func.ts_rank(func.to_tsvector('simple', func.coalesce(HistoricalBidSection.fts_text, '')), ts_query)
            stmt = stmt.where(
                func.to_tsvector('simple', func.coalesce(HistoricalBidSection.fts_text, '')).op('@@')(ts_query)
            ).order_by(desc(rank), HistoricalReuseUnit.fact_density_score.asc(), HistoricalReuseUnit.id.asc())
        else:
            keyword = f'%{query_text}%'
            stmt = stmt.where(
                HistoricalBidSection.fts_text.ilike(keyword)
                | HistoricalReuseUnit.sanitized_text.ilike(keyword)
                | HistoricalReuseUnit.raw_text.ilike(keyword)
            ).order_by(HistoricalReuseUnit.fact_density_score.asc(), HistoricalReuseUnit.id.asc())
    else:
        stmt = stmt.order_by(HistoricalReuseUnit.fact_density_score.asc(), HistoricalReuseUnit.id.asc())

    stmt = stmt.limit(limit).offset(offset)
    return list(db.scalars(stmt))
