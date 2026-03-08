from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.document_ingestion import ingest_document
from app.db.models import Document, DocumentArtifact, DocumentVersion
from app.db.session import SessionLocal
from app.services.evidence_unit_builder import rebuild_evidence_units_for_document, supports_evidence_units

TASK_NAME = "aibidder.documents.ingest"



def dispatch_document_ingestion_task(*, document_version_id: int) -> bool:
    try:
        from celery import Celery
    except ImportError:
        return False

    try:
        celery_app = Celery(
            "aibidder-api",
            broker=settings.celery_broker_url,
            backend=settings.celery_result_backend,
        )
        celery_app.send_task(TASK_NAME, kwargs={"document_version_id": document_version_id})
    except Exception:
        return False
    return True



def finalize_document_ingestion(
    db: Session,
    *,
    document: Document,
    document_version: DocumentVersion,
    source_path: str,
    filename: str,
) -> str:
    db.execute(
        delete(DocumentArtifact).where(
            DocumentArtifact.document_version_id == document_version.id,
            DocumentArtifact.artifact_type != "source",
        )
    )
    db.flush()

    ingestion_result = ingest_document(
        project_id=document.project_id,
        document_id=document.id,
        version_no=document_version.version_no,
        source_path=source_path,
        filename=filename,
    )
    for artifact in ingestion_result.artifacts:
        db.add(
            DocumentArtifact(
                document_version_id=document_version.id,
                artifact_type=artifact.artifact_type,
                storage_path=artifact.storage_path,
            )
        )
    document_version.status = ingestion_result.status

    if ingestion_result.status == "parsed" and supports_evidence_units(document.document_type):
        db.flush()
        rebuild_evidence_units_for_document(db, document)

    return ingestion_result.status



def process_document_ingestion(document_version_id: int) -> str:
    with SessionLocal() as db:
        document_version = db.get(DocumentVersion, document_version_id)
        if document_version is None:
            return "missing"

        document = db.scalar(select(Document).where(Document.id == document_version.document_id))
        if document is None:
            document_version.status = "failed"
            db.commit()
            return "failed"

        source_artifact = db.scalar(
            select(DocumentArtifact)
            .where(
                DocumentArtifact.document_version_id == document_version.id,
                DocumentArtifact.artifact_type == "source",
            )
            .order_by(DocumentArtifact.id.desc())
        )
        if source_artifact is None:
            document_version.status = "failed"
            db.commit()
            return "failed"

        status = finalize_document_ingestion(
            db,
            document=document,
            document_version=document_version,
            source_path=source_artifact.storage_path,
            filename=document.filename,
        )
        db.commit()
        return status
