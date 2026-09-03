"""Centralised application configuration (Pydantic Settings v2).

Values are sourced from environment variables / a local `.env` file.
See `backend/.env.example` for the full contract.
"""

import json
from functools import lru_cache
from typing import Annotated, Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed runtime configuration for the ScriptGrade gateway."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Service -----------------------------------------------------------
    project_name: str = "ScriptGrade Backend"
    api_v1_prefix: str = "/api/v1"
    debug: bool = False
    cors_origins: Annotated[list[str], NoDecode] = Field(
        # Wildcard by default: the Vercel frontend's preview origin rotates per
        # deployment, so any strict list eventually blocks it. Starlette pairs
        # "*" with allow_credentials by mirroring the request Origin on
        # preflights (spec-compliant). Set CORS_ORIGINS to an explicit CSV/JSON
        # list to lock this down later without a code change.
        default=["*"],
    )

    # --- AnalyticDB for PostgreSQL (async driver for the FastAPI gateway) ---
    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/scriptgrade"
    )
    db_echo: bool = False
    db_pool_size: int = 10
    db_max_overflow: int = 20
    pgvector_enabled: bool = True

    # --- JWT / OAuth2 security ---------------------------------------------
    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION-0000000000000000"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # --- Celery / Redis ------------------------------------------------------
    redis_url: str = "redis://localhost:6379/0"

    # --- Alibaba Cloud OSS ---------------------------------------------------
    oss_access_key_id: str = ""
    oss_access_key_secret: str = ""
    oss_bucket_name: str = "scriptgrade-scans"
    oss_endpoint: str = "oss-ap-southeast-1.aliyuncs.com"
    oss_public_base_url: str = ""
    # Fallback object store used when OSS credentials are not configured.
    local_storage_dir: str = "./storage"

    # --- Alibaba Cloud DashScope (Qwen-2.5 / Qwen-VL) -------------------------
    qwen_api_key: str = ""
    qwen_llm_model: str = "qwen-plus"
    qwen_vl_model: str = "qwen-vl-plus"
    qwen_timeout_seconds: float = 60.0

    # --- Upload / grading constraints ----------------------------------------
    max_upload_bytes: int = 50 * 1024 * 1024  # 50 MB per file
    max_batch_files: int = 200
    minutes_per_paper_manual: float = 6.0  # used for the "hours saved" metric

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: Any) -> Any:
        """Accept ``CORS_ORIGINS`` as a JSON array *or* a comma-separated list.

        Managed platforms (Railway, Vercel) make an escaped JSON array awkward
        to set, so a plain CSV is also honoured. Both of these are equivalent::

            CORS_ORIGINS=["https://app.example","https://staging.example"]
            CORS_ORIGINS=https://app.example,https://staging.example

        Blank entries are dropped; a non-string (e.g. the default list) is
        passed through untouched so local `.env` files keep working verbatim.
        """
        if not isinstance(value, str):
            return value
        raw = value.strip()
        if not raw:
            return []
        if raw.startswith("["):
            try:
                decoded = json.loads(raw)
            except json.JSONDecodeError:
                decoded = None
            if isinstance(decoded, list):
                return [str(origin).strip() for origin in decoded if str(origin).strip()]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def sync_database_url(self) -> str:
        """psycopg2 DSN for Celery workers (synchronous context)."""
        return self.database_url.replace("+asyncpg", "+psycopg2")


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor (importable as `settings`)."""
    return Settings()


settings = get_settings()
