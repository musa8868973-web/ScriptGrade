"""Debugger I — Garbage Text & Hallucination Detector.

PRD §3.I: detects filler text, non-sensical sentences, or copied prompt text
used to artificially pad answer length.

Logic: sentence-level Cosine Similarity between student answer vectors and
rubric concept vectors. Sentences whose best similarity against the concept
space falls below ``0.35`` are flagged as low contextual relevance, and the
overall ``garbage_text_score`` (fraction of flagged sentences) is emitted.

Cross-lingual: Urdu/Sindhi/Punjabi sentences stay in their original script
and are matched against the ENGLISH rubric concept vectors via the
multilingual Text-Embedding model, with the relevance floor relaxed by
``settings.cross_lingual_threshold_offset``.
"""

from __future__ import annotations

import logging

from config import EngineSettings, get_settings
from embeddings.pgvector_client import cosine_similarity
from language_support import SENTENCE_SPLIT_RE, is_cross_lingual
from llm_client import DashScopeClientError, get_dashscope_client
from schemas import GarbageTextResult, Rubric

logger = logging.getLogger(__name__)

_MIN_SENTENCE_WORDS = 3


def split_sentences(text: str) -> list[str]:
    """Split a transcript into sentence units (whitespace-trimmed, non-empty).

    Handles Latin terminators plus the Arabic full stop (۔), Arabic question
    mark (؟), Arabic semicolon (؛), and danda used by regional scripts.
    """
    parts = SENTENCE_SPLIT_RE.split(text.strip())
    sentences: list[str] = []
    for part in parts:
        cleaned = part.strip()
        if len(cleaned.split()) >= _MIN_SENTENCE_WORDS:
            sentences.append(cleaned)
    if not sentences and text.strip():
        sentences = [text.strip()]
    return sentences


class GarbageTextDetector:
    """Sentence-level cosine relevance screen against rubric concept vectors."""

    def __init__(self, settings: EngineSettings | None = None) -> None:
        self.settings = settings or get_settings()
        self.threshold = self.settings.garbage_similarity_threshold

    def threshold_for(self, language: str) -> float:
        """Relevance floor — relaxed for cross-lingual script matching."""
        if is_cross_lingual(language):
            return max(
                self.threshold - self.settings.cross_lingual_threshold_offset, 0.20
            )
        return self.threshold

    def _concept_reference_texts(self, rubric: Rubric) -> list[str]:
        """Build one embedding reference string per rubric concept."""
        references: list[str] = []
        for concept in rubric.concepts:
            synonyms = rubric.synonyms.get(concept.keyword, [])
            if synonyms:
                references.append(f"{concept.keyword}: {'; '.join(synonyms)}")
            else:
                references.append(concept.keyword)
        return references

    async def analyze(
        self, transcript: str, rubric: Rubric, language: str = "en"
    ) -> GarbageTextResult:
        """Return the garbage-text diagnostics for one student transcript.

        ``language`` tags the script of the transcript; for ``ur``/``sd``/
        ``pa`` the sentences are embedded in their ORIGINAL script and
        matched against the English concept vectors (cross-lingual pgvector
        matching), with a relaxed relevance floor.
        """
        threshold = self.threshold_for(language)
        sentences = split_sentences(transcript)
        if not sentences:
            return GarbageTextResult(
                garbage_text_score=1.0,
                flagged=True,
                detail="Empty transcript — no evaluable content present.",
            )

        references = self._concept_reference_texts(rubric)
        try:
            client = get_dashscope_client()
            vectors = await client.embed(sentences + references)
        except DashScopeClientError as exc:
            logger.warning("Embedding service unavailable for Debugger I: %s", exc)
            return GarbageTextResult(
                garbage_text_score=0.0,
                flagged=False,
                detail=(
                    "Embedding service unavailable — lexical fallback engaged, "
                    "no filler flagged."
                ),
            )

        sentence_vectors = vectors[: len(sentences)]
        concept_vectors = vectors[len(sentences):]

        flagged_sentences: list[str] = []
        for sentence, sentence_vector in zip(sentences, sentence_vectors):
            best_similarity = max(
                cosine_similarity(sentence_vector, concept_vector)
                for concept_vector in concept_vectors
            )
            if best_similarity < threshold:
                flagged_sentences.append(sentence)

        total = len(sentences)
        score = round(len(flagged_sentences) / total, 2) if total else 0.0
        flagged = len(flagged_sentences) > 0
        cross_note = (
            f" Cross-lingual matching ({language} → en) with relaxed floor."
            if is_cross_lingual(language)
            else ""
        )
        detail = (
            f"{len(flagged_sentences)}/{total} sentences fell below the "
            f"contextual relevance threshold of {threshold}.{cross_note} "
            + (
                "Filler or copied prompt text suspected."
                if flagged
                else "All sentences exceed the relevance floor — no filler detected."
            )
        )
        return GarbageTextResult(
            garbage_text_score=score,
            flagged=flagged,
            flagged_sentences=flagged_sentences,
            detail=detail,
        )
