"""Celery application instance (Redis broker/result backend).

Start the worker with:

    celery -A app.celery_app.celery worker --loglevel=info
"""

from celery import Celery

from app.config import settings

celery = Celery(
    "scriptgrade",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.tasks"],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    task_default_queue="scriptgrade.ingestion",
)
