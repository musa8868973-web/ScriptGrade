"""Debugger VII — Anti-Fluff Information Density Scorer.

PRD §3.VII / README Algorithm I: eliminates length bias by evaluating
factual presence over word count when ``density_scoring`` is active.

    Density Ratio (%) = (Valid Rubric Keyword Hits / Total Word Count) × 100

A hit is an occurrence of any resolved concept surface form (exact keyword,
matched synonym phrase, or fuzzy-corrected token). Ratios below the
teacher-configured threshold (default 30%) trigger a length-bias flag.

Word counting and phrase search are Unicode-aware so Urdu, Sindhi, and
Punjabi (Gurmukhi/Shahmukhi) transcripts measure density correctly.
"""

from __future__ import annotations

import logging
import re

from config import EngineSettings, get_settings
from language_support import normalize_for_matching
from schemas import DensityResult

logger = logging.getLogger(__name__)

# Unicode word tokens (Latin, Arabic-script, Gurmukhi, digits).
_WORD_RE = re.compile(r"[^\W_]+(?:'[^\W_]+)?", re.UNICODE)


class DensityScorer:
    """Computes the Anti-Fluff Information Density Ratio for a transcript."""

    def __init__(self, settings: EngineSettings | None = None) -> None:
        self.settings = settings or get_settings()
        self.flag_threshold = self.settings.density_flag_threshold

    def score(
        self,
        transcript: str,
        matched_surfaces: list[str],
        density_scoring_active: bool,
    ) -> DensityResult:
        """Ratio of valid rubric keyword hits to total word count."""
        normalized = normalize_for_matching(transcript)
        words = _WORD_RE.findall(normalized)
        total_words = len(words)
        if total_words == 0:
            return DensityResult(
                density_ratio=0.0,
                valid_keyword_hits=0,
                total_word_count=0,
                flagged=density_scoring_active,
                detail="Empty transcript — density ratio undefined (0%).",
            )

        hits = 0
        seen_surfaces: set[str] = set()
        for surface in matched_surfaces:
            phrase = normalize_for_matching(surface)
            if not phrase or phrase in seen_surfaces:
                continue
            seen_surfaces.add(phrase)
            hits += len(
                re.findall(
                    rf"(?<![\w]){re.escape(phrase)}(?![\w])", normalized
                )
            )

        ratio = min(round(hits / total_words * 100, 1), 100.0)
        flagged = density_scoring_active and ratio < self.flag_threshold
        detail = (
            f"Information density ({ratio}%) "
            + (
                f"below the {self.flag_threshold:.0f}% fluff threshold — "
                "length-bias flag raised; answer is padding-heavy."
                if flagged
                else (
                    f"at or above the {self.flag_threshold:.0f}% fluff threshold. "
                    "Answer is factually dense with minimal padding."
                    if density_scoring_active
                    else "computed for diagnostics (density_scoring toggle disabled)."
                )
            )
        )
        return DensityResult(
            density_ratio=ratio,
            valid_keyword_hits=hits,
            total_word_count=total_words,
            flagged=flagged,
            detail=detail,
        )
