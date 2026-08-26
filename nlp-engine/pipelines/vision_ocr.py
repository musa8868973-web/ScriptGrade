"""Pipeline — Qwen-VL Vision OCR (PRD §2 multi-modal architecture).

Transcribes scanned handwritten answer sheets (ADF scanner PDFs rendered to
images, or mobile-synced photos) into verbatim OCR transcripts with a
legibility confidence score. Local image files are converted to base64 data
URLs; remote OSS/HTTP URLs are passed through to Qwen-VL untouched.

The diagram/visual inspection half of the Qwen-VL engine lives in
``debuggers.visual_inspector`` (Debugger VI) and reuses this module's image
normalization helpers.
"""

from __future__ import annotations

import base64
import logging
import mimetypes
import os
import re

from llm_client import DashScopeClientError, extract_json, get_dashscope_client
from prompts.contracts import VISION_OCR_PROMPT
from schemas import OCRResult

logger = logging.getLogger(__name__)

_REMOTE_URL_RE = re.compile(r"^(https?|oss)://", re.IGNORECASE)
_DATA_URL_RE = re.compile(r"^data:image/", re.IGNORECASE)
_DEFAULT_CONFIDENCE = 90.0


def image_to_model_url(path_or_url: str) -> str:
    """Normalize an image reference into a Qwen-VL-consumable URL.

    * ``http(s)://`` / ``oss://`` / ``data:image/...`` pass through.
    * Local file paths are base64-encoded into RFC-2397 data URLs.
    """
    if _REMOTE_URL_RE.match(path_or_url) or _DATA_URL_RE.match(path_or_url):
        return path_or_url
    if not os.path.isfile(path_or_url):
        raise FileNotFoundError(f"Scanned answer sheet not found: {path_or_url}")
    mime_type = mimetypes.guess_type(path_or_url)[0] or "image/png"
    with open(path_or_url, "rb") as handle:
        encoded = base64.b64encode(handle.read()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


class VisionOCRError(RuntimeError):
    """Raised when Qwen-VL cannot transcribe the supplied sheets."""


class VisionOCRPipeline:
    """Qwen-VL handwritten OCR with confidence scoring."""

    async def transcribe(
        self, image_paths: list[str], extra_instructions: str = ""
    ) -> OCRResult:
        """Transcribe one or more scanned answer sheet images.

        Returns an ``OCRResult`` with the verbatim transcript, the model's
        legibility confidence (0-100), and the page count processed.
        """
        if not image_paths:
            raise VisionOCRError("No scanned images supplied for OCR transcription")

        image_urls = [image_to_model_url(path) for path in image_paths]
        prompt = VISION_OCR_PROMPT
        if extra_instructions.strip():
            prompt += f"\nADDITIONAL INSTRUCTIONS: {extra_instructions.strip()}"

        client = get_dashscope_client()
        try:
            raw = await client.vision(prompt, image_urls, max_tokens=3072)
        except DashScopeClientError as exc:
            raise VisionOCRError(f"Qwen-VL OCR call failed: {exc}") from exc

        try:
            payload = extract_json(raw)
        except ValueError as exc:
            # Model returned prose instead of strict JSON — salvage as transcript.
            logger.warning("Qwen-VL OCR returned non-JSON output; salvaging prose")
            return OCRResult(
                transcript=raw.strip(),
                confidence=_DEFAULT_CONFIDENCE,
                page_count=len(image_paths),
            )

        if not isinstance(payload, dict) or "transcript" not in payload:
            raise VisionOCRError(
                f"Qwen-VL OCR payload missing transcript: {str(payload)[:300]}"
            )

        transcript = str(payload["transcript"]).strip()
        confidence = _coerce_confidence(payload.get("ocr_confidence"))
        if not transcript:
            raise VisionOCRError("Qwen-VL OCR produced an empty transcript")

        logger.info(
            "Qwen-VL OCR transcribed %d page(s), confidence %.1f%%",
            len(image_paths),
            confidence,
        )
        return OCRResult(
            transcript=transcript,
            confidence=confidence,
            page_count=len(image_paths),
        )


def _coerce_confidence(raw: object) -> float:
    """Clamp the model's confidence into the 0-100 percentage range."""
    try:
        value = float(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return _DEFAULT_CONFIDENCE
    if 0.0 <= value <= 1.0:  # tolerate fractional confidence outputs
        value *= 100.0
    return round(max(0.0, min(value, 100.0)), 1)
