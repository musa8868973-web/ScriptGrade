"""Debugger III — Synonym & Semantic Matcher.

PRD §3.III: rewards students who use alternative technical terminology or
equivalent phrasing (e.g. "solar energy" for "Sunlight").

Logic: the pre-generated Synonym Clusters (produced by Prompt A and indexed
during rubric extraction) live in the AnalyticDB rubrics JSON surface and are
queried via pgvector:

1. **Lexical pass** — normalized phrase containment of each synonym cluster
   member against the student transcript (zero-cost, deterministic).
2. **Semantic pass** — for still-unresolved concepts, sentence embeddings of
   the transcript are scored against the stored synonym cluster embeddings
   using cosine similarity (``<=>``); hits at or above the configured floor
   resolve the concept.

Cross-lingual: for Urdu/Sindhi/Punjabi scripts the transcript sentences stay
in their ORIGINAL script while the synonym cluster vectors remain English;
Alibaba Cloud's multilingual embeddings align the two spaces inside
AnalyticDB pgvector, and the similarity floor is relaxed by
``settings.cross_lingual_threshold_offset``.
"""

from __future__ import annotations

import logging
import re

from config import EngineSettings, get_settings
from embeddings.pgvector_client import PGVectorEmbeddingClient, cosine_similarity
from language_support import SENTENCE_SPLIT_RE, is_cross_lingual, normalize_for_matching
from llm_client import DashScopeClientError
from schemas import Rubric, SynonymMatchResult

logger = logging.getLogger(__name__)


def normalize_text(text: str) -> str:
    """Canonical phrase-matching surface shared across all scripts."""
    return normalize_for_matching(text)


def synonym_namespace(exam_id: str) -> str:
    """pgvector namespace holding this exam's pre-generated synonym clusters."""
    return f"synonym_clusters:{exam_id}"


class SynonymMatcher:
    """Resolves rubric concepts through synonym clusters via pgvector."""

    def __init__(
        self,
        vector_store: PGVectorEmbeddingClient,
        settings: EngineSettings | None = None,
    ) -> None:
        self.vector_store = vector_store
        self.settings = settings or get_settings()
        self.threshold = self.settings.synonym_similarity_threshold

    def threshold_for(self, language: str) -> float:
        """Similarity floor — relaxed when matching regional scripts against
        English synonym cluster vectors."""
        if is_cross_lingual(language):
            return max(
                self.threshold - self.settings.cross_lingual_threshold_offset, 0.60
            )
        return self.threshold

    # ------------------------------------------------------------------ #
    # Lexical pass                                                        #
    # ------------------------------------------------------------------ #
    def _lexical_matches(
        self,
        normalized_transcript: str,
        rubric: Rubric,
        unresolved: list[str],
    ) -> dict[str, dict]:
        matches: dict[str, dict] = {}
        for concept in unresolved:
            for synonym in rubric.synonyms.get(concept, []):
                phrase = normalize_text(synonym)
                if phrase and re.search(
                    rf"(?<![\w]){re.escape(phrase)}(?![\w])",
                    normalized_transcript,
                ):
                    matches[concept] = {
                        "student_token": synonym,
                        "rubric_concept": concept,
                        "similarity_score": 1.0,
                        "match_channel": "lexical",
                    }
                    break
        return matches

    # ------------------------------------------------------------------ #
    # Semantic pass — pgvector cosine similarity                          #
    # ------------------------------------------------------------------ #
    async def _semantic_matches(
        self,
        transcript: str,
        rubric: Rubric,
        unresolved: list[str],
        exam_id: str,
        already_matched: dict[str, dict],
        language: str,
    ) -> dict[str, dict]:
        matches: dict[str, dict] = {}
        remaining = [c for c in unresolved if c not in already_matched]
        if not remaining:
            return matches

        threshold = self.threshold_for(language)
        sentences = [
            sentence.strip()
            for sentence in SENTENCE_SPLIT_RE.split(transcript)
            if len(sentence.strip().split()) >= 3
        ]
        if not sentences:
            sentences = [transcript.strip()] if transcript.strip() else []
        if not sentences:
            return matches

        try:
            sentence_vectors = await self.vector_store.embed_texts(sentences)
        except DashScopeClientError as exc:
            logger.warning("Embedding unavailable for Debugger III: %s", exc)
            return matches

        namespace = synonym_namespace(exam_id)
        for concept in remaining:
            best_score = 0.0
            best_phrase: str | None = None
            for sentence_vector in sentence_vectors:
                hits = await self.vector_store.query_vector(
                    namespace,
                    sentence_vector,
                    top_k=1,
                    key_prefix=f"{concept}::",
                    min_score=threshold,
                )
                if hits and hits[0].score > best_score:
                    best_score = hits[0].score
                    best_phrase = hits[0].content
            if best_phrase is None:
                # Cluster not indexed in AnalyticDB yet — ad-hoc embed fallback.
                best_score, best_phrase = await self._adhoc_cluster_match(
                    concept, rubric, sentence_vectors, threshold
                )
            if best_phrase is not None:
                matches[concept] = {
                    "student_token": best_phrase,
                    "rubric_concept": concept,
                    "similarity_score": round(best_score, 2),
                    "match_channel": (
                        "pgvector+cross-lingual"
                        if is_cross_lingual(language)
                        else "pgvector"
                    ),
                }
        return matches

    async def _adhoc_cluster_match(
        self,
        concept: str,
        rubric: Rubric,
        sentence_vectors: list[list[float]],
        threshold: float,
    ) -> tuple[float, str | None]:
        synonyms = rubric.synonyms.get(concept, [])
        if not synonyms:
            return 0.0, None
        try:
            cluster_vectors = await self.vector_store.embed_texts(synonyms)
        except DashScopeClientError as exc:
            logger.warning("Ad-hoc synonym embedding failed for %s: %s", concept, exc)
            return 0.0, None
        best_score = 0.0
        best_phrase: str | None = None
        for sentence_vector in sentence_vectors:
            for synonym, cluster_vector in zip(synonyms, cluster_vectors):
                score = cosine_similarity(sentence_vector, cluster_vector)
                if score > best_score:
                    best_score = score
                    best_phrase = synonym
        if best_score >= threshold:
            return best_score, best_phrase
        return 0.0, None

    # ------------------------------------------------------------------ #
    # Public API                                                          #
    # ------------------------------------------------------------------ #
    async def match(
        self,
        transcript: str,
        rubric: Rubric,
        exam_id: str,
        unresolved_concepts: list[str],
        language: str = "en",
    ) -> SynonymMatchResult:
        """Resolve still-unmatched concepts via synonym clusters.

        ``language`` identifies the transcript script; for ``ur``/``sd``/``pa``
        the semantic pass performs cross-lingual matching of original-script
        sentences against the English synonym cluster vectors with a relaxed
        similarity floor.
        """
        if not unresolved_concepts:
            return SynonymMatchResult(
                synonym_matched=False,
                matched_pairs=[],
                detail="All rubric concepts already resolved by exact matching.",
            )

        normalized = normalize_text(transcript)
        lexical = self._lexical_matches(normalized, rubric, unresolved_concepts)
        semantic = await self._semantic_matches(
            transcript, rubric, unresolved_concepts, exam_id, lexical, language
        )

        merged: list[dict] = []
        for concept in unresolved_concepts:
            if concept in lexical:
                merged.append(lexical[concept])
            elif concept in semantic:
                merged.append(semantic[concept])

        matched = len(merged) > 0
        channels = {pair["match_channel"] for pair in merged}
        cross_note = (
            f" Cross-lingual matching ({language} → en)."
            if is_cross_lingual(language)
            else ""
        )
        detail = (
            f"{len(merged)} synonym cluster(s) resolved "
            f"(channels: {', '.join(sorted(channels))}).{cross_note}"
            if matched
            else "No synonym or equivalent phrasing resolved for unresolved concepts."
            + cross_note
        )
        return SynonymMatchResult(
            synonym_matched=matched,
            matched_pairs=[
                {
                    "student_token": pair["student_token"],
                    "rubric_concept": pair["rubric_concept"],
                    "similarity_score": pair["similarity_score"],
                }
                for pair in merged
            ],
            detail=detail,
        )
