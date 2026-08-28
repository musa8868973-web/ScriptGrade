"""Synchronous SQLAlchemy session factory for Celery workers.

Celery workers run outside the asyncio event loop, so they use the psycopg2
driver against AnalyticDB for PostgreSQL.
"""

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

sync_engine = create_engine(
    settings.sync_database_url,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    future=True,
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine, autoflush=False, expire_on_commit=False, future=True
)


@contextmanager
def worker_session() -> Iterator[Session]:
    """Context-managed session with commit/rollback semantics."""
    session = SyncSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
