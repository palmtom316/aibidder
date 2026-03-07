from worker.celery_app import celery_app


@celery_app.task(name="aibidder.healthcheck")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "worker": "running"}
