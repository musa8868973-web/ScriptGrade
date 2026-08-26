"""ScriptGrade NLP Engine — Pydantic data contracts.

Defines every structured payload exchanged between the pipelines, the 8
Vulnerability Edge-Case Debuggers, and the backend FastAPI gateway, including
the STRICT evaluation JSON contract consumed by the Master Grading Workspace.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

MatchType = Literal["exact", "synonym", "fuzzy", "none"]


# ---------------------------------------------------------------------- #
# Rubric contracts (produced by Prompt A — Auto-Rubric Extraction)        #
# ---------------------------------------------------------------------- #
class RubricConcept(BaseModel):
    """A single weighted "magic concept" extracted from the sample answer."""

    keyword: str = Field(..., description="Canonical rubric keyword, e.g. 'Sunlight'")
    weight: float = Field(..., ge=0, description="Teacher-assigned point weight")


class Rubric(BaseModel):
    """Full rubric configuration for one exam question."""

    concepts: list[RubricConcept]
    synonyms: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Pre-generated synonym clusters keyed by concept keyword",
    )
    total_marks: float = Field(..., gt=0)
    ordered_concepts: list[str] | None = Field(
        default=None,
        description="Reference procedural sequence for the DAG verifier (Debugger V)",
    )
    diagram_labels: list[str] = Field(
        default_factory=list,
        description="Expected spatial labels for the Qwen-VL visual inspector (Debugger VI)",
    )

    @property
    def keywords(self) -> list[str]:
        return [concept.keyword for concept in self.concepts]

    def weight_of(self, keyword: str) -> float:
        for concept in self.concepts:
            if concept.keyword.lower() == keyword.lower():
                return concept.weight
        return 0.0


class SensitivityToggles(BaseModel):
    """Teacher-configurable sensitivity toggles (PRD §4 Prompt B input)."""

    ignore_spelling: bool = True
    strict_order: bool = False
    density_scoring: bool = True

    def to_prompt_string(self) -> str:
        return (
            "{ignore_spelling: " + str(self.ignore_spelling).lower()
            + ", strict_order: " + str(self.strict_order).lower()
            + ", density_scoring: " + str(self.density_scoring).lower() + "}"
        )


# ---------------------------------------------------------------------- #
# Vision contracts (Qwen-VL)                                              #
# ---------------------------------------------------------------------- #
class OCRResult(BaseModel):
    """Output of the Qwen-VL handwritten OCR transcription pass."""

    transcript: str
    confidence: float = Field(default=0.0, ge=0.0, le=100.0)
    page_count: int = 1


class VisualElement(BaseModel):
    """A single diagram element detected by the Qwen-VL visual inspector."""

    label: str
    element_type: Literal["label", "arrow", "shape", "diagram"] = "label"
    bounding_box: list[int] = Field(
        default_factory=list, description="[x1, y1, x2, y2] pixel coordinates"
    )
    confidence: float = Field(default=0.0, ge=0.0, le=100.0)


# ---------------------------------------------------------------------- #
# Debugger result contracts                                               #
# ---------------------------------------------------------------------- #
class ConceptMatch(BaseModel):
    """Resolution state of one rubric concept against the student answer."""

    concept: str
    matched: bool = False
    match_type: MatchType = "none"
    matched_surface: str | None = None
    similarity: float | None = None
    negated: bool = False


class GarbageTextResult(BaseModel):
    garbage_text_score: float = Field(
        default=0.0, description="Fraction of sentences below the relevance floor"
    )
    flagged: bool = False
    flagged_sentences: list[str] = Field(default_factory=list)
    detail: str = ""


class NegationResult(BaseModel):
    negation_detected: bool = False
    flagged_tokens: list[dict] = Field(default_factory=list)
    detail: str = ""


class SynonymMatchResult(BaseModel):
    synonym_matched: bool = False
    matched_pairs: list[dict] = Field(default_factory=list)
    detail: str = ""


class FuzzyCorrectionResult(BaseModel):
    corrected_text: str
    corrections: list[dict] = Field(default_factory=list)
    spelling_autocorrected: bool = False
    detail: str = ""


class SequenceResult(BaseModel):
    sequence_match: bool = True
    expected_order: list[str] = Field(default_factory=list)
    detected_order: list[str] = Field(default_factory=list)
    dag_transitions_valid: bool = True
    penalized_concepts: list[str] = Field(default_factory=list)
    detail: str = ""


class VisualInspectionResult(BaseModel):
    diagram_verified: bool = True
    visual_confidence: float | None = None
    detected_elements: list[VisualElement] = Field(default_factory=list)
    detail: str = ""


class DensityResult(BaseModel):
    density_ratio: float = 0.0
    valid_keyword_hits: int = 0
    total_word_count: int = 0
    flagged: bool = False
    detail: str = ""


class RubricBreakdownItem(BaseModel):
    """STRICT contract item — concept / awarded / max only.

    ``float | int`` lets Pydantic's smart union preserve integral marks as
    ints (``3``) exactly as shown in the PRD §4-B contract example.
    """

    concept: str
    awarded: float | int
    max: float | int


class AggregationResult(BaseModel):
    rubric_breakdown: list[RubricBreakdownItem] = Field(default_factory=list)
    total_awarded: float = 0.0
    max_possible: float = 0.0
    detail: str = ""


# ---------------------------------------------------------------------- #
# STRICT evaluation JSON contract (PRD §4-B & README §7)                  #
# ---------------------------------------------------------------------- #
class Diagnostics(BaseModel):
    """Flat diagnostic block — keys MUST match the backend response contract."""

    garbage_text_score: float = 0.0
    negation_detected: bool = False
    synonym_matched: bool = False
    spelling_autocorrected: bool = False
    sequence_match: bool = True
    diagram_verified: bool = True
    density_ratio: float = 0.0
    rubric_breakdown: list[RubricBreakdownItem] = Field(default_factory=list)


class EvaluationResult(BaseModel):
    """Final payload emitted by ``evaluation_pipeline.EvaluationPipeline``."""

    student_id: str
    score: float
    max_score: float
    ocr_confidence: float = 0.0
    diagnostics: Diagnostics


class EvaluationRequest(BaseModel):
    """Input contract for one full evaluation run."""

    student_id: str
    exam_id: str = "exam-default"
    rubric: Rubric
    toggles: SensitivityToggles = Field(default_factory=SensitivityToggles)
    language: str | None = Field(
        default=None,
        description=(
            "ISO-639-1 override ('en', 'ur', 'sd', 'pa'); auto-detected from "
            "the transcript script when omitted"
        ),
    )
    ocr_transcript: str | None = None
    ocr_confidence: float | None = None
    image_paths: list[str] = Field(
        default_factory=list,
        description="Local paths or URLs of scanned answer sheet images",
    )
    llm_cross_check: bool = Field(
        default=False,
        description="Also run Prompt B LLM review as an advisory cross-check",
    )
