"""ScriptGrade NLP Engine — regional language support.

Adds first-class handling for Urdu (``ur``), Sindhi (``sd``), and Punjabi
(``pa``) answer scripts:

* **Language detection** — lightweight Unicode-block scoring that
  distinguishes Gurmukhi Punjabi, Sindhi (Arabic script implosives such as
  ``ٻ ڄ ڃ ڱ ڻ``), and Urdu / Shahmukhi (Arabic script with ``ٹ ڈ ڑ ں ے``).
* **Nastaliq / Arabic-script normalization** — folds harakat, tatweel,
  alef/heh/yeh/kaf glyph variants, Arabic-Indic digits, and Gurmukhi
  tippi→bindi so OCR confusion between visually similar glyphs does not
  defeat exact or fuzzy matching.
* **Script-aware matching primitives** — Unicode word tokenization and a
  ``normalize_for_matching`` surface shared by every debugger that performs
  phrase containment checks.

Cross-lingual semantics: student sentences are ALWAYS kept in their original
script; rubric concept vectors stay English. Alibaba Cloud's multilingual
Text-Embedding models (``text-embedding-v3``) provide the Urdu/Sindhi/Punjabi
→ English alignment inside AnalyticDB pgvector, with similarity floors
relaxed by ``settings.cross_lingual_threshold_offset``.
"""

from __future__ import annotations

import re

SUPPORTED_REGIONAL_LANGUAGES: tuple[str, ...] = ("ur", "sd", "pa")
DEFAULT_LANGUAGE = "en"

# ---------------------------------------------------------------------- #
# Script detection primitives                                             #
# ---------------------------------------------------------------------- #
UNICODE_WORD_RE = re.compile(r"[^\W_]+(?:'[^\W_]+)?", re.UNICODE)

# Sentence boundaries include the Arabic full stop (۔), Arabic question
# mark (؟), Arabic semicolon (؛), and Devanagari/Gurmukhi danda (।).
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?؟۔।])\s+|[;؛\n]+")

_ARABIC_SCRIPT_RE = re.compile(
    "[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]"
)
_GURMUKHI_RE = re.compile("[\u0a00-\u0a7f]")
_LATIN_RE = re.compile("[A-Za-z]")

# Sindhi-specific letters (implosives, retroflex stops, Sindhi kaf, ۽).
_SINDHI_MARKERS = frozenset("ٻڄڃڱڻٽٺٿڊڏڍ۽ڪڦ")
# Urdu-specific letters (shared with Shahmukhi — Urdu is the default
# resolution when Arabic-script text carries no Sindhi majority).
_URDU_MARKERS = frozenset("ٹڈڑںےھ")


def detect_language(text: str) -> str:
    """Detect the dominant script/language of a transcript.

    Returns one of ``'en'``, ``'ur'``, ``'sd'``, ``'pa'``. Gurmukhi text is
    Punjabi; Arabic-script text is Sindhi when Sindhi-specific characters
    outnumber Urdu-specific ones, otherwise Urdu; Latin text is English.
    """
    if not text or not text.strip():
        return DEFAULT_LANGUAGE
    if _GURMUKHI_RE.search(text):
        return "pa"
    if _ARABIC_SCRIPT_RE.search(text):
        sindhi_hits = sum(text.count(ch) for ch in _SINDHI_MARKERS)
        urdu_hits = sum(text.count(ch) for ch in _URDU_MARKERS)
        return "sd" if sindhi_hits > urdu_hits else "ur"
    if _LATIN_RE.search(text):
        return "en"
    return DEFAULT_LANGUAGE


def contains_regional_script(text: str) -> bool:
    """True when the text carries Arabic-script or Gurmukhi characters."""
    return bool(_ARABIC_SCRIPT_RE.search(text) or _GURMUKHI_RE.search(text))


def is_cross_lingual(language: str) -> bool:
    """True when the student language differs from the English rubric space."""
    return language != DEFAULT_LANGUAGE


# ---------------------------------------------------------------------- #
# Nastaliq / Arabic-script & Gurmukhi normalization                       #
# ---------------------------------------------------------------------- #
# Harakat, superscript alef, tatweel, and Quranic annotation marks — these
# never carry grading meaning and confuse Levenshtein distance.
_HARAKAT_RE = re.compile(
    "[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640\u06e5\u06e6]"
)

# Glyph-variant folds for characters OCR routinely confuses in Nastaliq.
_CHAR_FOLDS: dict[str, str] = {
    # Alef family -> plain alef
    "\u0622": "\u0627",  # آ
    "\u0623": "\u0627",  # أ
    "\u0625": "\u0627",  # إ
    "\u0671": "\u0627",  # ٱ
    # Teh marbuta / Urdu heh / do-chashmi heh -> Arabic heh
    "\u0629": "\u0647",  # ة
    "\u06c1": "\u0647",  # ہ
    "\u06be": "\u0647",  # ھ
    # Yeh family (incl. Urdu baṛī ye ے — frequent OCR confusion) -> ی
    "\u06d2": "\u06cc",  # ے
    "\u06d3": "\u06cc",  # ۓ
    "\u0649": "\u06cc",  # ى
    "\u064a": "\u06cc",  # ي
    # Arabic kaf -> Urdu/Shahmukhi kaf
    "\u0643": "\u06a9",  # ك -> ک
    # Gurmukhi tippi -> bindi
    "\u0a70": "\u0a02",  # ੰ -> ਂ
}

_ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9"


def normalize_regional(text: str) -> str:
    """Fold regional-script glyph variants without changing the script itself.

    The output remains in the ORIGINAL script (Urdu stays Urdu, Sindhi stays
    Sindhi) — only confusable glyph variants, diacritics, and digit forms
    are unified so downstream exact/fuzzy matching is robust.
    """
    text = _HARAKAT_RE.sub("", text)
    text = "".join(_CHAR_FOLDS.get(ch, ch) for ch in text)
    for offset, digit in enumerate(_ARABIC_INDIC_DIGITS):
        text = text.replace(digit, str(offset % 10))
    return text


_NON_MATCH_RE = re.compile(r"[^\w\s]", re.UNICODE)


def normalize_for_matching(text: str) -> str:
    """Canonical comparison surface: casefold + regional folds + punctuation.

    Used by every debugger performing phrase containment so that Latin,
    Nastaliq, and Gurmukhi transcripts share one deterministic code path.
    """
    folded = normalize_regional(text.casefold())
    stripped = _NON_MATCH_RE.sub(" ", folded)
    return " ".join(stripped.split())
