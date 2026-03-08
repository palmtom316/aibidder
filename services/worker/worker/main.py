from __future__ import annotations

from worker.celery_app import celery_app


@celery_app.task(name="worker.ping")
def ping() -> str:
    return "pong"


def main() -> None:
    celery_app.worker_main(["worker", "--loglevel=info"])


if __name__ == "__main__":
    main()
