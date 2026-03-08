import os

from celery import Celery

broker_url = (
    os.getenv("WORKER_BROKER_URL")
    or os.getenv("CELERY_BROKER_URL")
    or os.getenv("REDIS_URL")
    or "redis://redis:6379/0"
)
result_backend = (
    os.getenv("WORKER_RESULT_BACKEND")
    or os.getenv("CELERY_RESULT_BACKEND")
    or broker_url
)

celery_app = Celery("aibidder", broker=broker_url, backend=result_backend)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
celery_app.autodiscover_tasks(["worker"])
