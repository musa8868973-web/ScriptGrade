"""Debugger VI — Qwen-VL Diagram & Visual Inspector.

PRD §3.VI: evaluates handwritten biological diagrams, flowcharts, and visual
labels that plain-text OCR cannot grade.

Logic: scanned image regions are dispatched to Qwen-VL which returns detected
visual elements (shapes, directional arrows, spatial text labels) with
bounding boxes and per-element confidence. Detected labels are reconciled
against the rubric's ``diagram_labels`` expectations; coverage at or above
the configured floor yields ``diagram_verified: true``.
"""

from __future__ import annotations

import logging

from config import EngineSettings, get_settings
from debuggers.fuzzy_spelling import levenshtein_similarity
from llm_client import DashScopeClientError, extract_json, get_dashscope_client
from pipelines.vision_ocr import image_to_model_url
from prompts.contracts import VISUAL_INSPECTION_PROMPT_TEMPLATE
from schemas import VisualElement, VisualInspectionResult

logger = logging.getLogger(__name__)

_LABEL_FUZZY_FLOOR = 0.80  # label reconciliation similarity (reuse of Debugger IV math)
_VALID_ELEMENT_TYPES = {"label", "arrow", "shape", "diagram"}


def _coerce_bounding_box(raw: object) -> list[int]:
    if isinstance(raw, list) and all(
        isinstance(value, (int, float)) for value in raw
    ):
        return [int(value) for value in raw[:4]]
    return []


def _parse_elements(payload: dict) -> tuple[list[VisualElement], float]:
    elements: list[VisualElement] = []
    for entry in payload.get("elements", []) or []:
        if not isinstance(entry, dict):
            continue
        element_type = str(entry.get("type", "label")).lower()
        if element_type not in _VALID_ELEMENT_TYPES:
            element_type = "label"
        elements.append(
            VisualElement(
                label=str(entry.get("label", "unlabelled element")),
                element_type=element_type,  # type: ignore[arg-type]
                bounding_box=_coerce_bounding_box(entry.get("bounding_box")),
                confidence=float(entry.get("confidence", 0.0)),
            )
        )
    overall = float(payload.get("overall_confidence", 0.0) or 0.0)
    return elements, overall


class VisualInspector:
    """Qwen-VL region dispatch for diagram elements, arrows, and labels."""

    def __init__(self, settings: EngineSettings | None = None) -> None:
        self.settings = settings or get_settings()
        self.coverage_floor = self.settings.diagram_label_coverage

    @staticmethod
    def _label_matches(expected: str, detected_labels: list[str]) -> bool:
        expected_norm = expected.lower().strip()
        for detected in detected_labels:
            detected_norm = detected.lower().strip()
            if expected_norm in detected_norm or detected_norm in expected_norm:
                return True
            if levenshtein_similarity(expected_norm, detected_norm) >= _LABEL_FUZZY_FLOOR:
                return True
        return False

    async def inspect(
        self, image_paths: list[str], expected_labels: list[str]
    ) -> VisualInspectionResult:
        """Run Qwen-VL visual inspection over the scanned answer sheet images."""
        if not image_paths:
            return VisualInspectionResult(
                diagram_verified=True,
                visual_confidence=None,
                detected_elements=[],
                detail=(
                    "No scanned images supplied — visual inspection skipped; "
                    "diagram requirement treated as satisfied."
                ),
            )

        expected_block = ""
        if expected_labels:
            expected_block = (
                "EXPECTED SPATIAL LABELS (verify each where present): "
                + ", ".join(expected_labels)
                + ".\n"
            )
        prompt = VISUAL_INSPECTION_PROMPT_TEMPLATE.format(
            expected_labels_block=expected_block
        )

        try:
            client = get_dashscope_client()
            image_urls = [image_to_model_url(path) for path in image_paths]
            raw = await client.vision(prompt, image_urls)
            payload = extract_json(raw)
        except (DashScopeClientError, ValueError, FileNotFoundError) as exc:
            logger.warning("Qwen-VL visual inspection failed: %s", exc)
            return VisualInspectionResult(
                diagram_verified=False,
                visual_confidence=0.0,
                detected_elements=[],
                detail=f"Qwen-VL visual inspection unavailable: {exc}",
            )

        if not isinstance(payload, dict):
            payload = {}
        elements, overall_confidence = _parse_elements(payload)

        if expected_labels:
            detected_labels = [element.label for element in elements]
            matched_labels = [
                label
                for label in expected_labels
                if self._label_matches(label, detected_labels)
            ]
            coverage = len(matched_labels) / len(expected_labels)
            diagram_verified = coverage >= self.coverage_floor
            detail = (
                f"Qwen-VL verified {len(matched_labels)}/{len(expected_labels)} "
                f"expected spatial labels ({coverage:.0%} coverage, floor "
                f"{self.coverage_floor:.0%}); {len(elements)} visual element(s) "
                "detected in scanned regions."
            )
        else:
            diagram_verified = len(elements) > 0 or not image_paths
            detail = (
                f"Qwen-VL detected {len(elements)} visual element(s); no explicit "
                "label expectations configured."
            )

        return VisualInspectionResult(
            diagram_verified=diagram_verified,
            visual_confidence=round(overall_confidence, 1),
            detected_elements=elements,
            detail=detail,
        )
