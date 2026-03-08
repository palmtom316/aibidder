FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY services/api-server /opt/services/api-server
COPY services/worker /opt/services/worker

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir /opt/services/api-server /opt/services/worker

ENV PYTHONPATH=/opt/services/api-server:/opt/services/worker

CMD ["celery", "-A", "worker.celery_app.celery_app", "worker", "--loglevel=INFO"]
