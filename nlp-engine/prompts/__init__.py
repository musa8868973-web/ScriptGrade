"""Versioned JSON prompt templates for the ScriptGrade NLP engine."""

__path__ = __import__("pkgutil").extend_path(__path__, __name__)  # type: ignore[name-defined]

from prompts.contracts import (
    EVALUATION_SYSTEM_PROMPT,
    NEGATION_CONFIRMATION_PROMPT_TEMPLATE,
    PROMPT_CONTRACT_VERSION,
    RUBRIC_EXTRACTION_SYSTEM_PROMPT,
    VISUAL_INSPECTION_PROMPT_TEMPLATE,
    VISION_OCR_PROMPT,
    build_evaluation_messages,
    build_evaluation_user_message,
    build_rubric_extraction_messages,
    build_rubric_extraction_user_message,
)

__all__ = [
    "EVALUATION_SYSTEM_PROMPT",
    "NEGATION_CONFIRMATION_PROMPT_TEMPLATE",
    "PROMPT_CONTRACT_VERSION",
    "RUBRIC_EXTRACTION_SYSTEM_PROMPT",
    "VISUAL_INSPECTION_PROMPT_TEMPLATE",
    "VISION_OCR_PROMPT",
    "build_evaluation_messages",
    "build_evaluation_user_message",
    "build_rubric_extraction_messages",
    "build_rubric_extraction_user_message",
]
