"""Ad-hoc smoke test for the 8-debugger suite (not shipped to production).

Exercises adversarial paths: negated concepts, out-of-order sequence under
strict_order, garbage filler, fuzzy typo correction — plus the regional
language handlers for Urdu ('ur'), Sindhi ('sd'), and Punjabi ('pa'):
script detection, Nastaliq glyph-fold normalization, Unicode exact/fuzzy
matching, and Urdu/Sindhi negation cues.
"""

from __future__ import annotations

import asyncio
import json

from debuggers.fuzzy_spelling import regional_aware_similarity
from debuggers.negation_detector import NegationDetector, normalize_and_tokenize
from language_support import detect_language, normalize_regional
from pipelines.evaluation_pipeline import EvaluationPipeline
from schemas import EvaluationRequest, Rubric, RubricConcept, SensitivityToggles


def build_request(transcript: str, strict_order: bool = True) -> EvaluationRequest:
    rubric = Rubric(
        concepts=[
            RubricConcept(keyword="Sunlight", weight=3),
            RubricConcept(keyword="Chlorophyll", weight=3),
            RubricConcept(keyword="Glucose", weight=2),
            RubricConcept(keyword="CO2", weight=1),
            RubricConcept(keyword="Oxygen", weight=1),
        ],
        synonyms={
            "Sunlight": ["solar energy", "light radiation"],
            "Chlorophyll": ["green pigment", "photosynthetic pigment"],
            "Glucose": ["sugar", "simple sugar"],
            "CO2": ["carbon dioxide", "carbonic acid gas"],
            "Oxygen": ["O2", "oxygen gas"],
        },
        total_marks=10,
        ordered_concepts=["Sunlight", "Chlorophyll", "CO2", "Glucose", "Oxygen"],
    )
    return EvaluationRequest(
        student_id="STU-666",
        exam_id="exam-demo-adversarial",
        rubric=rubric,
        toggles=SensitivityToggles(
            ignore_spelling=True, strict_order=strict_order, density_scoring=True
        ),
        ocr_transcript=transcript,
        ocr_confidence=91.0,
    )


def build_urdu_request(
    transcript: str, strict_order: bool = False
) -> EvaluationRequest:
    """Urdu-medium rubric + transcript (photosynthesis)."""
    rubric = Rubric(
        concepts=[
            RubricConcept(keyword="سورج کی روشنی", weight=3),
            RubricConcept(keyword="کلوروفل", weight=3),
            RubricConcept(keyword="گلوکوز", weight=2),
            RubricConcept(keyword="آکسیجن", weight=1),
        ],
        total_marks=9,
        ordered_concepts=["سورج کی روشنی", "کلوروفل", "گلوکوز", "آکسیجن"],
    )
    return EvaluationRequest(
        student_id="STU-UR-01",
        exam_id="exam-urdu-photosynthesis",
        rubric=rubric,
        toggles=SensitivityToggles(
            ignore_spelling=True, strict_order=strict_order, density_scoring=True
        ),
        ocr_transcript=transcript,
        ocr_confidence=88.0,
    )


def build_urdu_negation_request(transcript: str) -> EvaluationRequest:
    rubric = Rubric(
        concepts=[
            RubricConcept(keyword="کلوروفل", weight=5),
            RubricConcept(keyword="سورج کی روشنی", weight=5),
        ],
        total_marks=10,
    )
    return EvaluationRequest(
        student_id="STU-UR-02",
        exam_id="exam-urdu-negation",
        rubric=rubric,
        toggles=SensitivityToggles(ignore_spelling=True),
        ocr_transcript=transcript,
        ocr_confidence=90.0,
    )


def build_sindhi_negation_request(transcript: str) -> EvaluationRequest:
    rubric = Rubric(
        concepts=[RubricConcept(keyword="ڪلوروفل", weight=5)],
        total_marks=5,
    )
    return EvaluationRequest(
        student_id="STU-SD-01",
        exam_id="exam-sindhi-negation",
        rubric=rubric,
        toggles=SensitivityToggles(ignore_spelling=True),
        ocr_transcript=transcript,
        ocr_confidence=90.0,
    )


async def main() -> None:
    pipeline = EvaluationPipeline()

    # ------------------------------------------------------------------ #
    # Case 1 — English adversarial: negated chlorophyll + out-of-order    #
    # ------------------------------------------------------------------ #
    adversarial = (
        "The plant makes glucos first, and chlorophyll does NOT absorb sunlight. "
        "Bananas are yellow and elephants cannot fly over the moon at midnight. "
        "It uses carbon dioxide to release oxigen."
    )
    result = await pipeline.evaluate(build_request(adversarial))
    print("ADVERSARIAL:", json.dumps(result, indent=2))

    diagnostics = result["diagnostics"]
    breakdown = {
        item["concept"]: item["awarded"] for item in diagnostics["rubric_breakdown"]
    }
    assert diagnostics["negation_detected"] is True, "negation must be detected"
    assert breakdown["Chlorophyll"] == 0, "negated concept must score zero"
    assert diagnostics["spelling_autocorrected"] is True, "glucos->glucose expected"
    assert diagnostics["sequence_match"] is False, "glucose-first order must fail DAG"
    assert breakdown["Glucose"] == 0, "strict_order must zero out-of-order concept"
    assert result["score"] < 10.0, "adversarial answer cannot earn full marks"

    # Case 2 — same text but strict_order disabled: sequence must not penalize.
    relaxed = await pipeline.evaluate(build_request(adversarial, strict_order=False))
    relaxed_breakdown = {
        item["concept"]: item["awarded"]
        for item in relaxed["diagnostics"]["rubric_breakdown"]
    }
    assert relaxed_breakdown["Glucose"] == 2, "relaxed toggle must not penalize order"
    assert relaxed_breakdown["Chlorophyll"] == 0, "negation still suppresses"

    # ------------------------------------------------------------------ #
    # Case 3 — regional language detection units                          #
    # ------------------------------------------------------------------ #
    assert detect_language("Plants make glucose from sunlight.") == "en"
    assert detect_language("پودے سورج کی روشنی استعمال کرتے ہیں") == "ur"
    assert detect_language("ٻوٽا ڏينهن ۽ رات وڌن ٿا") == "sd"
    assert detect_language("ਪੌਦੇ ਸੂਰਜ ਦੀ ਰੌਸ਼ਨੀ ਵਰਤਦੇ ਹਨ") == "pa"
    assert normalize_regional("\u0646\u06c1\u06cc\u06ba") == "\u0646\u0647\u06cc\u06ba", (
        "ہ→ه fold required for cue matching (نہیں → نهيں)"
    )
    assert normalize_regional("\u06d2") == "\u06cc", "baṛī ye must fold to choṭī ye"
    assert normalize_regional("\u0665\u0666") == "56", "Arabic-Indic digits must fold"
    assert regional_aware_similarity("کلوروفیل", "کلوروفل") >= 0.85, (
        "Nastaliq glyph variation must pass the ≥85% Levenshtein floor"
    )
    urdu_tokens = normalize_and_tokenize("کلوروفل \u0646\u06c1\u06cc\u06ba رکھتے")
    assert "\u0646\u0647\u06cc\u06ba" in urdu_tokens, "Urdu negation نہیں must tokenize/fold"
    sindhi_tokens = normalize_and_tokenize("ڪلوروفل نه رکن ٿا")
    assert "\u0646\u0647" in sindhi_tokens, "Sindhi negation نه must tokenize"

    # ------------------------------------------------------------------ #
    # Case 4 — Urdu end-to-end: exact + fuzzy in original Nastaliq script #
    # ------------------------------------------------------------------ #
    urdu_transcript = (
        "پودے سورج کی روشنی اور گلوکوز بناتے ہیں۔ "
        "یہ عمل کلوروفیل کی مدد سے ہوتا ہے۔"
    )
    urdu = await pipeline.evaluate(build_urdu_request(urdu_transcript))
    print("URDU:", json.dumps(urdu, indent=2, ensure_ascii=False))

    ur_diag = urdu["diagnostics"]
    ur_breakdown = {item["concept"]: item["awarded"] for item in ur_diag["rubric_breakdown"]}
    assert set(urdu.keys()) == {"student_id", "score", "max_score", "ocr_confidence", "diagnostics"}
    assert ur_diag["spelling_autocorrected"] is True, "کلوروفیل→کلوروفل expected"
    assert ur_breakdown["سورج کی روشنی"] == 3, "Urdu exact match failed"
    assert ur_breakdown["گلوکوز"] == 2, "Urdu exact match failed"
    assert ur_breakdown["کلوروفل"] == 3, "fuzzy-corrected concept must score"
    assert ur_breakdown["آکسیجن"] == 0, "missing concept must score zero"
    assert urdu["score"] == 8.0, "Urdu answer must earn 3+3+2 = 8"
    assert ur_diag["sequence_match"] is False, "گلوکوز before کلوروفل must fail DAG"

    # ------------------------------------------------------------------ #
    # Case 5 — Urdu negation (نہیں) zeroes the right concept only         #
    # ------------------------------------------------------------------ #
    urdu_negated = "پودے کلوروفل نہیں رکھتے۔ یہ سورج کی روشنی جذب کرتے ہیں۔"
    ur_neg = await pipeline.evaluate(build_urdu_negation_request(urdu_negated))
    print("URDU-NEGATION:", json.dumps(ur_neg, indent=2, ensure_ascii=False))

    un_diag = ur_neg["diagnostics"]
    un_breakdown = {item["concept"]: item["awarded"] for item in un_diag["rubric_breakdown"]}
    assert un_diag["negation_detected"] is True, "نہیں must trigger negation"
    assert un_breakdown["کلوروفل"] == 0, "negated Urdu concept must score zero"
    assert un_breakdown["سورج کی روشنی"] == 5, "unrelated concept must not be harmed"

    # ------------------------------------------------------------------ #
    # Case 6 — Sindhi negation (نه) end-to-end                            #
    # ------------------------------------------------------------------ #
    sindhi_negated = "ٻوٽا ڪلوروفل نه رکن ٿا."
    sd_neg = await pipeline.evaluate(build_sindhi_negation_request(sindhi_negated))
    print("SINDHI-NEGATION:", json.dumps(sd_neg, indent=2, ensure_ascii=False))

    assert sd_neg["diagnostics"]["negation_detected"] is True, "نه must trigger negation"
    assert sd_neg["score"] == 0.0, "negated Sindhi concept must score zero"

    # Case 7 — Sindhi non-negated control answer scores full marks.
    sd_pos = await pipeline.evaluate(
        build_sindhi_negation_request("ٻوٽا ڪلوروفل رکن ٿا ۽ اهو ضروري آهي.")
    )
    assert sd_pos["diagnostics"]["negation_detected"] is False, (
        "control sentence carries no negation cue"
    )
    assert sd_pos["score"] == 5.0, "non-negated Sindhi concept must score full"

    # Case 8 — negation detector units for the remaining regional cues.
    detector = NegationDetector()
    rubric_single = Rubric(
        concepts=[RubricConcept(keyword="کلوروفل", weight=5)], total_marks=5
    )
    mat_result = await detector.detect("پودے کلوروفل مت بنائیں۔", rubric_single)
    assert mat_result.negation_detected is True, "Urdu 'مت' must be a negation cue"
    na_result = await detector.detect("سورج کی روشنی نا ہے۔", Rubric(
        concepts=[RubricConcept(keyword="سورج کی روشنی", weight=5)], total_marks=5
    ))
    assert na_result.negation_detected is True, "Shahmukhi 'نا' must be a negation cue"

    print("ALL ADVERSARIAL ASSERTIONS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
