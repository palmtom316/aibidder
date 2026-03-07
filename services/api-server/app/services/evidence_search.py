from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db.models import Document, EvidenceUnit


def search_evidence_units(
    db: Session,
    *,
    project_id: int,
    q: str,
    document_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[tuple[EvidenceUnit, str]]:
    dialect = db.bind.dialect.name if db.bind is not None else ""
    if dialect == "postgresql":
        ts_query = func.plainto_tsquery("simple", q)
        rank = func.ts_rank(func.to_tsvector("simple", func.coalesce(EvidenceUnit.fts_text, "")), ts_query)
        stmt = (
            select(EvidenceUnit, Document.filename)
            .join(Document, Document.id == EvidenceUnit.document_id)
            .where(
                EvidenceUnit.project_id == project_id,
                func.to_tsvector("simple", func.coalesce(EvidenceUnit.fts_text, "")).op("@@")(ts_query),
            )
            .order_by(desc(rank), EvidenceUnit.id.asc())
        )
    else:
        stmt = (
            select(EvidenceUnit, Document.filename)
            .join(Document, Document.id == EvidenceUnit.document_id)
            .where(
                EvidenceUnit.project_id == project_id,
                EvidenceUnit.fts_text.ilike(f"%{q}%"),
            )
            .order_by(EvidenceUnit.id.asc())
        )

    if document_type:
        stmt = stmt.where(EvidenceUnit.document_type == document_type)
    stmt = stmt.limit(limit).offset(offset)
    return list(db.execute(stmt).all())
