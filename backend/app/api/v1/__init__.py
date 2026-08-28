"""Aggregated v1 API router mounted at /api/v1 by `app.main`."""

from fastapi import APIRouter

from app.api.v1 import analytics, auth, exams, papers

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(exams.router, tags=["Exams"])
api_router.include_router(papers.router, tags=["Papers"])
api_router.include_router(analytics.router, tags=["Analytics"])
