import json
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.document_parser import parse_document
from app.core.storage import read_text_artifact
from app.db.models import (
    CompanyAssetProfile,
    CompanyPerformanceProfile,
    CompanyQualificationProfile,
    DocumentArtifact,
    DocumentVersion,
    LibraryAttachment,
    LibraryChunk,
    LibraryRecord,
    LibraryRecordVersion,
    PersonnelPerformanceProfile,
    PersonnelQualificationProfile,
)
from app.services.norm_structure import build_rule_summary, extract_clause_nodes

LIBRARY_PROJECT_CATEGORIES = [
    "配网工程",
    "变电工程",
    "用户工程",
    "低压营配",
    "劳务分包",
    "抢修抢险",
    "运营维护",
    "预试工程",
    "营销工程",
]

DOCUMENT_RECORD_TYPES = {"historical_bid", "excellent_bid", "norm_spec"}
STRUCTURED_RECORD_TYPES = {
    "company_qualification",
    "company_performance",
    "company_asset",
    "personnel_qualification",
    "personnel_performance",
}


def source_priority_for_record_type(record_type: str) -> str:
    if record_type == "norm_spec":
        return "norm"
    if record_type == "excellent_bid":
        return "excellent_bid"
    if record_type == "historical_bid":
        return "historical_bid"
    return "fact"


def confidence_weight_for_record_type(record_type: str) -> float:
    if record_type == "norm_spec":
        return 3.0
    if record_type == "excellent_bid":
        return 2.0
    if record_type == "historical_bid":
        return 1.0
    return 2.5


def create_library_record_version(
    db: Session,
    *,
    record: LibraryRecord,
    review_notes: str = "",
) -> LibraryRecordVersion:
    version = LibraryRecordVersion(
        library_record_id=record.id,
        version_no=record.current_version_no,
        status=record.status,
        title=record.title,
        summary_text=record.summary_text,
        tags_json=record.tags_json,
        profile_json=record.profile_json,
        metadata_json=record.metadata_json,
        review_notes=review_notes,
        created_by_user_id=record.created_by_user_id,
    )
    db.add(version)
    db.flush()
    return version


def sync_profile_table(db: Session, record: LibraryRecord) -> None:
    payload = _parse_json_object(record.profile_json)
    if record.record_type == "company_qualification":
        _upsert_unique_profile(
            db,
            CompanyQualificationProfile,
            record.id,
            qualification_name=payload.get("qualification_name", ""),
            qualification_level=payload.get("qualification_level", ""),
            valid_until=payload.get("valid_until", ""),
            certificate_no=payload.get("certificate_no", ""),
        )
    elif record.record_type == "company_performance":
        _upsert_unique_profile(
            db,
            CompanyPerformanceProfile,
            record.id,
            contract_name=payload.get("contract_name", ""),
            project_features=payload.get("project_features", ""),
            contract_amount=payload.get("contract_amount", ""),
            project_category=payload.get("project_category", record.project_category),
            start_date=payload.get("start_date", ""),
            completion_date=payload.get("completion_date", ""),
        )
    elif record.record_type == "company_asset":
        _upsert_unique_profile(
            db,
            CompanyAssetProfile,
            record.id,
            equipment_name=payload.get("equipment_name", ""),
            equipment_brand=payload.get("equipment_brand", ""),
            equipment_model=payload.get("equipment_model", ""),
            purchase_date=payload.get("purchase_date", ""),
        )
    elif record.record_type == "personnel_qualification":
        _upsert_unique_profile(
            db,
            PersonnelQualificationProfile,
            record.id,
            person_name=payload.get("person_name", ""),
            education=payload.get("education", ""),
            title_name=payload.get("title_name", ""),
            qualification_name=payload.get("qualification_name", ""),
            qualification_valid_until=payload.get("qualification_valid_until", ""),
        )
    elif record.record_type == "personnel_performance":
        _upsert_unique_profile(
            db,
            PersonnelPerformanceProfile,
            record.id,
            person_name=payload.get("person_name", ""),
            project_name=payload.get("project_name", ""),
            project_category=payload.get("project_category", record.project_category),
            project_role=payload.get("project_role", ""),
        )


def rebuild_chunks_for_record(db: Session, record: LibraryRecord) -> list[LibraryChunk]:
    db.execute(delete(LibraryChunk).where(LibraryChunk.library_record_id == record.id))
    db.flush()

    version = create_library_record_version(db, record=record)
    if record.record_type in DOCUMENT_RECORD_TYPES and record.source_document_id is not None:
        return _build_document_chunks(db, record, version)

    chunks: list[LibraryChunk] = []
    payload = _parse_json_object(record.profile_json)
    summary_source = " ".join(str(value) for value in payload.values() if value)
    if summary_source:
        chunk = LibraryChunk(
            organization_id=record.organization_id,
            project_id=record.project_id,
            library_record_id=record.id,
            library_record_version_id=version.id,
            chunk_type="profile",
            title=record.title,
            section_path=record.title,
            anchor="profile-1",
            page_start=1,
            page_end=1,
            content=summary_source,
            summary_text=record.summary_text or summary_source[:160],
            tags_json=record.tags_json,
            source_priority=record.source_priority,
            retrieval_weight=record.confidence_weight,
            fts_text=f"{record.title}\n{summary_source}".strip(),
            metadata_json=json.dumps({"profile_record": True}, ensure_ascii=False),
        )
        db.add(chunk)
        chunks.append(chunk)
    db.flush()
    return chunks


def build_attachment_from_parsed_file(
    *,
    attachment: LibraryAttachment,
    parsed_document,
    record: LibraryRecord,
    version: LibraryRecordVersion | None,
) -> list[LibraryChunk]:
    chunks: list[LibraryChunk] = []
    if parsed_document is None:
        return chunks

    sections = parsed_document.structured_payload.get("sections", [])
    for index, section in enumerate(sections, start=1):
        title = str(section.get("title") or f"Attachment Section {index}")
        content = str(section.get("content") or title)
        tags = json.dumps(_infer_tags(title=title, content=content, record=record), ensure_ascii=False)
        chunk = LibraryChunk(
            organization_id=record.organization_id,
            project_id=record.project_id,
            library_record_id=record.id,
            library_record_version_id=version.id if version is not None else None,
            attachment_id=attachment.id,
            chunk_type="attachment_excerpt",
            title=title,
            section_path=title,
            anchor=str(section.get("anchor") or f"attachment-{attachment.id}-{index}"),
            page_start=int(section.get("page") or 1),
            page_end=int(section.get("page") or 1),
            content=content,
            summary_text=content[:160],
            tags_json=tags,
            source_priority=record.source_priority,
            retrieval_weight=record.confidence_weight,
            fts_text=f"{record.title}\n{title}\n{content}".strip(),
            metadata_json=json.dumps({"attachment_role": attachment.attachment_role}, ensure_ascii=False),
        )
        chunks.append(chunk)
    return chunks


def parse_attachment_file(path: str, filename: str):
    suffix = Path(filename).suffix.lower()
    if suffix not in {".pdf", ".docx"}:
        return None
    return parse_document(path, filename)


def latest_record_version(db: Session, record_id: int) -> LibraryRecordVersion | None:
    return db.scalar(
        select(LibraryRecordVersion)
        .where(LibraryRecordVersion.library_record_id == record_id)
        .order_by(LibraryRecordVersion.version_no.desc(), LibraryRecordVersion.id.desc())
    )


def ensure_project_category(project_category: str) -> None:
    if project_category not in LIBRARY_PROJECT_CATEGORIES:
        raise ValueError("Unsupported project category")


def _build_document_chunks(db: Session, record: LibraryRecord, version: LibraryRecordVersion) -> list[LibraryChunk]:
    payload = _load_document_payload(db, record.source_document_id)
    if payload is None:
        return []

    sections = payload.get("sections", [])
    chunks: list[LibraryChunk] = []
    if record.record_type == "norm_spec":
        clause_nodes = extract_clause_nodes(sections)
        clause_samples = {node.clause_id: node for node in clause_nodes}
        for index, section in enumerate(sections, start=1):
            title = str(section.get("title") or f"Section {index}")
            content = str(section.get("content") or title)
            tags = _infer_tags(title=title, content=content, record=record)
            anchor = str(section.get("anchor") or f"section-{index}")
            summary_text = build_rule_summary(sections=sections, clause_nodes=clause_nodes)
            chunks.append(
                LibraryChunk(
                    organization_id=record.organization_id,
                    project_id=record.project_id,
                    library_record_id=record.id,
                    library_record_version_id=version.id,
                    chunk_type="clause" if any(node.title in content for node in clause_nodes) else "section",
                    title=title,
                    section_path=title,
                    anchor=anchor,
                    page_start=int(section.get("page") or 1),
                    page_end=int(section.get("page") or 1),
                    content=content,
                    summary_text=summary_text,
                    tags_json=json.dumps(tags + [sample for sample in clause_samples if sample in content][:2], ensure_ascii=False),
                    source_priority=record.source_priority,
                    retrieval_weight=record.confidence_weight + 1.0,
                    fts_text=f"{title}\n{content}".strip(),
                    metadata_json=json.dumps({"norm": True}, ensure_ascii=False),
                )
            )
    else:
        for index, section in enumerate(sections, start=1):
            title = str(section.get("title") or f"Section {index}")
            content = str(section.get("content") or title)
            tags = _infer_tags(title=title, content=content, record=record)
            chunks.append(
                LibraryChunk(
                    organization_id=record.organization_id,
                    project_id=record.project_id,
                    library_record_id=record.id,
                    library_record_version_id=version.id,
                    chunk_type="section",
                    title=title,
                    section_path=title,
                    anchor=str(section.get("anchor") or f"section-{index}"),
                    page_start=int(section.get("page") or 1),
                    page_end=int(section.get("page") or 1),
                    content=content,
                    summary_text=content[:160],
                    tags_json=json.dumps(tags, ensure_ascii=False),
                    source_priority=record.source_priority,
                    retrieval_weight=record.confidence_weight,
                    fts_text=f"{title}\n{content}".strip(),
                    metadata_json=json.dumps({"document_record": True}, ensure_ascii=False),
                )
            )
    for chunk in chunks:
        db.add(chunk)
    db.flush()
    return chunks


def _load_document_payload(db: Session, document_id: int | None) -> dict[str, Any] | None:
    if document_id is None:
        return None
    json_artifact = db.scalar(
        select(DocumentArtifact)
        .join(DocumentVersion, DocumentVersion.id == DocumentArtifact.document_version_id)
        .where(
            DocumentVersion.document_id == document_id,
            DocumentArtifact.artifact_type == "json",
        )
        .order_by(DocumentVersion.version_no.desc(), DocumentArtifact.id.desc())
    )
    if json_artifact is None:
        return None
    return json.loads(read_text_artifact(json_artifact.storage_path))


def _infer_tags(*, title: str, content: str, record: LibraryRecord) -> list[str]:
    text = f"{title}\n{content}"
    tags = [record.record_type, record.project_category]
    keyword_groups = {
        "资质": ["资质", "许可", "证书", "执照"],
        "业绩": ["业绩", "合同", "中标", "竣工"],
        "设备": ["设备", "机具", "仪器", "采购"],
        "人员": ["人员", "项目经理", "工程师", "社保"],
        "规范": ["规范", "规程", "条款", "验收", "总则"],
    }
    for tag, keywords in keyword_groups.items():
        if any(keyword in text for keyword in keywords):
            tags.append(tag)
    unique_tags: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        if not tag or tag in seen:
            continue
        seen.add(tag)
        unique_tags.append(tag)
    return unique_tags


def _parse_json_object(payload: str) -> dict[str, Any]:
    try:
        value = json.loads(payload or "{}")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _upsert_unique_profile(db: Session, model, library_record_id: int, **values) -> None:
    instance = db.scalar(select(model).where(model.library_record_id == library_record_id))
    if instance is None:
        instance = model(library_record_id=library_record_id, **values)
        db.add(instance)
        db.flush()
        return
    for key, value in values.items():
        setattr(instance, key, value)
    db.flush()
