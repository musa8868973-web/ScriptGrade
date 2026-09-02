"""ScriptGrade Backend Microservice.

Production FastAPI gateway exposing the /api/v1 REST contracts that connect
the Next.js frontend to AnalyticDB for PostgreSQL, Alibaba Cloud OSS, the
Celery/Redis ingestion queue and the Qwen-2.5 / Qwen-VL AI layer.
"""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.config import settings
from app.database import engine, init_models


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Application lifecycle: ensure relational schema exists on startup."""
    await init_models()
    yield
    await engine.dispose()


app = FastAPI(
    title="ScriptGrade API Gateway",
    description=(
        "Asynchronous REST gateway for the ScriptGrade multi-modal handwritten "
        "script evaluation platform (Alibaba Cloud AI Hackathon Pakistan 2026)."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["infra"])
async def healthcheck() -> dict[str, str]:
    """Liveness probe used by ECS/container health checks."""
    return {"status": "healthy", "service": "scriptgrade-backend", "version": app.version}


if __name__ == "__main__":
    # Direct-execution entry point for PaaS/container runtimes (Railway injects
    # PORT). Binds 0.0.0.0 so the platform router can reach it and falls back to
    # 8000 for local `python -m app.main` runs.
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
