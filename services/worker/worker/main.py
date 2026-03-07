from __future__ import annotations

import os

try:
    from celery import Celery
except ImportError:  # pragma: no cover
    Celery = None

BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/1")


if Celery is not None:
    celery_app = Celery("aibidder-worker", broker=BROKER_URL, backend=RESULT_BACKEND)
    celery_app.conf.update(task_serializer="json", result_serializer="json", accept_content=["json"])

    @celery_app.task(name="worker.ping")
    def ping() -> str:
        return "pong"
else:  # pragma: no cover
    celery_app = None


def main() -> None:
    if celery_app is None:
        print("Celery is not installed; worker scaffold is present but inactive.")
        return
    celery_app.worker_main(["worker", "--loglevel=info"])


if __name__ == "__main__":
    main()
