from pathlib import Path
import sys

from worker.celery_app import celery_app

API_SERVER_ROOT = Path(__file__).resolve().parents[2] / "api-server"
if str(API_SERVER_ROOT) not in sys.path:
    sys.path.append(str(API_SERVER_ROOT))

from app.services.document_ingestion_tasks import process_document_ingestion  # noqa: E402
from app.services.workbench_pipeline_tasks import (  # noqa: E402
    process_decomposition_run,
    process_generation_job,
    process_layout_job,
    process_review_run,
)


@celery_app.task(name="aibidder.healthcheck")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "worker": "running"}


@celery_app.task(name="aibidder.documents.ingest")
def ingest_uploaded_document(document_version_id: int) -> dict[str, str | int]:
    status = process_document_ingestion(document_version_id)
    return {"document_version_id": document_version_id, "status": status}


@celery_app.task(name="aibidder.workbench.decomposition")
def run_decomposition_pipeline(record_id: int) -> dict[str, str | int]:
    return {"record_id": record_id, "status": process_decomposition_run(record_id)}


@celery_app.task(name="aibidder.workbench.generation")
def run_generation_pipeline(record_id: int) -> dict[str, str | int]:
    return {"record_id": record_id, "status": process_generation_job(record_id)}


@celery_app.task(name="aibidder.workbench.review")
def run_review_pipeline(record_id: int) -> dict[str, str | int]:
    return {"record_id": record_id, "status": process_review_run(record_id)}


@celery_app.task(name="aibidder.workbench.layout")
def run_layout_pipeline(record_id: int) -> dict[str, str | int]:
    return {"record_id": record_id, "status": process_layout_job(record_id)}
