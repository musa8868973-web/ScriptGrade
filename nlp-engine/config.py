"""ScriptGrade NLP Engine — centralized runtime configuration.

All Alibaba Cloud credentials and debugger sensitivity thresholds are loaded
from environment variables (optionally via a local ``.env`` file) so the
engine can be deployed unchanged on Alibaba Cloud ECS / Container Compute.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class EngineSettings(BaseSettings):
    """Environment-driven configuration for the ScriptGrade NLP engine."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------ #
    # Alibaba Cloud DashScope (unified Qwen inference gateway)            #
    # ------------------------------------------------------------------ #
    qwen_api_key: str = Field(default="", alias="QWEN_API_KEY")
    qwen_llm_model: str = Field(default="qwen-plus", alias="QWEN_LLM_MODEL")
    qwen_vl_model: str = Field(default="qwen-vl-plus", alias="QWEN_VL_MODEL")
    qwen_embedding_model: str = Field(
        default="text-embedding-v3", alias="QWEN_EMBEDDING_MODEL"
    )
    dashscope_base_url: str = Field(
        default="https://dashscope.aliyuncs.com/compatible-mode/v1",
        alias="DASHSCOPE_BASE_URL",
    )
    embedding_dim: int = Field(default=1024, alias="EMBEDDING_DIM")

    # ------------------------------------------------------------------ #
    # AnalyticDB for PostgreSQL (pgvector)                                #
    # ------------------------------------------------------------------ #
    database_url: str = Field(default="", alias="DATABASE_URL")
    pgvector_enabled: bool = Field(default=True, alias="PGVECTOR_ENABLED")
    embeddings_table: str = Field(
        default="scriptgrade_embeddings", alias="EMBEDDINGS_TABLE"
    )

    # ------------------------------------------------------------------ #
    # Debugger thresholds (PRD §3 — Deep Algorithmic Specifications)      #
    # ------------------------------------------------------------------ #
    # Debugger I  — contextual relevance floor for sentence similarity.
    garbage_similarity_threshold: float = 0.35
    # Debugger III — semantic similarity floor for synonym cluster hits.
    synonym_similarity_threshold: float = 0.80
    # Cross-lingual matching (ur/sd/pa transcripts vs. English concept
    # vectors) relaxes similarity floors by this offset.
    cross_lingual_threshold_offset: float = 0.05
    # Debugger IV — Levenshtein similarity floor for auto-correction.
    fuzzy_match_threshold: float = 0.85
    # Debugger VI — fraction of expected labels required to verify a diagram.
    diagram_label_coverage: float = 0.60
    # Debugger VII — density ratio (%) below which a length-bias flag fires.
    density_flag_threshold: float = 30.0

    # ------------------------------------------------------------------ #
    # Transport                                                           #
    # ------------------------------------------------------------------ #
    http_timeout_seconds: float = 120.0
    llm_max_retries: int = 3
    llm_temperature: float = 0.1


@lru_cache(maxsize=1)
def get_settings() -> EngineSettings:
    """Return the process-wide cached engine settings singleton."""
    return EngineSettings()
