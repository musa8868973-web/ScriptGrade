"""Alibaba Cloud DashScope client for Qwen-2.5 (LLM) and Qwen-VL (Vision).

All AI inference funnels through this single gateway:
  * `generate_json`  — structured JSON generation with Qwen-2.5 / Qwen-Plus.
  * `ocr_image`      — handwritten OCR + visual inspection with Qwen-VL.

Robustness contract: every call retries transient failures, and every parser
has a deterministic local fallback so the API never returns a 500 solely
because the model response is malformed.
"""

import asyncio
import base64
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/api/v1/services"
_MAX_RETRIES = 3
_RETRY_BACKOFF = 1.5

_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


class AIClientError(RuntimeError):
    """Raised when DashScope is unreachable or rejects the request."""


@dataclass(slots=True)
class OCRResult:
    """Qwen-VL transcription result for one scanned page."""

    transcript: str
    confidence: float = 0.0
    diagram_present: bool = False
    visual_elements: list[dict[str, Any]] = field(default_factory=list)


class DashScopeClient:
    """Async gateway over Alibaba Cloud DashScope inference endpoints."""

    def __init__(self) -> None:
        self._api_key: str = settings.qwen_api_key
        self._llm_model: str = settings.qwen_llm_model
        self._vl_model: str = settings.qwen_vl_model
        self._timeout: float = settings.qwen_timeout_seconds

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    # ------------------------------------------------------------------ LLM

    async def generate_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        """Ask Qwen-2.5 for a structured JSON object and parse it safely."""
        payload = {
            "model": self._llm_model,
            "input": {
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ]
            },
            "parameters": {
                "result_format": "message",
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
            },
        }
        data = await self._post_with_retry(
            f"{_DASHSCOPE_BASE}/aigc/text-generation/generation", payload
        )
        raw = self._extract_text(data)
        return self._parse_json_lenient(raw)

    # ------------------------------------------------------------------ VL

    async def ocr_image(self, image_bytes: bytes, mime_type: str = "application/pdf") -> OCRResult:
        """Transcribe a scanned answer sheet with Qwen-VL and detect diagrams."""
        encoded = base64.b64encode(image_bytes).decode("ascii")
        data_url = f"data:{mime_type};base64,{encoded}"
        prompt = (
            "You are an expert exam-sheet OCR engine. Transcribe ALL visible "
            "handwritten or printed text on this page verbatim. Also detect any "
            "diagrams, flowcharts, arrows or labelled drawings. Respond with a "
            'strict JSON object: {"transcript": string, "confidence": number '
            '(0-100), "diagram_present": boolean, "visual_elements": [{"label": '
            'string, "bounding_box": [x1,y1,x2,y2], "confidence": number}]}'
        )
        payload = {
            "model": self._vl_model,
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"image": data_url},
                            {"text": prompt},
                        ],
                    }
                ]
            },
            "parameters": {"result_format": "message"},
        }
        data = await self._post_with_retry(
            f"{_DASHSCOPE_BASE}/aigc/multimodal-generation/generation", payload
        )
        parsed = self._parse_json_lenient(self._extract_text(data))
        transcript = str(parsed.get("transcript", "")).strip()
        try:
            confidence = float(parsed.get("confidence", 0.0))
        except (TypeError, ValueError):
            confidence = 0.0
        elements_raw = parsed.get("visual_elements", [])
        elements = [el for el in elements_raw if isinstance(el, dict)] if isinstance(
            elements_raw, list
        ) else []
        return OCRResult(
            transcript=transcript,
            confidence=max(0.0, min(100.0, confidence)),
            diagram_present=bool(parsed.get("diagram_present", False)),
            visual_elements=elements,
        )

    async def extract_vision_json(
        self,
        images: list[bytes],
        prompt: str,
        system_prompt: str | None = None,
    ) -> dict[str, Any]:
        """Send page images directly to Qwen Vision (Qwen3.8-Max / Qwen-VL) to extract structured JSON.

        Preserves non-Latin scripts (Urdu, Arabic) by using visual OCR features
        rather than corrupted text layers. Enforces response_format={"type": "json_object"}
        and strict UTF-8 serialization.
        """
        if not images:
            return {}

        image_contents: list[dict[str, Any]] = []
        for img in images:
            encoded = base64.b64encode(img).decode("ascii")
            mime = "image/png"
            if img.startswith(b"\xff\xd8\xff"):
                mime = "image/jpeg"
            elif img.startswith(b"RIFF"):
                mime = "image/webp"
            image_contents.append({"image": f"data:{mime};base64,{encoded}"})

        # Append prompt text
        image_contents.append({"text": prompt})

        messages: list[dict[str, Any]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": image_contents})

        payload = {
            "model": self._vl_model,
            "input": {"messages": messages},
            "parameters": {
                "result_format": "message",
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
            },
        }

        data = await self._post_with_retry(
            f"{_DASHSCOPE_BASE}/aigc/multimodal-generation/generation", payload
        )
        raw = self._extract_text(data)
        return self._parse_json_lenient(raw)

    # -------------------------------------------------------------- plumbing

    async def _post_with_retry(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.is_configured:
            raise AIClientError("QWEN_API_KEY is not configured")
        raw_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json; charset=utf-8",
        }
        last_error: Exception | None = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    response = await client.post(url, content=raw_body, headers=headers)
                if response.status_code == 429 or response.status_code >= 500:
                    raise AIClientError(
                        f"DashScope transient error {response.status_code}"
                    )
                if response.status_code >= 400:
                    raise AIClientError(
                        f"DashScope rejected request: {response.status_code} "
                        f"{response.text[:300]}"
                    )
                response.encoding = "utf-8"
                return response.json()
            except (httpx.HTTPError, AIClientError) as exc:
                last_error = exc
                if attempt == _MAX_RETRIES:
                    break
                await asyncio.sleep(_RETRY_BACKOFF * attempt)
        raise AIClientError(f"DashScope call failed after retries: {last_error}")

    @staticmethod
    def _extract_text(data: dict[str, Any]) -> str:
        """Pull the assistant text out of a DashScope response envelope."""
        try:
            output = data.get("output", {})
            choices = output.get("choices")
            if choices:
                content = choices[0].get("message", {}).get("content")
                if isinstance(content, list):  # multimodal content blocks
                    return "".join(
                        block.get("text", "") for block in content if isinstance(block, dict)
                    )
                if isinstance(content, str):
                    return content
            text = output.get("text")
            if isinstance(text, str):
                return text
        except (AttributeError, IndexError, TypeError):
            pass
        return ""

    @staticmethod
    def _parse_json_lenient(raw: str) -> dict[str, Any]:
        """Parse model output into a dict, tolerating fences and prose without silent swallowing."""
        if not raw or not raw.strip():
            logger.error("[AI Parser] Model returned completely empty output.")
            print("[AI Parser] ERROR: Model returned completely empty output.")
            return {}
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
            if isinstance(parsed, list):
                return {"concepts": parsed}
        except json.JSONDecodeError as exc:
            logger.warning(
                "[AI Parser] Direct json.loads failed (%s). Attempting regex block extraction. Full raw text:\n%s",
                exc,
                raw,
            )
            print(f"[AI Parser] WARNING: Direct json.loads failed ({exc}). Full raw text:\n{raw}")

        match = _JSON_BLOCK_RE.search(raw)
        if match:
            try:
                parsed = json.loads(match.group(0))
                if isinstance(parsed, dict):
                    return parsed
                if isinstance(parsed, list):
                    return {"concepts": parsed}
            except json.JSONDecodeError as exc:
                logger.error(
                    "[AI Parser] Extracted JSON block failed parsing (%s).\nExtracted Block:\n%s\nFull Raw Output:\n%s",
                    exc,
                    match.group(0),
                    raw,
                )
                print(
                    f"[AI Parser] ERROR: Extracted JSON block failed parsing ({exc}).\nExtracted Block:\n{match.group(0)}\nFull Raw Output:\n{raw}"
                )
        else:
            logger.error(
                "[AI Parser] No JSON structure found in raw response. Full raw output:\n%s",
                raw,
            )
            print(f"[AI Parser] ERROR: No JSON structure found in raw response. Full raw output:\n{raw}")
        return {}


ai_client = DashScopeClient()
