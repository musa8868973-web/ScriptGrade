"""Student paper evaluation, batch upload and override contracts (#6, #7, #8)."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class BatchUploadResponse(BaseModel):
    """202 acknowledgement for asynchronous batch ingestion (endpoint #6)."""

    batch_id: UUID
    total_papers: int
    status: str = "processing"


class RubricBreakdownItem(BaseModel):
    concept: str
    awarded: float
    max: float
    match_type: Literal["exact", "synonym", "fuzzy", "none"]


class DiagnosticMatchedPair(BaseModel):
    student_token: str
    rubric_concept: str
    similarity_score: float


class DiagnosticSpellingCorrection(BaseModel):
    original: str
    corrected: str
    levenshtein_score: float


class DiagnosticVisualElement(BaseModel):
    label: str
    bounding_box: list[int] = Field(default_factory=list)
    confidence: float = 0.0


class PaperDetailResponse(BaseModel):
    """Complete evaluation breakdown + 8-debugger diagnostics (endpoint #7)."""

    student_id: str
    paper_id: UUID
    exam_id: UUID
    score: float | None
    max_score: float | None
    status: str
    ocr_confidence: float | None
    ocr_transcript: str | None
    word_count: int | None
    evaluated_at: datetime | None
    is_flagged: bool
    diagnostics: dict[str, Any] = Field(default_factory=dict)
    teacher_override: dict[str, Any] = Field(default_factory=dict)


class OverrideRequest(BaseModel):
    """Teacher manual score adjustment (endpoint #8)."""

    new_score: float = Field(ge=0)
    moderation_note: str | None = Field(default=None, max_length=2000)


class OverrideResponse(BaseModel):
    status: str = "override_applied"
    updated_score: float
