"""ScriptGrade NLP Engine — versioned prompt engineering contracts.

Holds the two canonical prompt templates defined in PRD §4:

* **Prompt A** — Auto-Rubric Extraction (Qwen-2.5): converts a Question
  Paper + Sample Reference Answer into a weighted concept/synonym rubric.
* **Prompt B** — Comprehensive Evaluation (Qwen-VL + Qwen-2.5): the
  advisory 8-metric semantic review over an OCR transcript + rubric.

Templates are versioned constants; builders produce the exact message
payloads dispatched through ``llm_client.DashScopeClient``.
"""

from __future__ import annotations

import json
from typing import Any

PROMPT_CONTRACT_VERSION = "1.0.0"


# ====================================================================== #
# Prompt A — Auto-Rubric Extraction (Qwen-2.5 / Qwen-Plus)                #
# ====================================================================== #
RUBRIC_EXTRACTION_SYSTEM_PROMPT = (
    "You are an expert academic evaluation AI. Analyze the provided Question "
    "Paper and Sample Reference Answer.\n\n"
    "TASK:\n"
    "1. Extract key concepts/facts required for a full-mark response.\n"
    "2. Assign recommended point weights totaling the question's total marks.\n"
    "3. Generate 3-5 valid academic synonyms/alternative phrasings for each concept.\n\n"
    "OUTPUT FORMAT (STRICT JSON ONLY):\n"
    "{\n"
    '  "concepts": [\n'
    '    { "keyword": "Sunlight", "weight": 3 },\n'
    '    { "keyword": "Chlorophyll", "weight": 3 },\n'
    '    { "keyword": "Glucose", "weight": 2 }\n'
    "  ],\n"
    '  "synonyms": {\n'
    '    "Sunlight": ["solar energy", "light radiation"],\n'
    '    "Chlorophyll": ["green pigment", "photosynthetic pigment"]\n'
    "  }\n"
    "}\n\n"
    "Rules:\n"
    "- Respond with ONLY the JSON object — no markdown fences, no commentary.\n"
    "- Concept weights MUST be positive numbers summing exactly to the total marks.\n"
    "- Every concept keyword MUST appear as a key in the synonyms map with 3-5 entries.\n"
    "- Keywords must be short canonical noun phrases suitable for vector embedding."
)


def build_rubric_extraction_user_message(
    question_paper: str,
    sample_answer: str,
    total_marks: float,
) -> str:
    """Render the Prompt A user message for one exam question."""
    return (
        "QUESTION PAPER:\n"
        f"{question_paper.strip()}\n\n"
        "SAMPLE REFERENCE ANSWER:\n"
        f"{sample_answer.strip()}\n\n"
        f"TOTAL MARKS FOR THIS QUESTION: {total_marks}\n\n"
        "Produce the rubric JSON now."
    )


def build_rubric_extraction_messages(
    question_paper: str,
    sample_answer: str,
    total_marks: float,
) -> list[dict[str, Any]]:
    """Full chat-completion message list for Prompt A."""
    return [
        {"role": "system", "content": RUBRIC_EXTRACTION_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": build_rubric_extraction_user_message(
                question_paper, sample_answer, total_marks
            ),
        },
    ]


# ====================================================================== #
# Prompt B — Comprehensive Evaluation (Qwen-VL + Qwen-2.5)                #
# ====================================================================== #
EVALUATION_SYSTEM_PROMPT = (
    "Evaluate the student answer transcript against the Rubric Configuration.\n\n"
    "TASK:\n"
    "Perform deep semantic matching, check for negation modifiers, verify "
    "procedure sequence, and compute the 8 diagnostic metrics.\n\n"
    "OUTPUT FORMAT (STRICT JSON ONLY):\n"
    "{\n"
    '  "student_id": "STU-102",\n'
    '  "score": 10.0,\n'
    '  "max_score": 10.0,\n'
    '  "ocr_confidence": 96.5,\n'
    '  "diagnostics": {\n'
    '    "garbage_text_score": 0.0,\n'
    '    "negation_detected": false,\n'
    '    "synonym_matched": true,\n'
    '    "spelling_autocorrected": true,\n'
    '    "sequence_match": true,\n'
    '    "diagram_verified": true,\n'
    '    "density_ratio": 88.5,\n'
    '    "rubric_breakdown": [\n'
    '      { "concept": "Sunlight", "awarded": 3, "max": 3 },\n'
    '      { "concept": "Chlorophyll", "awarded": 3, "max": 3 }\n'
    "    ]\n"
    "  }\n"
    "}\n\n"
    "Rules:\n"
    "- Respond with ONLY the JSON object — no markdown fences, no commentary.\n"
    "- Scores must respect the rubric weights; never exceed max_score.\n"
    "- All diagnostic booleans must reflect the transcript evidence."
)


def build_evaluation_user_message(
    ocr_transcript: str,
    concepts_json: dict[str, Any] | list[Any],
    toggles_string: str,
    student_id: str,
    ocr_confidence: float,
) -> str:
    """Render the Prompt B user message (PRD §4-B INPUT block)."""
    return (
        "INPUT:\n"
        f"- OCR Transcript: {ocr_transcript.strip()}\n"
        f"- Rubric JSON: {json.dumps(concepts_json, ensure_ascii=False)}\n"
        f"- Toggles: {toggles_string}\n"
        f"- Student ID: {student_id}\n"
        f"- OCR Confidence: {ocr_confidence}\n\n"
        "Produce the evaluation JSON now."
    )


def build_evaluation_messages(
    ocr_transcript: str,
    concepts_json: dict[str, Any] | list[Any],
    toggles_string: str,
    student_id: str,
    ocr_confidence: float,
) -> list[dict[str, Any]]:
    """Full chat-completion message list for Prompt B."""
    return [
        {"role": "system", "content": EVALUATION_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": build_evaluation_user_message(
                ocr_transcript,
                concepts_json,
                toggles_string,
                student_id,
                ocr_confidence,
            ),
        },
    ]


# ====================================================================== #
# Supporting vision prompts (Qwen-VL)                                     #
# ====================================================================== #
VISION_OCR_PROMPT = (
    "You are a handwriting OCR engine for exam answer scripts.\n"
    "TASK: Transcribe ALL handwritten text in the provided scanned answer "
    "sheet(s) verbatim, preserving the student's original wording, paragraph "
    "order, and any inline text labels drawn next to diagrams.\n\n"
    "OUTPUT FORMAT (STRICT JSON ONLY):\n"
    "{\n"
    '  "transcript": "<full verbatim transcription>",\n'
    '  "ocr_confidence": <float 0-100 estimating legibility confidence>\n'
    "}\n"
    "Respond with ONLY the JSON object — no markdown fences, no commentary."
)

VISUAL_INSPECTION_PROMPT_TEMPLATE = (
    "You are a diagram inspection engine for handwritten exam answers.\n"
    "TASK: Analyze the diagram/flowchart region(s) in the provided scanned "
    "answer sheet(s). Detect every visual element: drawn shapes, directional "
    "arrows, and spatial text labels. Estimate pixel bounding boxes "
    "[x1, y1, x2, y2] for each element.\n"
    "{expected_labels_block}"
    "OUTPUT FORMAT (STRICT JSON ONLY):\n"
    "{{\n"
    '  "elements": [\n'
    '    {{ "label": "<element label or description>", '
    '"type": "label|arrow|shape|diagram", '
    '"bounding_box": [x1, y1, x2, y2], '
    '"confidence": <float 0-100> }}\n'
    "  ],\n"
    '  "overall_confidence": <float 0-100>\n'
    "}}\n"
    "Respond with ONLY the JSON object — no markdown fences, no commentary."
)

NEGATION_CONFIRMATION_PROMPT_TEMPLATE = (
    "You are a dependency-parsing engine for academic answer evaluation.\n"
    "For each candidate snippet below, decide whether a negation or reversal "
    "modifier (not, never, fails to, without, lack of, cannot, absence) is "
    "grammatically bound to the rubric concept such that the student's "
    "sentence DENIES or REVERSES the required fact.\n\n"
    "CANDIDATES:\n"
    "{candidates_json}\n\n"
    "OUTPUT FORMAT (STRICT JSON ONLY):\n"
    '{{ "results": [{{ "concept": "<concept>", "negated": true|false }}] }}\n'
    "Respond with ONLY the JSON object — no markdown fences, no commentary."
)
