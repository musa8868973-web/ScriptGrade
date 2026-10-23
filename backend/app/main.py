"""ScriptGrade Backend Microservice.

Production FastAPI gateway exposing the /api/v1 REST contracts that connect
the Next.js frontend to AnalyticDB for PostgreSQL, Alibaba Cloud OSS, the
Celery/Redis ingestion queue and the Qwen-2.5 / Qwen-VL AI layer.
"""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import api_router
from app.config import settings
from app.database import engine, init_models


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Application lifecycle: ensure relational schema, demo data, and Redis cache exist."""
    await init_models()
    try:
        from seed import seed

        await seed()
    except Exception:
        pass

    from app.core.cache import init_cache

    await init_cache()
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
    # Defaults to ["*"] (see config.cors_origins): with allow_credentials,
    # Starlette mirrors the request Origin on preflights, so every origin —
    # including rotating Vercel preview subdomains — passes OPTIONS without a
    # strict allowlist. Set the CORS_ORIGINS env var to pin explicit origins.
    allow_origins=settings.cors_origins,
    # Belt-and-braces: even if CORS_ORIGINS is pinned to a strict list, Vercel
    # preview deployments (https://<hash>-<project>.vercel.app) stay allowed.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)

class EmbeddableStaticFiles(StaticFiles):
    """Static file handler ensuring files are embeddable in iframes across origins."""

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Content-Disposition"] = "inline"
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
        # Explicitly remove X-Frame-Options so Chrome does not block iframe/embed rendering
        if "x-frame-options" in response.headers:
            del response.headers["x-frame-options"]
        response.headers["Content-Security-Policy"] = "frame-ancestors *"
        return response


# Serve locally-stored scans when OSS is not configured: the ingestion
# fallback persists files under LOCAL_STORAGE_DIR and stores the web-relative
# "/static/<key>" path in StudentPaper.scanned_image_url, which the frontend
# Diagnostic Studio viewer loads directly. On Railway, point LOCAL_STORAGE_DIR
# at a mounted volume so uploads survive redeploys.
_local_storage = Path(settings.local_storage_dir).resolve()
_local_storage.mkdir(parents=True, exist_ok=True)
app.mount("/static", EmbeddableStaticFiles(directory=str(_local_storage)), name="static")


@app.get("/health", tags=["infra"])
async def healthcheck() -> dict[str, str]:
    """Liveness probe used by ECS/container health checks."""
    return {"status": "healthy", "service": "scriptgrade-backend", "version": app.version}


@app.get(f"{settings.api_v1_prefix}/health", tags=["infra"])
async def healthcheck_v1() -> dict[str, str]:
    """Versioned alias so probes pinned to the /api/v1 prefix (e.g. frontend
    connectivity checks built on API_BASE_URL) also resolve — the canonical
    Railway healthcheckPath remains the root-level /health."""
    return {"status": "healthy", "service": "scriptgrade-backend", "version": app.version}


if __name__ == "__main__":
    # Direct-execution entry point for PaaS/container runtimes (Railway injects
    # PORT). Binds 0.0.0.0 so the platform router can reach it and falls back to
    # 8000 for local `python -m app.main` runs.
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
