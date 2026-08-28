"""Auto-rubric extraction service (PRD endpoint #4 — Page 3 Rubric Studio).

Uploads of the question paper + sample answer are analysed by Qwen-2.5 via
DashScope to produce weighted magic concepts and synonym clusters. A
deterministic frequency-based extractor guarantees a functional response even
when the AI gateway is unreachable.
"""

import logging
import re
from collections import Counter
from typing import Any

from app.services.ai_client import ai_client

logger = logging.getLogger(__name__)

_MAX_CONCEPTS = 15
_MIN_WEIGHT = 1.0
_MAX_WEIGHT = 10.0

_STOPWORDS = frozenset(
    """a an the and or but of to in on at by for with about into through
    during before after above below from up down out off over under again
    once here there when where why how all any both each few more most other
    some such only own same so than too very can will just is are was were be
    been being have has had do does did it its this that these those i we you
    he she they them as what which who whom not no answer question write
    explain describe define following""".split()
)

_TERM_RE = re.compile(r"[A-Za-z][A-Za-z'\-]{2,}")

_SYSTEM_PROMPT = (
    "You are ScriptGrade's rubric engine. You convert exam reference material "
    "into a deterministic grading rubric. Respond ONLY with a strict JSON "
    'object shaped exactly as: {"concepts": [{"keyword": string, "weight": '
    "number between 1 and 10}], \"synonyms\": {keyword: [3 to 5 academic "
    "synonym phrases]}}. Weights reflect concept importance; core definitions "
    "receive the highest weights. Keywords must be concise academic terms."
)

_USER_PROMPT_TEMPLATE = """Exam title: {title}

Question paper text:
{question_text}

Sample/reference answer text:
{sample_text}

Extract the {max_concepts} most grade-worthy concepts from the reference answer
with integer weights (1-10) and synonym clusters."""


def _normalize_extraction(raw: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    """Coerce arbitrary model output into the validated rubric contract."""
    concepts: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw.get("concepts", []) or []:
        if not isinstance(item, dict):
            continue
        keyword = str(item.get("keyword", "")).strip()
        if not keyword or keyword.lower() in seen:
            continue
        try:
            weight = float(item.get("weight", 1))
        except (TypeError, ValueError):
            weight = 1.0
        weight = min(max(round(weight, 1), _MIN_WEIGHT), _MAX_WEIGHT)
        seen.add(keyword.lower())
        concepts.append({"keyword": keyword, "weight": weight})
        if len(concepts) >= _MAX_CONCEPTS:
            break

    synonyms_map: dict[str, list[str]] = {}
    raw_synonyms = raw.get("synonyms", {}) or {}
    if isinstance(raw_synonyms, dict):
        for concept in concepts:
            cluster = raw_synonyms.get(concept["keyword"], [])
            cleaned = list(
                dict.fromkeys(
                    str(s).strip()
                    for s in (cluster if isinstance(cluster, list) else [])
                    if str(s).strip()
                )
            )[:5]
            if cleaned:
                synonyms_map[concept["keyword"]] = cleaned
    return concepts, synonyms_map


def _heuristic_extraction(sample_text: str) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    """Deterministic frequency-based concept extraction (AI-offline fallback)."""
    tokens = [t.lower() for t in _TERM_RE.findall(sample_text)]
    content = [t for t in tokens if t not in _STOPWORDS and len(t) > 3]
    frequencies = Counter(content)
    ranked = [term for term, _count in frequencies.most_common(_MAX_CONCEPTS)]
    total = sum(frequencies.values()) or 1
    concepts: list[dict[str, Any]] = []
    for term in ranked:
        prominence = frequencies[term] / total
        weight = min(max(round(1 + prominence * 40, 1), _MIN_WEIGHT), _MAX_WEIGHT)
        concepts.append({"keyword": term.capitalize(), "weight": weight})
    concepts.sort(key=lambda c: c["weight"], reverse=True)
    return concepts, {}


async def extract_concepts(
    exam_title: str,
    question_text: str,
    sample_text: str,
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    """Produce (concepts, synonyms) for a new exam rubric."""
    if ai_client.is_configured and (question_text or sample_text):
        try:
            raw = await ai_client.generate_json(
                _SYSTEM_PROMPT,
                _USER_PROMPT_TEMPLATE.format(
                    title=exam_title,
                    question_text=question_text[:6000] or "(not extractable from upload)",
                    sample_text=sample_text[:6000] or "(not extractable from upload)",
                    max_concepts=_MAX_CONCEPTS,
                ),
            )
            concepts, synonyms_map = _normalize_extraction(raw)
            if concepts:
                return concepts, synonyms_map
            logger.warning("Qwen returned no usable concepts; using heuristics.")
        except Exception as exc:  # noqa: BLE001 — AI failure must not break setup
            logger.warning("Qwen extraction failed (%s); using heuristics.", exc)

    source = sample_text or question_text
    if not re.search(r"[A-Za-z]", source or ""):
        # No extractable text at all (e.g. pure image scans) — seed a single
        # editable placeholder the teacher refines in the Rubric Studio.
        return [{"keyword": "Core Concept", "weight": 5.0}], {}
    return _heuristic_extraction(source)
