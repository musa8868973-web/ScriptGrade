"""Debugger IV — Fuzzy Spelling Auto-Correction.

PRD §3.IV: ensures students are not penalized for minor spelling typos when
the teacher has enabled the ``ignore_spelling`` toggle.

Logic: Levenshtein Distance between student tokens (and token n-grams for
multi-word keywords) and rubric keywords. Windows with an average similarity
of ``>= 85%`` (``1 - distance / max_len``) are auto-corrected in-place with
zero score deduction, emitting ``spelling_autocorrected: true``.

Regional scripts: tokenization is Unicode-aware (Nastaliq Urdu/Sindhi/
Shahmukhi and Gurmukhi), and similarity is additionally computed over
``normalize_regional`` glyph folds (harakat, ہ/ھ/ة, ے/ی/ى, آ/أ/إ, ك/ک,
Arabic-Indic digits, Gurmukhi tippi/bindi) so characteristic Nastaliq
character variations never defeat the ≥85% match logic. Corrections always
preserve the rubric keyword in its ORIGINAL script.
"""

from __future__ import annotations

import logging
import re

from config import EngineSettings, get_settings
from language_support import contains_regional_script, normalize_regional
from schemas import FuzzyCorrectionResult, Rubric

logger = logging.getLogger(__name__)

# Unicode word spans (Latin, Arabic-script, Gurmukhi) with apostrophes and
# hyphens tolerated inside a token.
_WORD_SPAN_RE = re.compile(r"[^\W_]+(?:['\-][^\W_]+)*", re.UNICODE)
_MIN_TOKEN_LEN = 3
_MIN_REGIONAL_TOKEN_LEN = 2  # regional scripts carry meaning in shorter words
_MAX_PHRASE_WORDS = 3


def levenshtein_distance(a: str, b: str) -> int:
    """Wagner–Fischer edit distance with two rolling rows (O(len(a)*len(b)))."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    previous = list(range(len(b) + 1))
    for i, char_a in enumerate(a, start=1):
        current = [i] + [0] * len(b)
        for j, char_b in enumerate(b, start=1):
            insertion = previous[j] + 1
            deletion = current[j - 1] + 1
            substitution = previous[j - 1] + (char_a != char_b)
            current[j] = min(insertion, deletion, substitution)
        previous = current
    return previous[-1]


def levenshtein_similarity(a: str, b: str) -> float:
    """Normalized similarity in [0, 1]: ``1 - distance / max(len(a), len(b))``."""
    if not a and not b:
        return 1.0
    longest = max(len(a), len(b))
    if longest == 0:
        return 1.0
    return 1.0 - levenshtein_distance(a, b) / longest


def regional_aware_similarity(a: str, b: str) -> float:
    """Levenshtein similarity tolerant to Nastaliq/Arabic glyph variations.

    For Latin text this is plain Levenshtein similarity. When either side
    carries a regional script the similarity is ALSO computed over the
    ``normalize_regional`` glyph-folded forms and the better score wins —
    e.g. ``کلوروفیل`` vs ``کلوروفل`` or OCR-flipped ``ے``/``ی`` variants.
    """
    base = levenshtein_similarity(a, b)
    if not (contains_regional_script(a) or contains_regional_script(b)):
        return base
    folded_a = normalize_regional(a.casefold())
    folded_b = normalize_regional(b.casefold())
    return max(base, levenshtein_similarity(folded_a, folded_b))


class FuzzySpellingCorrector:
    """Auto-corrects near-miss rubric keyword spellings in the transcript."""

    def __init__(self, settings: EngineSettings | None = None) -> None:
        self.settings = settings or get_settings()
        self.threshold = self.settings.fuzzy_match_threshold

    def _keyword_phrases(self, rubric: Rubric) -> list[list[str]]:
        phrases: list[list[str]] = []
        for keyword in rubric.keywords:
            words = keyword.casefold().split()
            if words and len(words) <= _MAX_PHRASE_WORDS:
                phrases.append(words)
        # Longest phrases first so multi-word keywords win over sub-tokens.
        phrases.sort(key=len, reverse=True)
        return phrases

    def correct(self, transcript: str, rubric: Rubric) -> FuzzyCorrectionResult:
        """Return the corrected transcript plus the audit trail of corrections."""
        spans = [
            (match.group(0), match.start(), match.end())
            for match in _WORD_SPAN_RE.finditer(transcript)
        ]
        if not spans or not rubric.keywords:
            return FuzzyCorrectionResult(
                corrected_text=transcript,
                detail="No correctable tokens or rubric keywords present.",
            )

        phrases = self._keyword_phrases(rubric)
        consumed: set[int] = set()
        corrections: list[dict] = []
        replacements: list[tuple[int, int, str]] = []

        for phrase_words in phrases:
            width = len(phrase_words)
            for index in range(len(spans) - width + 1):
                window = spans[index:index + width]
                window_indices = set(range(index, index + width))
                if window_indices & consumed:
                    continue
                window_words = [word.casefold() for word, _, _ in window]

                if window_words == phrase_words:
                    # Exact keyword already present — protect the tokens.
                    consumed |= window_indices
                    continue

                min_len = (
                    _MIN_REGIONAL_TOKEN_LEN
                    if any(contains_regional_script(w) for w in window_words)
                    else _MIN_TOKEN_LEN
                )
                if any(len(word) < min_len for word in window_words):
                    continue

                similarities = [
                    regional_aware_similarity(token, target)
                    for token, target in zip(window_words, phrase_words)
                ]
                average = sum(similarities) / len(similarities)
                if average >= self.threshold and min(similarities) >= 0.5:
                    original = transcript[window[0][1]:window[-1][2]]
                    corrected_phrase = " ".join(phrase_words)
                    corrections.append(
                        {
                            "original": original,
                            "corrected": corrected_phrase,
                            "levenshtein_score": round(average, 2),
                        }
                    )
                    replacements.append(
                        (window[0][1], window[-1][2], corrected_phrase)
                    )
                    consumed |= window_indices

        corrected_text = transcript
        for start, end, replacement in sorted(replacements, key=lambda r: r[0], reverse=True):
            corrected_text = corrected_text[:start] + replacement + corrected_text[end:]

        autocorrected = len(corrections) > 0
        detail = (
            f"{len(corrections)} token(s) auto-corrected above the "
            f"{int(self.threshold * 100)}% Levenshtein threshold. "
            "No score deduction applied."
            if autocorrected
            else "No spelling corrections required above the "
            f"{int(self.threshold * 100)}% Levenshtein threshold."
        )
        return FuzzyCorrectionResult(
            corrected_text=corrected_text,
            corrections=corrections,
            spelling_autocorrected=autocorrected,
            detail=detail,
        )
