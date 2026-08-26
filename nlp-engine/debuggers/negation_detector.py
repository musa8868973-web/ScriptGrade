"""Debugger II — Negation & Reversal Modifiers Engine.

PRD §3.II: catches instances where a student writes required rubric keywords
but negates their meaning (e.g. "Chlorophyll does NOT absorb sunlight").

Logic: two-stage dependency analysis —
1. **Local scan:** tokenize the transcript (contractions expanded, e.g.
   ``doesn't`` → ``does not``; regional scripts tokenized as Unicode words),
   locate every rubric-concept occurrence and bind each negation cue to its
   nearest concept. English cues: ``not``, ``never``, ``fails to``,
   ``without``, ``lack of``, ... Regional cues: Urdu/Punjabi ``نہ`` /
   ``نہیں`` / ``مت`` and Sindhi ``نه`` / ``ناهي``.
2. **LLM confirmation:** candidate spans are dispatched to Qwen-2.5 which
   performs dependency-level confirmation so only genuinely reversed facts
   trigger ``negation_detected: true``.
"""

from __future__ import annotations

import json
import logging

from language_support import (
    SENTENCE_SPLIT_RE,
    UNICODE_WORD_RE,
    normalize_regional,
)
from llm_client import DashScopeClientError, extract_json, get_dashscope_client
from prompts.contracts import NEGATION_CONFIRMATION_PROMPT_TEMPLATE
from schemas import NegationResult, Rubric

logger = logging.getLogger(__name__)

# Bound negation tokens scanned in the dependency window (PRD §3.II).
# Multi-word English cues are fused into single tokens by
# normalize_and_tokenize. Regional cues are stored in their normalized glyph
# form (ہ→ه, ے→ی) because transcripts pass through normalize_regional first.
NEGATION_TOKENS: tuple[str, ...] = (
    "not",
    "never",
    "no",
    "none",
    "without",
    "fails_to",
    "fail_to",
    "failed_to",
    "failing_to",
    "lack_of",
    "lacks",
    "lack",
    "lacking",
    "absence_of",
    "absent",
    "cannot",
    "can_not",
    "could_not",
    "would_not",
    "should_not",
    "is_not",
    "are_not",
    "was_not",
    "were_not",
    "does_not",
    "do_not",
    "did_not",
    "has_not",
    "have_not",
    "had_not",
    "nor",
    "neither",
    "instead_of",
    "rather_than",
    # Urdu / Shahmukhi Punjabi negations. Raw forms are kept alongside the
    # glyph-folded canonical forms produced by normalize_regional
    # (ہ U+06C1 → ه U+0647, ی/ي/ے → ی U+06CC) so membership is exact:
    "\u0646\u06c1",  # نہ  (na — raw)
    "\u0646\u0647",  # نه  (na — folded form, also Sindhi)
    "\u0646\u06c1\u06cc\u06ba",  # نہیں (nahīn — raw)
    "\u0646\u0647\u06cc\u06ba",  # نهيں (nahīn — folded)
    "\u0645\u062a",  # مت  (mat — prohibitive)
    "\u0646\u0627",  # نا  (nā — Shahmukhi)
    # Sindhi negations:
    "\u0646\u0627\u0647\u06cc",  # ناهي (nāhī — folded yeh)
    "\u0646\u0627\u0647\u06cc\u06ba",  # ناهين (nāhīn — folded)
)

_MULTIWORD_NEGATIONS: tuple[str, ...] = tuple(
    token.replace("_", " ") for token in NEGATION_TOKENS if "_" in token
)
_NEGATION_SET: frozenset[str] = frozenset(NEGATION_TOKENS)

_WINDOW_TOKENS = 3  # dependency window on each side of a concept occurrence


def normalize_and_tokenize(text: str) -> list[str]:
    """Casefold-tokenize with regional glyph folds and contraction expansion.

    Works across Latin, Nastaliq (Urdu/Sindhi/Shahmukhi), and Gurmukhi
    scripts: ``normalize_regional`` folds confusable glyph variants (ہ→ه,
    ے→ی, harakat removal), then Unicode word tokenization runs, English
    contractions expand (n't → not), and multi-word English negation cues
    (``does not``, ``fails to``, ``lack of``, ...) fuse into single atomic
    tokens so their full extent stays adjacent to the concept they bind to
    within the dependency window.
    """
    folded = normalize_regional(text.casefold())
    tokens = UNICODE_WORD_RE.findall(folded)
    expanded: list[str] = []
    for token in tokens:
        if token.endswith("n't"):
            expanded.append(token[:-3] if len(token) > 3 else "do")
            expanded.append("not")
        else:
            expanded.append(token)
    joined = " " + " ".join(expanded) + " "
    for phrase in sorted(_MULTIWORD_NEGATIONS, key=len, reverse=True):
        joined = joined.replace(" " + phrase + " ", f" {phrase.replace(' ', '_')} ")
    return joined.split()


def _find_spans(tokens: list[str], phrase_words: list[str]) -> list[tuple[int, int]]:
    """All [start, end) token spans where ``phrase_words`` appears verbatim."""
    spans: list[tuple[int, int]] = []
    width = len(phrase_words)
    if width == 0:
        return spans
    for start in range(len(tokens) - width + 1):
        if tokens[start:start + width] == phrase_words:
            spans.append((start, start + width))
    return spans


def _window_text(tokens: list[str], start: int, end: int) -> str:
    lo = max(0, start - _WINDOW_TOKENS)
    hi = min(len(tokens), end + _WINDOW_TOKENS)
    return " ".join(tokens[lo:hi])


class NegationDetector:
    """Detects rubric concepts whose meaning is negated in the student text."""

    def __init__(self, use_llm_confirmation: bool = True) -> None:
        self.use_llm_confirmation = use_llm_confirmation

    def _scan_sentence(
        self, sentence: str, rubric: Rubric
    ) -> tuple[list[tuple[int, int, str]], list[int]]:
        """Locate concept spans and negation cue indices in one sentence.

        Returns ``(concept_occurrences, cue_indices)`` where occurrences are
        ``(start, end, keyword)`` token ranges.
        """
        tokens = normalize_and_tokenize(sentence)
        occurrences: list[tuple[int, int, str]] = []
        if not tokens:
            return [], []
        for concept in rubric.concepts:
            phrase_words = normalize_and_tokenize(concept.keyword)
            for start, end in _find_spans(tokens, phrase_words):
                occurrences.append((start, end, concept.keyword))
        cue_indices = [
            index for index, token in enumerate(tokens) if token in _NEGATION_SET
        ]
        return occurrences, cue_indices

    @staticmethod
    def _bind_cue(
        cue_index: int,
        occurrences: list[tuple[int, int, str]],
    ) -> tuple[int, int, str] | None:
        """Bind one negation cue to the concept it most plausibly governs.

        The negated claim is canonically about the clause SUBJECT, so cues
        preferentially bind to the nearest concept BEFORE them
        ("Chlorophyll does NOT absorb sunlight" -> Chlorophyll). When no
        concept precedes the cue, they bind forward to the nearest concept
        ("Plants do not need sunlight" -> Sunlight).
        """
        forward: tuple[int, tuple[int, int, str]] | None = None
        backward: tuple[int, tuple[int, int, str]] | None = None
        for occurrence in occurrences:
            start, end, _keyword = occurrence
            if start > cue_index:
                distance = start - cue_index
                if forward is None or distance < forward[0]:
                    forward = (distance, occurrence)
            elif end <= cue_index:
                distance = cue_index - end + 1
                if backward is None or distance < backward[0]:
                    backward = (distance, occurrence)
        if backward is not None:
            return backward[1]
        if forward is not None:
            return forward[1]
        return None

    def local_scan(self, transcript: str, rubric: Rubric) -> list[dict]:
        """Deterministic negation-token scan; returns candidate snippets.

        Scoping is sentence-local, and each negation cue binds to exactly one
        concept — the nearest occurrence in the sentence (forward-first) — so
        a single modifier can never suppress two concepts at once, and cues
        separated from a concept by a clause boundary bind to what they
        actually govern.
        """
        candidates: list[dict] = []
        seen: set[tuple[str, str]] = set()
        for sentence in SENTENCE_SPLIT_RE.split(transcript):
            tokens = normalize_and_tokenize(sentence)
            occurrences, cue_indices = self._scan_sentence(sentence, rubric)
            if not occurrences or not cue_indices:
                continue
            bound: dict[tuple[int, int], tuple[int, int, str]] = {}
            for cue_index in cue_indices:
                target = self._bind_cue(cue_index, occurrences)
                if target is None:
                    continue
                distance = abs(cue_index - target[0]) + abs(cue_index - target[1])
                if distance > 2 * _WINDOW_TOKENS + 2:
                    continue  # cue too far away to be grammatically bound
                span_key = (target[0], target[1])
                existing = bound.get(span_key)
                if existing is None or abs(cue_index - span_key[0]) < abs(
                    span_key[0] - existing[0]
                ):
                    bound[span_key] = target
            for (_start, _end, keyword) in bound.values():
                dedupe_key = (keyword, " ".join(tokens))
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)
                for start, end, concept_keyword in occurrences:
                    if concept_keyword == keyword:
                        candidates.append(
                            {
                                "concept": concept_keyword,
                                "snippet": _window_text(tokens, start, end),
                                # When LLM confirmation is unavailable, only
                                # cues bound within the dependency window are
                                # trusted by the lexical fallback.
                                "local_verdict": True,
                            }
                        )
                        break
        return candidates

    async def _llm_confirm(self, candidates: list[dict]) -> dict[str, bool]:
        """Ask Qwen-2.5 to confirm which candidates truly reverse meaning."""
        prompt = NEGATION_CONFIRMATION_PROMPT_TEMPLATE.format(
            candidates_json=json.dumps(
                [
                    {"concept": item["concept"], "snippet": item["snippet"]}
                    for item in candidates
                ],
                ensure_ascii=False,
            )
        )
        try:
            client = get_dashscope_client()
            raw = await client.chat([{"role": "user", "content": prompt}])
            payload = extract_json(raw)
        except (DashScopeClientError, ValueError) as exc:
            logger.warning("LLM negation confirmation unavailable: %s", exc)
            return {}
        verdicts: dict[str, bool] = {}
        for entry in payload.get("results", []) if isinstance(payload, dict) else []:
            if isinstance(entry, dict) and "concept" in entry:
                verdicts[str(entry["concept"])] = bool(entry.get("negated"))
        return verdicts

    async def detect(
        self, transcript: str, rubric: Rubric
    ) -> NegationResult:
        """Full two-stage negation analysis over the student transcript."""
        candidates = self.local_scan(transcript, rubric)
        if not candidates:
            return NegationResult(
                negation_detected=False,
                flagged_tokens=[],
                detail=(
                    "No negation modifiers (not, never, fails to, without, lack of) "
                    "bound to magic concepts detected via dependency parse."
                ),
            )

        verdicts: dict[str, bool] = {}
        if self.use_llm_confirmation:
            verdicts = await self._llm_confirm(candidates)

        flagged: list[dict] = []
        for candidate in candidates:
            # LLM verdict wins when available; otherwise only grammatically
            # bound (preceding) modifiers from the lexical scan stand.
            confirmed = verdicts.get(
                candidate["concept"], bool(candidate.get("local_verdict"))
            )
            if confirmed:
                flagged.append(
                    {
                        "concept": candidate["concept"],
                        "snippet": candidate["snippet"],
                    }
                )

        if not flagged:
            return NegationResult(
                negation_detected=False,
                flagged_tokens=[],
                detail=(
                    f"{len(candidates)} candidate negation span(s) rejected by "
                    "dependency confirmation — concepts retain full meaning."
                ),
            )

        concepts_hit = sorted({item["concept"] for item in flagged})
        return NegationResult(
            negation_detected=True,
            flagged_tokens=flagged,
            detail=(
                f"Negation/reversal modifiers bound to magic concepts: "
                f"{', '.join(concepts_hit)}. Awarded points suppressed for "
                "reversed facts."
            ),
        )
