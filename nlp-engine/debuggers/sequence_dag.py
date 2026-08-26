"""Debugger V — Sequence & Procedural DAG Verifier.

PRD §3.V: enforces strict step-by-step chronological order for procedural
processes when the ``strict_order`` toggle is enabled.

Logic: constructs a Directed Acyclic Graph with NetworkX where each rubric
concept is a node and reference transitions are edges
(``c1 -> c2 -> ... -> cn``). The student's first-occurrence positions of the
matched concepts produce the detected order; every consecutive detected
transition must be a forward path in the reference DAG. Concepts violating
the topological order are listed for the aggregator to suppress.

Position search is Unicode-aware: transcripts and concept surfaces pass
through ``normalize_for_matching`` so Urdu, Sindhi, and Punjabi answers are
ordered correctly.
"""

from __future__ import annotations

import logging
import re

import networkx as nx

from language_support import normalize_for_matching
from schemas import Rubric, SequenceResult

logger = logging.getLogger(__name__)


def _escape_phrase(phrase: str) -> str:
    return re.escape(normalize_for_matching(phrase))


class SequenceDAGVerifier:
    """NetworkX DAG validator for procedural answer ordering."""

    def build_dag(self, ordered_concepts: list[str]) -> nx.DiGraph:
        """Construct the reference procedural DAG (linear concept chain)."""
        dag = nx.DiGraph()
        dag.add_nodes_from(ordered_concepts)
        for predecessor, successor in zip(ordered_concepts, ordered_concepts[1:]):
            dag.add_edge(predecessor, successor)
        if not nx.is_directed_acyclic_graph(dag):  # defensive invariant
            raise ValueError("Reference concept order contains a cycle")
        return dag

    def _first_positions(
        self,
        transcript_normalized: str,
        concepts: list[str],
        surfaces: dict[str, str],
    ) -> dict[str, int]:
        """First-occurrence index per concept (matched surface or keyword)."""
        positions: dict[str, int] = {}
        for concept in concepts:
            candidates = [surfaces.get(concept) or concept, concept]
            best_position: int | None = None
            for candidate in candidates:
                match = re.search(
                    rf"(?<![\w]){_escape_phrase(candidate)}(?![\w])",
                    transcript_normalized,
                )
                if match:
                    position = match.start()
                    if best_position is None or position < best_position:
                        best_position = position
            if best_position is not None:
                positions[concept] = best_position
        return positions

    async def verify(
        self,
        transcript: str,
        rubric: Rubric,
        matched_concepts: dict[str, str | None],
        strict_order: bool,
    ) -> SequenceResult:
        """Validate concept transition order against the reference DAG.

        ``matched_concepts`` maps concept keyword -> matched surface text
        (keyword itself, a synonym phrase, or the fuzzy-corrected form).
        """
        expected_order = (
            rubric.ordered_concepts
            if rubric.ordered_concepts
            else [concept.keyword for concept in rubric.concepts]
        )
        matched = [concept for concept in expected_order if concept in matched_concepts]

        if len(matched) < 2:
            return SequenceResult(
                sequence_match=True,
                expected_order=expected_order,
                detected_order=matched,
                dag_transitions_valid=True,
                detail=(
                    "Fewer than two matched concepts — procedural ordering is "
                    "vacuously satisfied."
                ),
            )

        dag = self.build_dag(expected_order)
        normalized = normalize_for_matching(transcript)
        surfaces = {
            concept: surface for concept, surface in matched_concepts.items() if surface
        }
        positions = self._first_positions(normalized, matched, surfaces)
        detected_order = sorted(positions, key=lambda concept: positions[concept])

        # A detected transition (u -> v) is valid iff the reference DAG admits
        # a forward path from u to v (u precedes v procedurally).
        transitions_valid = all(
            nx.has_path(dag, current, nxt)
            for current, nxt in zip(detected_order, detected_order[1:])
        )

        penalized: list[str] = []
        if not transitions_valid:
            expected_rank = {concept: idx for idx, concept in enumerate(expected_order)}
            for concept in detected_order:
                for earlier_expected in expected_order:
                    if expected_rank[earlier_expected] >= expected_rank[concept]:
                        continue
                    # An expected-predecessor concept appearing later in the
                    # student's text means `concept` was written out of order.
                    if (
                        earlier_expected in positions
                        and positions[earlier_expected] > positions[concept]
                    ):
                        penalized.append(concept)
                        break

        sequence_match = transitions_valid
        if transitions_valid:
            detail = (
                f"All {len(detected_order)} procedural concept transitions "
                "validated against reference DAG. "
                f"Strict order toggle: {'ENABLED' if strict_order else 'DISABLED'}."
            )
        else:
            detail = (
                f"Out-of-order transitions detected in DAG validation "
                f"(strict order toggle: {'ENABLED' if strict_order else 'DISABLED'}). "
                f"Concepts violating topological order: {', '.join(penalized) or 'n/a'}."
            )

        return SequenceResult(
            sequence_match=sequence_match,
            expected_order=expected_order,
            detected_order=detected_order,
            dag_transitions_valid=transitions_valid,
            penalized_concepts=penalized if strict_order else [],
            detail=detail,
        )
