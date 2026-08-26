"""ScriptGrade NLP Engine — AnalyticDB PostgreSQL (pgvector) embedding client.

Generates Alibaba Cloud Text-Embedding vectors and stores/queries them in
AnalyticDB for PostgreSQL with the pgvector extension:

* ``upsert`` — index rubric concepts & pre-generated synonym clusters
  (namespaced, keyed, JSONB metadata — the "rubrics JSON table" surface).
* ``query``  — cosine-similarity nearest-neighbour search (``<=>`` operator).

When ``DATABASE_URL`` is not configured (or the AnalyticDB instance is
unreachable) the client transparently degrades to an in-process numpy cosine
store so the deterministic debugger suite keeps running in local demos.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Protocol

import numpy as np
from pydantic import BaseModel, Field

from config import EngineSettings, get_settings
from llm_client import DashScopeClient, DashScopeClientError, get_dashscope_client

logger = logging.getLogger(__name__)


class VectorSearchHit(BaseModel):
    """One cosine-similarity nearest-neighbour result."""

    item_key: str
    content: str
    score: float = Field(..., description="Cosine similarity in [-1, 1]")
    metadata: dict[str, Any] = Field(default_factory=dict)


class VectorStore(Protocol):
    """Interface implemented by both the pgvector and fallback stores."""

    async def upsert(
        self,
        namespace: str,
        items: list[dict[str, Any]],
    ) -> int:
        """Index items shaped as ``{"key", "text", "metadata"?}``. Returns count."""
        ...

    async def query(
        self,
        namespace: str,
        query_text: str,
        *,
        top_k: int = 5,
        key_prefix: str | None = None,
        min_score: float = -1.0,
    ) -> list[VectorSearchHit]:
        """Return nearest neighbours of ``query_text`` by cosine similarity."""
        ...

    async def query_vector(
        self,
        namespace: str,
        vector: list[float],
        *,
        top_k: int = 5,
        key_prefix: str | None = None,
        min_score: float = -1.0,
    ) -> list[VectorSearchHit]:
        """Nearest-neighbour search against a pre-computed query vector."""
        ...


def cosine_similarity(a: list[float] | np.ndarray, b: list[float] | np.ndarray) -> float:
    """Cosine similarity between two embedding vectors (0.0 on zero norm)."""
    va = np.asarray(a, dtype=np.float64)
    vb = np.asarray(b, dtype=np.float64)
    norm_a = float(np.linalg.norm(va))
    norm_b = float(np.linalg.norm(vb))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


class PGVectorEmbeddingClient:
    """Embedding generation + AnalyticDB pgvector storage & cosine search."""

    def __init__(
        self,
        embedder: DashScopeClient | None = None,
        settings: EngineSettings | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.embedder = embedder or get_dashscope_client()
        self._pool: Any = None
        self._schema_ready = False
        self._fallback: InMemoryVectorStore | None = None

    # ------------------------------------------------------------------ #
    # Embedding generation (Alibaba Cloud Text-Embedding models)          #
    # ------------------------------------------------------------------ #
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Generate pgvector-ready embeddings for a batch of texts."""
        return await self.embedder.embed(texts)

    async def embed_text(self, text: str) -> list[float]:
        return (await self.embed_texts([text]))[0]

    # ------------------------------------------------------------------ #
    # AnalyticDB connection management                                    #
    # ------------------------------------------------------------------ #
    def _analyticsdb_dsn(self) -> str:
        """Normalize SQLAlchemy-style URLs to a plain asyncpg DSN."""
        dsn = self.settings.database_url.strip()
        return dsn.replace("postgresql+asyncpg://", "postgresql://", 1)

    async def _get_pool(self) -> Any:
        """Lazily open the asyncpg pool; None when AnalyticDB is unavailable."""
        if not (self.settings.pgvector_enabled and self._analyticsdb_dsn()):
            return None
        if self._pool is not None:
            return self._pool
        try:
            import asyncpg

            self._pool = await asyncpg.create_pool(
                dsn=self._analyticsdb_dsn(), min_size=1, max_size=5
            )
        except Exception as exc:  # pragma: no cover - depends on infra
            logger.warning("AnalyticDB unreachable (%s) — using in-memory store", exc)
            self._pool = None
            return None
        await self._ensure_schema()
        return self._pool

    async def _ensure_schema(self) -> None:
        if self._schema_ready or self._pool is None:
            return
        table = self.settings.embeddings_table
        dim = self.settings.embedding_dim
        async with self._pool.acquire() as conn:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            await conn.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {table} (
                    id         BIGSERIAL PRIMARY KEY,
                    namespace  TEXT NOT NULL,
                    item_key   TEXT NOT NULL,
                    content    TEXT NOT NULL,
                    metadata   JSONB NOT NULL DEFAULT '{{}}',
                    embedding  vector({dim}) NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE (namespace, item_key)
                );
                """
            )
        self._schema_ready = True

    def _fallback_store(self) -> "InMemoryVectorStore":
        if self._fallback is None:
            self._fallback = InMemoryVectorStore(self.embedder, self.settings)
        return self._fallback

    # ------------------------------------------------------------------ #
    # Write path — index concepts & synonym clusters                      #
    # ------------------------------------------------------------------ #
    async def upsert(self, namespace: str, items: list[dict[str, Any]]) -> int:
        """Embed and upsert items (``{"key", "text", "metadata"?}``) into AnalyticDB."""
        if not items:
            return 0
        texts = [item["text"] for item in items]
        vectors = await self.embed_texts(texts)
        pool = await self._get_pool()
        if pool is None:
            return await self._fallback_store().upsert_with_vectors(
                namespace, items, vectors
            )
        table = self.settings.embeddings_table
        async with pool.acquire() as conn:
            for item, vector in zip(items, vectors):
                await conn.execute(
                    f"""
                    INSERT INTO {table} (namespace, item_key, content, metadata, embedding)
                    VALUES ($1, $2, $3, $4::jsonb, $5::vector)
                    ON CONFLICT (namespace, item_key) DO UPDATE
                    SET content   = EXCLUDED.content,
                        metadata  = EXCLUDED.metadata,
                        embedding = EXCLUDED.embedding;
                    """,
                    namespace,
                    item["key"],
                    item["text"],
                    json.dumps(item.get("metadata", {})),
                    json.dumps(vector),
                )
        return len(items)

    # ------------------------------------------------------------------ #
    # Read path — cosine similarity search                                #
    # ------------------------------------------------------------------ #
    async def query(
        self,
        namespace: str,
        query_text: str,
        *,
        top_k: int = 5,
        key_prefix: str | None = None,
        min_score: float = -1.0,
    ) -> list[VectorSearchHit]:
        vector = await self.embed_text(query_text)
        return await self.query_vector(
            namespace, vector, top_k=top_k, key_prefix=key_prefix, min_score=min_score
        )

    async def query_vector(
        self,
        namespace: str,
        vector: list[float],
        *,
        top_k: int = 5,
        key_prefix: str | None = None,
        min_score: float = -1.0,
    ) -> list[VectorSearchHit]:
        pool = await self._get_pool()
        if pool is None:
            return await self._fallback_store().query_vector(
                namespace, vector, top_k=top_k, key_prefix=key_prefix, min_score=min_score
            )
        table = self.settings.embeddings_table
        like_pattern = f"{key_prefix}%" if key_prefix else None
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT item_key,
                       content,
                       metadata,
                       1 - (embedding <=> $2::vector) AS score
                FROM {table}
                WHERE namespace = $1
                  AND ($3::text IS NULL OR item_key LIKE $3)
                ORDER BY embedding <=> $2::vector
                LIMIT $4;
                """,
                namespace,
                json.dumps(vector),
                like_pattern,
                top_k,
            )
        hits: list[VectorSearchHit] = []
        for row in rows:
            score = float(row["score"])
            if score < min_score:
                continue
            metadata = row["metadata"]
            if isinstance(metadata, str):
                metadata = json.loads(metadata)
            hits.append(
                VectorSearchHit(
                    item_key=row["item_key"],
                    content=row["content"],
                    score=round(score, 4),
                    metadata=metadata or {},
                )
            )
        return hits

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None
            self._schema_ready = False


class InMemoryVectorStore:
    """numpy-backed cosine store used when AnalyticDB is not configured."""

    def __init__(
        self,
        embedder: DashScopeClient | None = None,
        settings: EngineSettings | None = None,
    ) -> None:
        self.embedder = embedder or get_dashscope_client()
        self.settings = settings or get_settings()
        # namespace -> { key -> (content, metadata, vector) }
        self._store: dict[str, dict[str, tuple[str, dict[str, Any], list[float]]]] = {}

    async def upsert(self, namespace: str, items: list[dict[str, Any]]) -> int:
        if not items:
            return 0
        vectors = await self.embedder.embed([item["text"] for item in items])
        return await self.upsert_with_vectors(namespace, items, vectors)

    async def upsert_with_vectors(
        self,
        namespace: str,
        items: list[dict[str, Any]],
        vectors: list[list[float]],
    ) -> int:
        bucket = self._store.setdefault(namespace, {})
        for item, vector in zip(items, vectors):
            bucket[item["key"]] = (item["text"], item.get("metadata", {}), vector)
        return len(items)

    async def query(
        self,
        namespace: str,
        query_text: str,
        *,
        top_k: int = 5,
        key_prefix: str | None = None,
        min_score: float = -1.0,
    ) -> list[VectorSearchHit]:
        vector = await self.embedder.embed_one(query_text)
        return await self.query_vector(
            namespace, vector, top_k=top_k, key_prefix=key_prefix, min_score=min_score
        )

    async def query_vector(
        self,
        namespace: str,
        vector: list[float],
        *,
        top_k: int = 5,
        key_prefix: str | None = None,
        min_score: float = -1.0,
    ) -> list[VectorSearchHit]:
        bucket = self._store.get(namespace, {})
        scored: list[VectorSearchHit] = []
        for key, (content, metadata, stored_vector) in bucket.items():
            if key_prefix and not key.startswith(key_prefix):
                continue
            score = cosine_similarity(vector, stored_vector)
            if score >= min_score:
                scored.append(
                    VectorSearchHit(
                        item_key=key,
                        content=content,
                        score=round(score, 4),
                        metadata=metadata,
                    )
                )
        scored.sort(key=lambda hit: hit.score, reverse=True)
        return scored[:top_k]


_vector_store_singleton: PGVectorEmbeddingClient | None = None


def get_vector_store() -> PGVectorEmbeddingClient:
    """Return the process-wide pgvector embedding client singleton."""
    global _vector_store_singleton
    if _vector_store_singleton is None:
        try:
            _vector_store_singleton = PGVectorEmbeddingClient()
        except DashScopeClientError:  # pragma: no cover - defensive
            _vector_store_singleton = PGVectorEmbeddingClient(
                embedder=get_dashscope_client()
            )
    return _vector_store_singleton
