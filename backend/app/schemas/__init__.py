"""Pydantic v2 request/response contracts for every /api/v1 endpoint."""

from app.schemas.auth import LoginRequest, SignupRequest, SignupResponse, TokenResponse
from app.schemas.exam import (
    ConceptItem,
    DashboardResponse,
    ExamListItem,
    ExamSetupResponse,
    GlobalMetrics,
    RubricUpdateRequest,
    RubricUpdateResponse,
)
from app.schemas.paper import (
    BatchUploadResponse,
    DiagnosticMatchedPair,
    DiagnosticSpellingCorrection,
    DiagnosticVisualElement,
    OverrideRequest,
    OverrideResponse,
    PaperDetailResponse,
    RubricBreakdownItem,
)

__all__ = [
    "BatchUploadResponse",
    "ConceptItem",
    "DashboardResponse",
    "DiagnosticMatchedPair",
    "DiagnosticSpellingCorrection",
    "DiagnosticVisualElement",
    "ExamListItem",
    "ExamSetupResponse",
    "GlobalMetrics",
    "LoginRequest",
    "OverrideRequest",
    "OverrideResponse",
    "PaperDetailResponse",
    "RubricBreakdownItem",
    "RubricUpdateRequest",
    "RubricUpdateResponse",
    "SignupRequest",
    "SignupResponse",
    "TokenResponse",
]
