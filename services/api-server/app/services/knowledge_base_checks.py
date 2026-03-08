import json
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import DocumentArtifact, DocumentVersion, KnowledgeBaseEntry
from app.services.risk_marker import detect_risk_marks


def run_knowledge_base_entry_check(db: Session, entry: KnowledgeBaseEntry) -> tuple[str, str]:
    sampled_text = "\n".join(_collect_candidate_texts(db, entry))
    marks = detect_risk_marks(sampled_text)
    if not marks:
        return (
            "checked",
            f"Checked {entry.category}: anchors, source metadata, and reuse readiness passed local baseline.",
        )

    snippets: list[str] = []
    seen_pairs: set[tuple[str, str]] = set()
    for mark in marks:
        pair = (mark.raw_value, mark.replacement_token)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        snippets.append(f"{mark.raw_value}→{mark.replacement_token}")
        if len(snippets) >= 5:
            break

    return (
        "attention_needed",
        f"发现 {len(marks)} 处疑似敏感信息，建议清洗后再复用：{'；'.join(snippets)}",
    )



def _collect_candidate_texts(db: Session, entry: KnowledgeBaseEntry) -> Iterable[str]:
    yield entry.title
    if entry.owner_name:
        yield entry.owner_name

    if entry.source_document_id is None:
        return

    stmt = (
        select(DocumentArtifact.artifact_type, DocumentArtifact.storage_path)
        .join(DocumentVersion, DocumentVersion.id == DocumentArtifact.document_version_id)
        .where(DocumentVersion.document_id == entry.source_document_id)
        .order_by(DocumentVersion.version_no.desc(), DocumentArtifact.id.desc())
    )
    artifacts = list(db.execute(stmt).all())

    markdown_path = next((path for artifact_type, path in artifacts if artifact_type == "markdown"), None)
    if markdown_path is not None:
        try:
            yield _read_text(markdown_path)
        except OSError:
            pass
        return

    json_path = next((path for artifact_type, path in artifacts if artifact_type == "json"), None)
    if json_path is None:
        return

    try:
        payload = json.loads(_read_text(json_path))
    except (OSError, json.JSONDecodeError):
        return

    for section in payload.get("sections", []):
        title = section.get("title")
        content = section.get("content")
        if title:
            yield str(title)
        if content:
            yield str(content)



def _read_text(path: str) -> str:
    with open(path, encoding="utf-8") as handle:
        return handle.read()
