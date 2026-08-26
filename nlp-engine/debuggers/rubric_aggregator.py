"""Debugger VIII — Itemized Rubric Score Aggregator.

PRD §3.VIII / README Algorithm II: maps concept matches to teacher point
allocations and computes the final deterministic score:

    S_final = min( Σ w_k · m_k , S_max )

where ``m_k ∈ {0, 1}`` is the match indicator for concept ``k`` — ``1`` when
the concept was detected (exact, synonym, or fuzzy match) and NOT negated or
sequence-penalized. Produces the ``rubric_breakdown`` JSON array consumed by
the FastAPI gateway and the Master Grading Workspace.
"""

from __future__ import annotations

import logging

from schemas import (
    AggregationResult,
    ConceptMatch,
    Rubric,
    RubricBreakdownItem,
)

logger = logging.getLogger(__name__)


def _as_mark(value: float) -> float | int:
    """Render integral marks as ints for a clean JSON contract (3 vs 3.0)."""
    return int(value) if float(value).is_integer() else value


class RubricAggregator:
    """Weighted per-concept awarding with hard cap at the question's max marks."""

    def aggregate(
        self,
        rubric: Rubric,
        matches: dict[str, ConceptMatch],
        negated_concepts: set[str],
        sequence_penalized_concepts: set[str],
        max_score: float | None = None,
    ) -> AggregationResult:
        """Sum awarded points, cap at max marks, and build the breakdown."""
        ceiling = max_score if max_score is not None else rubric.total_marks
        breakdown: list[RubricBreakdownItem] = []
        total_awarded = 0.0

        for concept in rubric.concepts:
            match = matches.get(concept.keyword)
            suppressed_reason: str | None = None
            if match is None or not match.matched:
                suppressed_reason = "not detected"
            elif concept.keyword in negated_concepts:
                suppressed_reason = "negated"
            elif concept.keyword in sequence_penalized_concepts:
                suppressed_reason = "out-of-order (strict)"

            awarded = 0.0 if suppressed_reason else float(concept.weight)
            total_awarded += awarded
            breakdown.append(
                RubricBreakdownItem(
                    concept=concept.keyword,
                    awarded=_as_mark(awarded),
                    max=_as_mark(concept.weight),
                )
            )
            if suppressed_reason:
                logger.debug(
                    "Concept '%s' awarded 0 (%s)", concept.keyword, suppressed_reason
                )

        capped_total = min(total_awarded, ceiling)
        matched_count = sum(1 for item in breakdown if float(item.awarded) > 0)
        detail = f"{matched_count}/{len(breakdown)} rubric concepts awarded. " + (
            f"Sum exceeded the ceiling — final score capped at max_score = {ceiling}."
            if total_awarded > ceiling
            else f"Final score = {round(capped_total, 2)} (max_score = {ceiling})."
        )
        return AggregationResult(
            rubric_breakdown=breakdown,
            total_awarded=round(capped_total, 2),
            max_possible=ceiling,
            detail=detail,
        )
