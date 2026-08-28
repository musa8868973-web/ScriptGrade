"""Exam dashboard, setup and rubric contracts (endpoints #3, #4, #5)."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.exam import ExamStatus


class GlobalMetrics(BaseModel):
    """Cross-exam performance counters surfaced on the dashboard."""

    total_checked: int
    overall_accuracy: float
    hours_saved: float


class ExamListItem(BaseModel):
    exam_id: UUID
    title: str
    date: date
    class_size: int
    status: ExamStatus
    class_average: float | None
    created_at: datetime


class DashboardResponse(BaseModel):
    global_metrics: GlobalMetrics
    exams: list[ExamListItem]


class ConceptItem(BaseModel):
    """A single weighted magic keyword."""

    keyword: str = Field(min_length=1, max_length=120)
    weight: float = Field(gt=0, le=10)


class ExamSetupResponse(BaseModel):
    """Qwen-2.5 auto-extraction result (endpoint #4)."""

    exam_id: UUID
    extracted_concepts: list[ConceptItem]
    synonyms: dict[str, list[str]]


class RubricUpdateRequest(BaseModel):
    """Teacher-customised rubric save payload (endpoint #5)."""

    exam_id: UUID
    concepts: list[ConceptItem] = Field(min_length=1, max_length=50)
    ignore_spelling: bool = True
    strict_order: bool = False
    density_scoring: bool = True


class RubricUpdateResponse(BaseModel):
    status: str = "updated"
    rubric_id: UUID
