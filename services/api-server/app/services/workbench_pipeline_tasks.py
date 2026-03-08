from sqlalchemy import select

from app.core.config import settings
from app.db.models import DecompositionRun, GenerationJob, LayoutJob, ReviewRun
from app.db.session import SessionLocal
from app.services.generation_pipeline import execute_generation_job
from app.services.layout_pipeline import execute_layout_job
from app.services.review_pipeline import execute_review_run
from app.services.tender_decomposition import execute_decomposition_run

TASK_NAMES = {
    "decomposition": "aibidder.workbench.decomposition",
    "generation": "aibidder.workbench.generation",
    "review": "aibidder.workbench.review",
    "layout": "aibidder.workbench.layout",
}


def dispatch_workbench_pipeline_task(*, pipeline_type: str, record_id: int) -> bool:
    task_name = TASK_NAMES.get(pipeline_type)
    if task_name is None:
        return False
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
        celery_app.send_task(task_name, kwargs={"record_id": record_id})
    except Exception:
        return False
    return True


def process_decomposition_run(record_id: int) -> str:
    with SessionLocal() as db:
        run = db.scalar(select(DecompositionRun).where(DecompositionRun.id == record_id))
        if run is None:
            return "missing"
        return execute_decomposition_run(db, run).status


def process_generation_job(record_id: int) -> str:
    with SessionLocal() as db:
        job = db.scalar(select(GenerationJob).where(GenerationJob.id == record_id))
        if job is None:
            return "missing"
        return execute_generation_job(db, job).status


def process_review_run(record_id: int) -> str:
    with SessionLocal() as db:
        run = db.scalar(select(ReviewRun).where(ReviewRun.id == record_id))
        if run is None:
            return "missing"
        return execute_review_run(db, run).status


def process_layout_job(record_id: int) -> str:
    with SessionLocal() as db:
        job = db.scalar(select(LayoutJob).where(LayoutJob.id == record_id))
        if job is None:
            return "missing"
        return execute_layout_job(db, job).status
