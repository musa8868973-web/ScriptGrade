"""pgvector embedding utilities for AnalyticDB PostgreSQL."""

__path__ = __import__("pkgutil").extend_path(__path__, __name__)  # type: ignore[name-defined]

from embeddings.pgvector_client import (
    InMemoryVectorStore,
    PGVectorEmbeddingClient,
    VectorSearchHit,
    VectorStore,
    cosine_similarity,
    get_vector_store,
)

__all__ = [
    "InMemoryVectorStore",
    "PGVectorEmbeddingClient",
    "VectorSearchHit",
    "VectorStore",
    "cosine_similarity",
    "get_vector_store",
]
