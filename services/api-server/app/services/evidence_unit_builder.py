import json
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import Document, DocumentArtifact, DocumentVersion, EvidenceUnit, Project

ALLOWED_EVIDENCE_DOCUMENT_TYPES = {"tender", "norm"}


def rebuild_evidence_units_for_document(db: Session, document: Document) -> list[EvidenceUnit]:
    if document.document_type not in ALLOWED_EVIDENCE_DOCUMENT_TYPES:
        raise ValueError("Only tender and norm documents can build evidence units")

    project = db.scalar(select(Project).where(Project.id == document.project_id))
    if project is None:
        return []

    latest_version = db.scalar(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document.id)
        .order_by(DocumentVersion.version_no.desc(), DocumentVersion.id.desc())
    )
    if latest_version is None:
        return []

    json_artifact = db.scalar(
        select(DocumentArtifact)
        .where(
            DocumentArtifact.document_version_id == latest_version.id,
            DocumentArtifact.artifact_type == "json",
        )
        .order_by(DocumentArtifact.id.desc())
    )
    if json_artifact is None:
        return []

    payload = json.loads(Path(json_artifact.storage_path).read_text(encoding="utf-8"))
    sections_payload = payload.get("sections", [])

    db.execute(delete(EvidenceUnit).where(EvidenceUnit.document_version_id == latest_version.id))

    created_units: list[EvidenceUnit] = []
    for section in sections_payload:
        title = section.get("title") or "Untitled Section"
        section_path = title
        anchor = section.get("anchor") or f"section-{len(created_units) + 1}"
        page = int(section.get("page") or 1)
        content = (section.get("content") or "").strip()

        summary_unit = EvidenceUnit(
            organization_id=project.organization_id,
            project_id=document.project_id,
            document_id=document.id,
            document_version_id=latest_version.id,
            document_type=document.document_type,
            unit_type="section_summary",
            section_title=title,
            section_path=section_path,
            anchor=anchor,
            page_start=page,
            page_end=page,
            content=content or title,
            fts_text=f"{title}\n{content}".strip(),
            metadata_json=json.dumps({"parser_section": True}, ensure_ascii=False),
        )
        db.add(summary_unit)
        created_units.append(summary_unit)

        for paragraph in _split_paragraphs(content):
            paragraph_unit = EvidenceUnit(
                organization_id=summary_unit.organization_id,
                project_id=document.project_id,
                document_id=document.id,
                document_version_id=latest_version.id,
                document_type=document.document_type,
                unit_type="paragraph",
                section_title=title,
                section_path=section_path,
                anchor=anchor,
                page_start=page,
                page_end=page,
                content=paragraph,
                fts_text=f"{title}\n{paragraph}".strip(),
                metadata_json=json.dumps({"parser_section": False}, ensure_ascii=False),
            )
            db.add(paragraph_unit)
            created_units.append(paragraph_unit)

    db.commit()
    for unit in created_units:
        db.refresh(unit)
    return created_units


def list_evidence_units_for_document(db: Session, document_id: int) -> list[EvidenceUnit]:
    stmt = select(EvidenceUnit).where(EvidenceUnit.document_id == document_id).order_by(EvidenceUnit.id.asc())
    return list(db.scalars(stmt))


def _split_paragraphs(content: str) -> list[str]:
    return [paragraph.strip() for paragraph in content.splitlines() if paragraph.strip()]
