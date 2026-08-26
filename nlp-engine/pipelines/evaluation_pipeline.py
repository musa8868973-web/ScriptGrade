"""Pipeline — Main Evaluation Orchestrator (PRD §2 & §3).

Executes the complete 8 Vulnerability Edge-Case Debuggers suite over a
student's answer (Qwen-VL OCR transcript or supplied text) and emits the
STRICT evaluation JSON contract consumed by the FastAPI gateway
(``GET /api/v1/papers/{student_id}``) and the Master Grading Workspace:

    {
      "student_id": "STU-102",
      "score": 10.0,
      "max_score": 10.0,
      "ocr_confidence": 96.5,
      "diagnostics": {
        "garbage_text_score": 0.0,
        "negation_detected": false,
        "synonym_matched": true,
        "spelling_autocorrected": true,
        "sequence_match": true,
        "diagram_verified": true,
        "density_ratio": 88.5,
        "rubric_breakdown": [ { "concept": ..., "awarded": ..., "max": ... } ]
      }
    }

Execution order: Qwen-VL OCR (if images only) → IV fuzzy correction →
exact match → III synonym matcher → II negation engine → V sequence DAG →
I garbage text → VII density scorer → VI visual inspector → VIII aggregator.
Prompt B runs as an optional advisory LLM cross-check.

Regional languages: the transcript script is auto-detected (Urdu ``ur``,
Sindhi ``sd``, Punjabi ``pa``, English ``en``; overridable via
``EvaluationRequest.language``). Student text is ALWAYS preserved in its
ORIGINAL script; embedding-based debuggers (I, III) perform cross-lingual
matching of original-script sentences against the English rubric vectors in
AnalyticDB pgvector via Alibaba Cloud's multilingual embeddings.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from config import EngineSettings, get_settings
from debuggers.density_scorer import DensityScorer
from debuggers.fuzzy_spelling import FuzzySpellingCorrector
from debuggers.garbage_text import GarbageTextDetector
from debuggers.negation_detector import NegationDetector
from debuggers.rubric_aggregator import RubricAggregator
from debuggers.sequence_dag import SequenceDAGVerifier
from debuggers.synonym_matcher import SynonymMatcher
from debuggers.visual_inspector import VisualInspector
from embeddings.pgvector_client import PGVectorEmbeddingClient, get_vector_store
from language_support import detect_language, is_cross_lingual, normalize_for_matching
from llm_client import DashScopeClientError, extract_json, get_dashscope_client
from pipelines.vision_ocr import VisionOCRPipeline
from prompts.contracts import build_evaluation_messages
from schemas import (
    ConceptMatch,
    Diagnostics,
    EvaluationRequest,
    EvaluationResult,
    FuzzyCorrectionResult,
    Rubric,
)

logger = logging.getLogger(__name__)


class EvaluationPipeline:
    """Orchestrates all 8 debuggers into the final evaluation payload."""

    def __init__(
        self,
        vector_store: PGVectorEmbeddingClient | None = None,
        settings: EngineSettings | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.vector_store = vector_store or get_vector_store()
        self.ocr_pipeline = VisionOCRPipeline()
        self.fuzzy_corrector = FuzzySpellingCorrector(self.settings)
        self.synonym_matcher = SynonymMatcher(self.vector_store, self.settings)
        self.negation_detector = NegationDetector()
        self.sequence_verifier = SequenceDAGVerifier()
        self.garbage_detector = GarbageTextDetector(self.settings)
        self.density_scorer = DensityScorer(self.settings)
        self.visual_inspector = VisualInspector(self.settings)
        self.aggregator = RubricAggregator()

    # ------------------------------------------------------------------ #
    # Step 0 — transcript resolution (Qwen-VL OCR when images-only)       #
    # ------------------------------------------------------------------ #
    async def _resolve_transcript(
        self, request: EvaluationRequest
    ) -> tuple[str, float]:
        if request.ocr_transcript and request.ocr_transcript.strip():
            confidence = (
                request.ocr_confidence if request.ocr_confidence is not None else 100.0
            )
            return request.ocr_transcript.strip(), confidence
        if request.image_paths:
            ocr_result = await self.ocr_pipeline.transcribe(request.image_paths)
            return ocr_result.transcript, ocr_result.confidence
        raise ValueError(
            "EvaluationRequest must carry either an ocr_transcript or image_paths"
        )

    # ------------------------------------------------------------------ #
    # Exact keyword matching (baseline before synonym/fuzzy resolution)    #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _resolve_language(request: EvaluationRequest, transcript: str) -> str:
        """Honor an explicit override, otherwise detect from script."""
        return request.language or detect_language(transcript)

    @staticmethod
    def _exact_matches(
        normalized_text: str, rubric: Rubric
    ) -> dict[str, ConceptMatch]:
        """Baseline containment match over the canonical comparison surface.

        Works identically for Latin, Nastaliq (ur/sd/Shahmukhi), and
        Gurmukhi (pa) because both sides are folded through
        ``normalize_for_matching`` (glyph variants, punctuation, case).
        """
        matches: dict[str, ConceptMatch] = {}
        for concept in rubric.concepts:
            keyword_norm = normalize_for_matching(concept.keyword)
            if keyword_norm and re.search(
                rf"(?<![\w]){re.escape(keyword_norm)}(?![\w])", normalized_text
            ):
                matches[concept.keyword] = ConceptMatch(
                    concept=concept.keyword,
                    matched=True,
                    match_type="exact",
                    matched_surface=concept.keyword,
                    similarity=1.0,
                )
            else:
                matches[concept.keyword] = ConceptMatch(concept=concept.keyword)
        return matches

    # ------------------------------------------------------------------ #
    # Advisory Prompt B cross-check (never alters the deterministic score) #
    # ------------------------------------------------------------------ #
    async def _llm_cross_check(
        self,
        request: EvaluationRequest,
        transcript: str,
        ocr_confidence: float,
        deterministic: EvaluationResult,
    ) -> None:
        concepts_json = [
            {"keyword": concept.keyword, "weight": concept.weight}
            for concept in request.rubric.concepts
        ]
        messages = build_evaluation_messages(
            ocr_transcript=transcript,
            concepts_json=concepts_json,
            toggles_string=request.toggles.to_prompt_string(),
            student_id=request.student_id,
            ocr_confidence=ocr_confidence,
        )
        try:
            raw = await get_dashscope_client().chat(messages, max_tokens=2048)
            payload = extract_json(raw)
        except (DashScopeClientError, ValueError) as exc:
            logger.warning("Prompt B advisory cross-check unavailable: %s", exc)
            return
        llm_score = payload.get("score") if isinstance(payload, dict) else None
        logger.info(
            "Prompt B cross-check: LLM score=%s vs deterministic score=%s",
            llm_score,
            deterministic.score,
        )

    # ------------------------------------------------------------------ #
    # Full 8-debugger orchestration                                        #
    # ------------------------------------------------------------------ #
    async def evaluate(self, request: EvaluationRequest) -> dict[str, Any]:
        """Run every debugger and return the STRICT evaluation JSON dict."""
        rubric = request.rubric
        toggles = request.toggles

        transcript, ocr_confidence = await self._resolve_transcript(request)

        # Regional language handling — detect the transcript script (or honor
        # the request override). The transcript stays in its ORIGINAL script
        # end-to-end; only the comparison surfaces are glyph-folded.
        language = self._resolve_language(request, transcript)
        cross_lingual = is_cross_lingual(language)
        if cross_lingual:
            logger.info(
                "Regional script detected (%s) — cross-lingual matching into "
                "English concept vectors enabled; original script preserved.",
                language,
            )

        # Debugger IV — fuzzy spelling auto-correction (ignore_spelling toggle).
        if toggles.ignore_spelling:
            fuzzy_result: FuzzyCorrectionResult = self.fuzzy_corrector.correct(
                transcript, rubric
            )
        else:
            fuzzy_result = FuzzyCorrectionResult(corrected_text=transcript)
        working_text = fuzzy_result.corrected_text

        # Baseline exact keyword resolution on the corrected transcript.
        matches = self._exact_matches(normalize_for_matching(working_text), rubric)

        # Debugger III — synonym & semantic matcher for unresolved concepts.
        # Cross-lingual: original-script sentences are matched against the
        # English synonym cluster vectors inside AnalyticDB pgvector.
        unresolved = [
            keyword for keyword, match in matches.items() if not match.matched
        ]
        synonym_result = await self.synonym_matcher.match(
            working_text, rubric, request.exam_id, unresolved, language=language
        )
        for pair in synonym_result.matched_pairs:
            concept_key = pair["rubric_concept"]
            if concept_key in matches:
                matches[concept_key] = ConceptMatch(
                    concept=concept_key,
                    matched=True,
                    match_type="synonym",
                    matched_surface=pair["student_token"],
                    similarity=pair["similarity_score"],
                )

        # Debugger II — negation & reversal modifiers.
        negation_result = await self.negation_detector.detect(working_text, rubric)
        negated_concepts: set[str] = set()
        for flagged in negation_result.flagged_tokens:
            concept_key = flagged["concept"]
            negated_concepts.add(concept_key)
            if concept_key in matches:
                matches[concept_key].negated = True

        # Debugger V — sequence & procedural DAG verification.
        matched_surfaces = {
            keyword: match.matched_surface
            for keyword, match in matches.items()
            if match.matched
        }
        sequence_result = await self.sequence_verifier.verify(
            working_text, rubric, matched_surfaces, toggles.strict_order
        )

        # Debugger I — garbage text & hallucination detection.
        garbage_result = await self.garbage_detector.analyze(
            working_text, rubric, language=language
        )

        # Debugger VII — anti-fluff information density.
        density_result = self.density_scorer.score(
            working_text,
            [surface for surface in matched_surfaces.values() if surface],
            toggles.density_scoring,
        )

        # Debugger VI — Qwen-VL diagram & visual inspection.
        visual_result = await self.visual_inspector.inspect(
            request.image_paths, rubric.diagram_labels
        )

        # Debugger VIII — itemized rubric score aggregation.
        aggregation = self.aggregator.aggregate(
            rubric,
            matches,
            negated_concepts=negated_concepts,
            sequence_penalized_concepts=set(sequence_result.penalized_concepts),
            max_score=rubric.total_marks,
        )

        result = EvaluationResult(
            student_id=request.student_id,
            score=aggregation.total_awarded,
            max_score=aggregation.max_possible,
            ocr_confidence=ocr_confidence,
            diagnostics=Diagnostics(
                garbage_text_score=garbage_result.garbage_text_score,
                negation_detected=negation_result.negation_detected,
                synonym_matched=synonym_result.synonym_matched,
                spelling_autocorrected=fuzzy_result.spelling_autocorrected,
                sequence_match=sequence_result.sequence_match,
                diagram_verified=visual_result.diagram_verified,
                density_ratio=density_result.density_ratio,
                rubric_breakdown=aggregation.rubric_breakdown,
            ),
        )

        if request.llm_cross_check:
            await self._llm_cross_check(request, working_text, ocr_confidence, result)

        logger.info(
            "Evaluated %s [%s]: score=%.2f/%.2f | garbage=%.2f negation=%s "
            "synonyms=%s spelling=%s sequence=%s diagram=%s density=%.1f%%",
            request.student_id,
            language,
            result.score,
            result.max_score,
            garbage_result.garbage_text_score,
            negation_result.negation_detected,
            synonym_result.synonym_matched,
            fuzzy_result.spelling_autocorrected,
            sequence_result.sequence_match,
            visual_result.diagram_verified,
            density_result.density_ratio,
        )
        logger.debug("Debugger details — I: %s | II: %s | III: %s | IV: %s | V: %s | VI: %s | VII: %s | VIII: %s",
                     garbage_result.detail, negation_result.detail, synonym_result.detail,
                     fuzzy_result.detail, sequence_result.detail, visual_result.detail,
                     density_result.detail, aggregation.detail)
        return result.model_dump()


# ---------------------------------------------------------------------- #
# Demo harness — photosynthesis rubric from PRD §4 (run module directly)   #
# ---------------------------------------------------------------------- #
def _demo_request() -> EvaluationRequest:
    from schemas import RubricConcept, SensitivityToggles

    rubric = Rubric(
        concepts=[
            RubricConcept(keyword="Sunlight", weight=3),
            RubricConcept(keyword="Chlorophyll", weight=3),
            RubricConcept(keyword="Glucose", weight=2),
            RubricConcept(keyword="CO2", weight=1),
            RubricConcept(keyword="Oxygen", weight=1),
        ],
        synonyms={
            "Sunlight": ["solar energy", "light radiation", "sun radiation"],
            "Chlorophyll": ["green pigment", "photosynthetic pigment", "leaf pigment"],
            "Glucose": ["sugar", "simple sugar", "C6H12O6"],
            "CO2": ["carbon dioxide", "carbonic acid gas"],
            "Oxygen": ["O2", "oxygen gas"],
        },
        total_marks=10,
        ordered_concepts=["Sunlight", "Chlorophyll", "CO2", "Glucose", "Oxygen"],
        diagram_labels=[],
    )
    transcript = (
        "Photosinthesis is the process where green plants use solar energy "
        "absorbed by the green pigment to convert carbon dioxide and water "
        "into glucos and release oxygen."
    )
    return EvaluationRequest(
        student_id="STU-102",
        exam_id="exam-demo-photosynthesis",
        rubric=rubric,
        toggles=SensitivityToggles(
            ignore_spelling=True, strict_order=True, density_scoring=True
        ),
        ocr_transcript=transcript,
        ocr_confidence=96.5,
    )


async def _run_demo() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    pipeline = EvaluationPipeline()
    payload = await pipeline.evaluate(_demo_request())
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def main() -> None:
    asyncio.run(_run_demo())


if __name__ == "__main__":
    main()
