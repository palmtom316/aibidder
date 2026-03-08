import json
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.storage import read_text_artifact

from app.db.models import DocumentArtifact, DocumentVersion, HistoricalBidDocument, HistoricalBidSection
from app.services.section_classifier import classify_section_type


def rebuild_historical_bid_sections(db: Session, historical_bid: HistoricalBidDocument) -> list[HistoricalBidSection]:
    json_artifact = db.scalar(
        select(DocumentArtifact)
        .join(DocumentVersion, DocumentVersion.id == DocumentArtifact.document_version_id)
        .where(
            DocumentVersion.document_id == historical_bid.document_id,
            DocumentArtifact.artifact_type == "json",
        )
        .order_by(DocumentVersion.version_no.desc(), DocumentArtifact.id.desc())
    )
    if json_artifact is None:
        return []

    payload = json.loads(read_text_artifact(json_artifact.storage_path))
    sections_payload = payload.get("sections", [])

    db.execute(
        delete(HistoricalBidSection).where(
            HistoricalBidSection.historical_bid_document_id == historical_bid.id
        )
    )

    created_sections: list[HistoricalBidSection] = []
    for section in sections_payload:
        title = section.get("title") or "Untitled Section"
        section_path = title
        section_type = classify_section_type(title=title, section_path=section_path)
        content = section.get("content") or title
        created_section = HistoricalBidSection(
            historical_bid_document_id=historical_bid.id,
            title=title,
            section_path=section_path,
            section_type=section_type,
            anchor=section.get("anchor") or f"section-{len(created_sections) + 1}",
            page_start=section.get("page") or 1,
            page_end=section.get("page") or 1,
            raw_text=content,
            fts_text=f"{title}\n{content}".strip(),
        )
        db.add(created_section)
        created_sections.append(created_section)

    historical_bid.ingestion_status = "sectioned"
    db.commit()

    for created_section in created_sections:
        db.refresh(created_section)
    return created_sections
