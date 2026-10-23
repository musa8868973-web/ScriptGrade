"""Auto-rubric extraction service (PRD endpoint #4 — Page 3 Rubric Studio).

Uploads of the question paper + sample answer are analysed via Vision-Based OCR (Qwen3.8-Max Vision /
Qwen-VL) to bypass standard PDF text parser limitations with RTL scripts (Urdu, Arabic).
Extracts structured grading criteria, key concepts, and model answers directly in their original language.
"""

import json
import logging
import re
import unicodedata
from collections import Counter
from typing import Any

from app.services.ai_client import ai_client
from app.utils.pdf_tools import extract_document_images

logger = logging.getLogger(__name__)

_MAX_CONCEPTS = 15
_MIN_WEIGHT = 1.0
_MAX_WEIGHT = 10.0

_ENGLISH_STOPWORDS = frozenset(
    """a an the and or but of to in on at by for with about into through
    during before after above below from up down out off over under again
    once here there when where why how all any both each few more most other
    some such only own same so than too very can will just is are was were be
    been being have has had do does did it its this that these those i we you
    he she they them as what which who whom not no answer question write
    explain describe define following""".split()
)

_URDU_STOPWORDS = frozenset(
    """کا کے کی کو ہے ہیں تھا تھی تھے سے پر میں نے اور یا یہ وہ اس ان
    کیا کیوں کب کیسے کہاں کون جس جن جنہیں جنہوں نے کر کے دیا دی گئے
    گیا گئی ہو ہوتا ہوتی ہوتے ہونا ہونے والے والی والا تاکہ اگر مگر
    لیکن بلکہ جواب سوال بیان وضاحت تفصیل درج ذیل تمام کچھ بہت""".split()
)

_STOPWORDS = _ENGLISH_STOPWORDS | _URDU_STOPWORDS

# Matches words across Latin and Arabic/Urdu scripts (at least 2 letters)
_TERM_RE = re.compile(
    r"[A-Za-z\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]"
    r"[A-Za-z0-9\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\'\-]{1,}"
)

# ----------------------------------------------------------------------
# 1. Vision Prompts (Primary: Vision-based OCR directly on document images)
# ----------------------------------------------------------------------

_VISION_SYSTEM_PROMPT = (
    "You are ScriptGrade's multilingual Vision & OCR rubric engine. "
    "You analyze scanned document images of exams, question papers, and marking schemes directly, "
    "preserving RTL scripts (such as Urdu Nastaliq or Arabic) and complex typography.\n\n"
    "CRITICAL INSTRUCTIONS:\n"
    "1. Extract all core grading criteria, key concepts, and model answers in their ORIGINAL language "
    "(preserving Urdu script completely). Do not drop non-ASCII text.\n"
    "2. Return a structured JSON object with 'concepts' containing 'concept_name', 'keywords', and 'weightage'.\n"
    "3. Respond ONLY with a valid, strict JSON object formatted exactly as:\n"
    "{\n"
    '  "concepts": [\n'
    '    {\n'
    '      "concept_name": "Core concept or topic in original script (e.g. فوٹوسنتھیسس)",\n'
    '      "keywords": ["essential keyword 1 in original script", "essential keyword 2"],\n'
    '      "weightage": number between 1 and 10,\n'
    '      "criteria": "Scoring requirement or model answer sentence in original script"\n'
    '    }\n'
    '  ]\n'
    "}"
)

_VISION_USER_PROMPT = (
    "Analyze these document images. Extract all core grading criteria, key concepts, "
    "and model answers in their ORIGINAL language (preserving Urdu script completely). "
    "Return a structured JSON with 'concept_name', 'keywords', and 'weightage'."
)

# ----------------------------------------------------------------------
# 2. Text Prompts (Fallback: when only text is available)
# ----------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are ScriptGrade's multilingual rubric engine. You convert exam reference material "
    "into an auditable, deterministic grading rubric.\n\n"
    "CRITICAL INSTRUCTIONS:\n"
    "1. Extract core concepts, key phrases, and criteria directly in the language of the source document "
    "(e.g., Urdu or English). Do not drop non-ASCII text.\n"
    "2. If the source material is in Urdu (RTL script), Arabic, or any non-English language, you MUST "
    "preserve the native script verbatim for all concept keywords, criteria, and synonyms.\n"
    "3. Respond ONLY with a valid, strict JSON object formatted exactly as:\n"
    "{\n"
    '  "concepts": [\n'
    '    {"keyword": "concise core concept or phrase in source language", '
    '"criteria": "scoring guideline/description", "weight": number between 1 and 10}\n'
    "  ],\n"
    '  "synonyms": {\n'
    '    "exact_keyword": ["valid academic synonym or variant phrase in the same language", ...]\n'
    "  }\n"
    "}\n"
    "Weights must reflect concept importance (1 to 10). Core definitions receive the highest weights. "
    "Keywords must represent concise, meaningful academic concepts and MUST NOT be left blank."
)

_USER_PROMPT_TEMPLATE = """Exam title: {title}

Question paper text:
{question_text}

Sample/reference answer text:
{sample_text}

Extract the {max_concepts} most grade-worthy concepts, key phrases, and criteria directly in the language of the source document (e.g., Urdu or English). Do not drop non-ASCII text. Include integer weights (1-10) and language-matched synonym clusters."""


def _normalize_vision_extraction(
    raw: dict[str, Any] | list[Any],
    fallback_source: str = "",
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    """Coerce vision model output ('concept_name', 'keywords', 'weightage') into validated rubric contract."""
    concepts: list[dict[str, Any]] = []
    synonyms_map: dict[str, list[str]] = {}
    seen: set[str] = set()

    items: list[Any] = []
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        items = (
            raw.get("concepts")
            or raw.get("grading_criteria")
            or raw.get("criteria")
            or raw.get("rubric")
            or []
        )

    for item in items:
        if not isinstance(item, dict):
            continue

        raw_name = (
            item.get("concept_name")
            or item.get("keyword")
            or item.get("concept")
            or item.get("title")
            or item.get("criteria")
            or item.get("phrase")
            or ""
        )
        name = unicodedata.normalize("NFKC", str(raw_name)).strip()

        raw_keywords = item.get("keywords") or []
        # Fallback to first keyword if concept_name was empty
        if not name and isinstance(raw_keywords, list) and raw_keywords:
            name = unicodedata.normalize("NFKC", str(raw_keywords[0])).strip()

        if len(name) > 100:
            name = name[:97].rstrip() + "…"

        if not name or name.casefold() in seen:
            continue

        try:
            raw_weight = item.get("weightage") or item.get("weight") or 1.0
            weight = float(raw_weight)
        except (TypeError, ValueError):
            weight = 1.0
        weight = min(max(round(weight, 1), _MIN_WEIGHT), _MAX_WEIGHT)

        seen.add(name.casefold())

        # Process synonyms / keyword variants
        kw_list: list[str] = []
        if isinstance(raw_keywords, list):
            kw_list = [
                unicodedata.normalize("NFKC", str(k)).strip()
                for k in raw_keywords
                if str(k).strip()
            ]
        elif isinstance(raw_keywords, str):
            kw_list = [
                unicodedata.normalize("NFKC", str(k)).strip()
                for k in raw_keywords.split(",")
                if str(k).strip()
            ]

        cleaned_kw = [k for k in kw_list if k.casefold() != name.casefold()][:5]
        if cleaned_kw:
            synonyms_map[name] = cleaned_kw

        concepts.append({
            "keyword": name,
            "concept_name": name,
            "weight": weight,
            "weightage": weight,
            "points": weight,
            "keywords": cleaned_kw,
            "synonyms": cleaned_kw,
            "criteria": str(item.get("criteria") or ""),
        })

        if len(concepts) >= _MAX_CONCEPTS:
            break

    # If extracted criteria is empty, log the full raw input and fallback
    if not concepts:
        raw_debug_str = json.dumps(raw, ensure_ascii=False) if isinstance(raw, (dict, list)) else str(raw)
        print(f"\n[RUBRIC EXTRACTION] WARNING: Vision normalization produced 0 concepts. Full raw input was:\n{raw_debug_str}\n")
        logger.warning("[RUBRIC EXTRACTION] Vision normalization produced 0 concepts. Full raw input: %s", raw_debug_str)
        if fallback_source:
            logger.info("Vision output had no valid concepts; falling back to sentence-level extraction.")
            return _heuristic_extraction(fallback_source)

    return concepts, synonyms_map


def _normalize_extraction(
    raw: dict[str, Any], fallback_source: str = ""
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    """Coerce arbitrary text model output into the validated rubric contract preserving UTF-8 / Urdu."""
    concepts: list[dict[str, Any]] = []
    seen: set[str] = set()

    for item in raw.get("concepts", []) or []:
        if not isinstance(item, dict):
            continue

        raw_keyword = (
            item.get("keyword")
            or item.get("concept_name")
            or item.get("concept")
            or item.get("criteria")
            or item.get("title")
            or item.get("phrase")
            or ""
        )
        keyword = unicodedata.normalize("NFKC", str(raw_keyword)).strip()

        if len(keyword) > 100:
            keyword = keyword[:97].rstrip() + "…"

        if not keyword or keyword.casefold() in seen:
            continue

        try:
            raw_weight = item.get("weightage") or item.get("weight") or 1.0
            weight = float(raw_weight)
        except (TypeError, ValueError):
            weight = 1.0
        weight = min(max(round(weight, 1), _MIN_WEIGHT), _MAX_WEIGHT)

        seen.add(keyword.casefold())
        concepts.append({"keyword": keyword, "weight": weight})
        if len(concepts) >= _MAX_CONCEPTS:
            break

    if not concepts and fallback_source:
        logger.info("Empty concepts from text model; falling back to sentence-level extraction.")
        return _heuristic_extraction(fallback_source)

    synonyms_map: dict[str, list[str]] = {}
    raw_synonyms = raw.get("synonyms", {}) or {}
    if isinstance(raw_synonyms, dict):
        for concept in concepts:
            kw = concept["keyword"]
            cluster = raw_synonyms.get(kw) or raw_synonyms.get(kw.casefold()) or []
            cleaned = list(
                dict.fromkeys(
                    unicodedata.normalize("NFKC", str(s)).strip()
                    for s in (cluster if isinstance(cluster, list) else [])
                    if str(s).strip()
                )
            )[:5]
            if cleaned:
                synonyms_map[kw] = cleaned

    return concepts, synonyms_map


def _heuristic_extraction(sample_text: str) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    """Deterministic multilingual concept extraction (offline or zero-criteria fallback)."""
    normalized_text = unicodedata.normalize("NFKC", sample_text)
    tokens = [
        t.strip("۔،؟.,!?:;'\"- \t\r\n")
        for t in _TERM_RE.findall(normalized_text)
    ]
    content = [
        t for t in tokens
        if t and t.casefold() not in _STOPWORDS and t not in _URDU_STOPWORDS and len(t) >= 2
    ]
    frequencies = Counter(content)
    ranked = [term for term, _count in frequencies.most_common(_MAX_CONCEPTS)]
    total = sum(frequencies.values()) or 1
    concepts: list[dict[str, Any]] = []

    if ranked:
        for term in ranked:
            prominence = frequencies[term] / total
            weight = min(max(round(1 + prominence * 40, 1), _MIN_WEIGHT), _MAX_WEIGHT)
            # Capitalize only ASCII words; keep non-Latin (Urdu/Arabic) unmodified
            display_term = term.capitalize() if term.isascii() else term
            concepts.append({"keyword": display_term, "weight": weight})
    else:
        # Fallback to key sentences/clauses if word frequency yields no tokens
        sentences = [
            s.strip()
            for s in re.split(r"[\n\.\?!۔؟]+", normalized_text)
            if len(s.strip()) >= 4
        ]
        for s in sentences[:_MAX_CONCEPTS]:
            phrase = s[:60].rstrip()
            if phrase and phrase not in [c["keyword"] for c in concepts]:
                concepts.append({"keyword": phrase, "weight": 5.0})

    if not concepts:
        concepts = [{"keyword": "Core Concept", "weight": 5.0}]

    concepts.sort(key=lambda c: c["weight"], reverse=True)
    return concepts, {}


async def extract_concepts(
    exam_title: str,
    question_text: str = "",
    sample_text: str = "",
    question_bytes: bytes | None = None,
    sample_bytes: bytes | None = None,
    question_filename: str = "",
    sample_filename: str = "",
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    """Produce (concepts, synonyms) for a new exam rubric with Vision-first multilingual extraction."""
    # Coerce input types if bytes are passed in text slots
    if isinstance(question_text, (bytes, bytearray)) and question_bytes is None:
        question_bytes = bytes(question_text)
        question_text = ""
    if isinstance(sample_text, (bytes, bytearray)) and sample_bytes is None:
        sample_bytes = bytes(sample_text)
        sample_text = ""

    # 1. Vision-Based OCR Extraction (preserves Urdu / RTL encoding directly from document images)
    doc_images: list[bytes] = []
    if sample_bytes:
        doc_images.extend(extract_document_images(sample_bytes, sample_filename, max_pages=4))
    if question_bytes:
        doc_images.extend(extract_document_images(question_bytes, question_filename, max_pages=4))

    source_text = sample_text or question_text

    print(f"\n[RUBRIC EXTRACTION] Starting concept extraction for '{exam_title}' (ai_configured={ai_client.is_configured}, images={len(doc_images)})")
    logger.info("[RUBRIC EXTRACTION] Starting extraction for '%s' (images=%d, text_len=%d)", exam_title, len(doc_images), len(source_text))

    if ai_client.is_configured and doc_images:
        try:
            print(f"[RUBRIC EXTRACTION] Sending {len(doc_images[:6])} page image(s) to Qwen Vision OCR...")
            logger.info("Running Qwen Vision rubric extraction with %d page image(s)...", len(doc_images))
            raw_vision = await ai_client.extract_vision_json(
                images=doc_images[:6],
                prompt=_VISION_USER_PROMPT,
                system_prompt=_VISION_SYSTEM_PROMPT,
            )
            raw_vision_str = json.dumps(raw_vision, ensure_ascii=False)
            print(f"\n[RUBRIC EXTRACTION] >>> Raw Qwen Vision Output:\n{raw_vision_str}\n")
            logger.info("[RUBRIC EXTRACTION] Raw Qwen Vision Output: %s", raw_vision_str)

            concepts, synonyms_map = _normalize_vision_extraction(raw_vision, fallback_source=source_text)
            if concepts:
                print(f"[RUBRIC EXTRACTION] Vision extraction succeeded: {len(concepts)} concepts parsed (top: '{concepts[0].get('keyword')}')")
                logger.info(
                    "Vision extraction succeeded: %d concept(s) extracted for '%s' (top: %s)",
                    len(concepts),
                    exam_title,
                    concepts[0]["keyword"],
                )
                return concepts, synonyms_map
            print("[RUBRIC EXTRACTION] Vision output returned 0 concepts. Falling back to text prompt...")
            logger.warning("Vision extraction returned no concepts; trying text-based extraction.")
        except Exception as exc:
            print(f"[RUBRIC EXTRACTION] Vision extraction exception: {exc}")
            logger.warning("Vision extraction failed (%s); falling back to text-based extraction.", exc)

    # 2. Text-based LLM extraction fallback
    if ai_client.is_configured and (question_text or sample_text):
        try:
            print(f"[RUBRIC EXTRACTION] Sending source text ({len(source_text)} chars) to Qwen text generator...")
            raw = await ai_client.generate_json(
                _SYSTEM_PROMPT,
                _USER_PROMPT_TEMPLATE.format(
                    title=exam_title,
                    question_text=question_text[:6000] or "(not extractable from upload)",
                    sample_text=sample_text[:6000] or "(not extractable from upload)",
                    max_concepts=_MAX_CONCEPTS,
                ),
            )
            raw_text_str = json.dumps(raw, ensure_ascii=False)
            print(f"\n[RUBRIC EXTRACTION] >>> Raw Qwen Text Output:\n{raw_text_str}\n")
            logger.info("[RUBRIC EXTRACTION] Raw Qwen Text Output: %s", raw_text_str)

            concepts, synonyms_map = _normalize_extraction(raw, fallback_source=source_text)
            if concepts:
                print(f"[RUBRIC EXTRACTION] Text extraction succeeded: {len(concepts)} concepts parsed.")
                logger.info(
                    "Text-based Qwen extraction succeeded: %d concept(s) for '%s'",
                    len(concepts),
                    exam_title,
                )
                return concepts, synonyms_map
            print("[RUBRIC EXTRACTION] Text model returned 0 concepts. Falling back to heuristic...")
        except Exception as exc:
            print(f"[RUBRIC EXTRACTION] Text extraction exception: {exc}")
            logger.warning("Text-based Qwen extraction failed (%s); falling back to heuristic parser.", exc)

    # 3. Deterministic heuristic fallback
    print("[RUBRIC EXTRACTION] Falling back to deterministic multilingual heuristic parser...")
    if not source_text or not any(ch.isalnum() for ch in source_text):
        print("[RUBRIC EXTRACTION] Source text contains no alphanumeric characters; returning generic placeholder.")
        return [{"keyword": "Core Concept", "weight": 5.0}], {}

    concepts, synonyms_map = _heuristic_extraction(source_text)
    print(f"[RUBRIC EXTRACTION] Heuristic extracted {len(concepts)} concept(s).")
    return concepts, synonyms_map
