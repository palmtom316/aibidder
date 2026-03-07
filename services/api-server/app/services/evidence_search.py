from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Document, EvidenceUnit


def search_evidence_units(
    db: Session,
    *,
    project_id: int,
    q: str,
    document_type: str | None = None,
) -> list[tuple[EvidenceUnit, str]]:
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
    return list(db.execute(stmt).all())
