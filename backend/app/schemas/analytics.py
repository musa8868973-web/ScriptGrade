"""Aggregated class-analytics contract for the single-subject Analytics view.

The Analytics page (Frontend PRD §"Analytics") needs chart-ready numbers that
are derived from every evaluated paper's 8-debugger JSONB plus the exam rubric.
Computing them server-side avoids shipping N raw diagnostic payloads to the
browser and keeps the "one subject / one session" framing explicit.
"""

from uuid import UUID

from pydantic import BaseModel, Field


class ConceptMasteryStat(BaseModel):
    """Per-question (rubric concept) mastery + class average."""

    concept: str
    awarded: float          # mean marks the class earned for this concept
    max: float              # the concept weight (full marks)
    mastery_pct: float      # % of scored papers that earned full marks


class DebuggerStat(BaseModel):
    """How often one debugger raised its signal across the class."""

    key: str
    label: str
    count: int              # papers where the signal fired
    total: int              # scored papers considered
    rate: float             # count / total * 100


class AnalyticsSummary(BaseModel):
    """Everything the Analytics charts render for one exam (endpoint #10)."""

    exam_id: UUID
    title: str
    total_papers: int
    scored_papers: int
    max_score: float
    class_average: float
    score_distribution: list[int] = Field(default_factory=list)  # 5 bands
    concept_mastery: list[ConceptMasteryStat] = Field(default_factory=list)
    debugger_breakdown: list[DebuggerStat] = Field(default_factory=list)
