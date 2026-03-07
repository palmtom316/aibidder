FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir .

COPY worker ./worker

CMD ["celery", "-A", "worker.celery_app.celery_app", "worker", "--loglevel=INFO"]
