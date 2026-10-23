"""Redis API caching configuration and invalidation utilities for ScriptGrade."""

import hashlib
import logging
from collections.abc import Callable
from typing import Any

from fastapi import Request, Response
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

CACHE_PREFIX = "scriptgrade-cache"


def scriptgrade_key_builder(
    func: Callable[..., Any],
    namespace: str = "",
    *,
    request: Request | None = None,
    response: Response | None = None,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
) -> str:
    """Build a deterministic cache key by filtering non-serializable dependencies.

    Omits `db`, `session`, `request`, and `response`, and serializes `current_user`
    down to its `user_id` so caching respects tenancy without key collision.
    """
    filtered_kwargs: dict[str, Any] = {}
    for k, v in kwargs.items():
        if k in ("db", "session", "request", "response"):
            continue
        if hasattr(v, "user_id"):
            filtered_kwargs[k] = str(v.user_id)
        else:
            filtered_kwargs[k] = str(v)

    signature = f"{func.__module__}:{func.__name__}:{args}:{sorted(filtered_kwargs.items())}"
    cache_hash = hashlib.md5(signature.encode("utf-8")).hexdigest()
    ns_prefix = f"{namespace}:" if namespace else ""
    return f"{ns_prefix}{cache_hash}"


async def init_cache() -> None:
    """Initialize FastAPICache with Redis, falling back gracefully to memory if offline."""
    try:
        import asyncio

        redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf8",
            decode_responses=False,
        )
        await asyncio.wait_for(redis_client.ping(), timeout=1.5)
        FastAPICache.init(
            RedisBackend(redis_client),
            prefix=CACHE_PREFIX,
            key_builder=scriptgrade_key_builder,
        )
        logger.info("[Cache] Initialized FastAPICache with Redis backend (%s)", settings.redis_url)
    except Exception as exc:
        logger.warning(
            "[Cache] Redis is unreachable (%s). Initializing FastAPICache with InMemoryBackend fallback.",
            exc,
        )
        FastAPICache.init(
            InMemoryBackend(),
            prefix=CACHE_PREFIX,
            key_builder=scriptgrade_key_builder,
        )


async def invalidate_cache_async(*namespaces: str) -> None:
    """Clear cached entries in the given namespaces asynchronously (FastAPI gateway)."""
    try:
        for ns in namespaces:
            await FastAPICache.clear(namespace=ns)
        logger.info("[Cache] Invalidated async cache namespace(s): %s", namespaces)
    except Exception as exc:
        logger.warning("[Cache] Async cache invalidation failed: %s", exc)


def invalidate_cache_sync(*namespaces: str) -> None:
    """Clear cached entries in Redis synchronously (Celery worker context)."""
    try:
        import redis

        client = redis.from_url(settings.redis_url)
        for ns in namespaces:
            pattern = f"{CACHE_PREFIX}:{ns}:*" if ns else f"{CACHE_PREFIX}:*"
            keys = client.keys(pattern)
            if keys:
                client.delete(*keys)
                logger.info(
                    "[Cache] Synchronously deleted %d Redis keys for pattern %s", len(keys), pattern
                )
    except Exception as exc:
        logger.warning("[Cache] Synchronous cache invalidation failed: %s", exc)
