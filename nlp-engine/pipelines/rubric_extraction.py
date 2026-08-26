"""Pipeline — Qwen-2.5 Auto-Rubric Extraction (PRD §4 Prompt A).

Transforms one Question Paper + Sample Reference Answer into a structured
rubric: weighted magic concepts + pre-generated synonym clusters. After
extraction the rubric is validated/normalized and its concept & synonym
embeddings are indexed in AnalyticDB pgvector for the downstream debuggers.

Quickstart (README §11.4):
    python -m pipelines.rubric_extraction --healthcheck
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from typing import Any

from config import EngineSettings, get_settings
from embeddings.pgvector_client import PGVectorEmbeddingClient, get_vector_store
from llm_client import DashScopeClientError, extract_json, get_dashscope_client
from prompts.contracts import build_rubric_extraction_messages
from schemas import Rubric, RubricConcept

logger = logging.getLogger(__name__)

_MIN_SYNONYMS = 3
_MAX_SYNONYMS = 5


class RubricExtractionError(RuntimeError):
    """Raised when Qwen-2.5 cannot produce a usable rubric payload."""


class RubricExtractionPipeline:
    """Prompt A dispatch, strict-JSON parsing, and AnalyticDB indexing."""

    def __init__(
        self,
        vector_store: PGVectorEmbeddingClient | None = None,
        settings: EngineSettings | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.vector_store = vector_store or get_vector_store()

    # ------------------------------------------------------------------ #
    # Prompt A dispatch & validation                                      #
    # ------------------------------------------------------------------ #
    async def extract(
        self,
        question_paper: str,
        sample_answer: str,
        total_marks: float,
        ordered_concepts: list[str] | None = None,
        diagram_labels: list[str] | None = None,
    ) -> Rubric:
        """Run Prompt A against Qwen-2.5 and return a validated Rubric."""
        client = get_dashscope_client()
        messages = build_rubric_extraction_messages(
            question_paper, sample_answer, total_marks
        )
        try:
            raw = await client.chat(messages, max_tokens=2048)
        except DashScopeClientError as exc:
            raise RubricExtractionError(
                f"Qwen-2.5 rubric extraction call failed: {exc}"
            ) from exc

        try:
            payload = extract_json(raw)
        except ValueError as exc:
            raise RubricExtractionError(str(exc)) from exc
        if not isinstance(payload, dict):
            raise RubricExtractionError(
                f"Expected JSON object from Prompt A, got {type(payload).__name__}"
            )
        return self._normalize_payload(
            payload, total_marks, ordered_concepts, diagram_labels
        )

    def _normalize_payload(
        self,
        payload: dict[str, Any],
        total_marks: float,
        ordered_concepts: list[str] | None,
        diagram_labels: list[str] | None,
    ) -> Rubric:
        """Coerce raw Prompt A output into a validated, weight-balanced Rubric."""
        raw_concepts = payload.get("concepts", [])
        if not isinstance(raw_concepts, list) or not raw_concepts:
            raise RubricExtractionError("Prompt A returned no concepts")

        concepts: list[RubricConcept] = []
        for entry in raw_concepts:
            if not isinstance(entry, dict):
                continue
            keyword = str(entry.get("keyword", "")).strip()
            weight = float(entry.get("weight", 0) or 0)
            if keyword and weight > 0:
                concepts.append(RubricConcept(keyword=keyword, weight=weight))
        if not concepts:
            raise RubricExtractionError("Prompt A returned no valid concept entries")

        # Rescale weights so they sum exactly to the question's total marks.
        weight_sum = sum(concept.weight for concept in concepts)
        if weight_sum > 0 and abs(weight_sum - total_marks) > 1e-6:
            scale = total_marks / weight_sum
            for concept in concepts:
                concept.weight = round(concept.weight * scale, 2)
            drift = round(total_marks - sum(concept.weight for concept in concepts), 2)
            concepts[-1].weight = round(concepts[-1].weight + drift, 2)

        raw_synonyms = payload.get("synonyms", {})
        synonyms: dict[str, list[str]] = {}
        if isinstance(raw_synonyms, dict):
            for concept in concepts:
                cluster = raw_synonyms.get(concept.keyword, [])
                cleaned: list[str] = []
                if isinstance(cluster, list):
                    for phrase in cluster:
                        text = str(phrase).strip()
                        if text and text not in cleaned:
                            cleaned.append(text)
                synonyms[concept.keyword] = cleaned[:_MAX_SYNONYMS]

        missing_clusters = [
            concept.keyword
            for concept in concepts
            if len(synonyms.get(concept.keyword, [])) < _MIN_SYNONYMS
        ]
        if missing_clusters:
            logger.warning(
                "Prompt A produced < %d synonyms for: %s",
                _MIN_SYNONYMS,
                ", ".join(missing_clusters),
            )

        ordered = ordered_concepts or [concept.keyword for concept in concepts]
        return Rubric(
            concepts=concepts,
            synonyms=synonyms,
            total_marks=total_marks,
            ordered_concepts=ordered,
            diagram_labels=diagram_labels or [],
        )

    # ------------------------------------------------------------------ #
    # AnalyticDB pgvector indexing (concept + synonym cluster embeddings)   #
    # ------------------------------------------------------------------ #
    async def index_rubric(self, exam_id: str, rubric: Rubric) -> int:
        """Embed & upsert concept vectors + pre-generated synonym clusters."""
        concept_items = [
            {
                "key": concept.keyword,
                "text": concept.keyword,
                "metadata": {"concept": concept.keyword, "weight": concept.weight},
            }
            for concept in rubric.concepts
        ]
        await self.vector_store.upsert(f"concepts:{exam_id}", concept_items)

        synonym_items: list[dict[str, Any]] = []
        for concept in rubric.concepts:
            for synonym in rubric.synonyms.get(concept.keyword, []):
                synonym_items.append(
                    {
                        "key": f"{concept.keyword}::{synonym}",
                        "text": synonym,
                        "metadata": {"concept": concept.keyword, "synonym": synonym},
                    }
                )
        await self.vector_store.upsert(f"synonym_clusters:{exam_id}", synonym_items)
        total = len(concept_items) + len(synonym_items)
        logger.info(
            "Indexed %d vectors for exam '%s' (%d concepts, %d synonyms)",
            total,
            exam_id,
            len(concept_items),
            len(synonym_items),
        )
        return total

    async def healthcheck(self) -> bool:
        """Verify Qwen-2.5 connectivity (README quickstart probe)."""
        return await get_dashscope_client().healthcheck()


# ---------------------------------------------------------------------- #
# CLI entry point — `python -m pipelines.rubric_extraction --healthcheck`  #
# ---------------------------------------------------------------------- #
async def _run_cli(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pipelines.rubric_extraction",
        description="ScriptGrade Qwen-2.5 auto-rubric extraction pipeline",
    )
    parser.add_argument(
        "--healthcheck",
        action="store_true",
        help="Ping DashScope and report Qwen-2.5 connectivity",
    )
    parser.add_argument("--question", help="Question paper text (demo extraction)")
    parser.add_argument("--answer", help="Sample reference answer (demo extraction)")
    parser.add_argument("--marks", type=float, default=10.0, help="Total marks")
    parser.add_argument("--exam-id", default="exam-demo", help="Exam identifier")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    pipeline = RubricExtractionPipeline()

    if args.healthcheck:
        healthy = await pipeline.healthcheck()
        print("DashScope Qwen connectivity:", "OK" if healthy else "FAILED")
        return 0 if healthy else 1

    if args.question and args.answer:
        rubric = await pipeline.extract(args.question, args.answer, args.marks)
        await pipeline.index_rubric(args.exam_id, rubric)
        print(json.dumps(rubric.model_dump(), indent=2, ensure_ascii=False))
        return 0

    parser.print_help()
    return 0


def main() -> None:
    sys.exit(asyncio.run(_run_cli()))


if __name__ == "__main__":
    main()
