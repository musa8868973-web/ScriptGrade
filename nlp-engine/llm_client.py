"""ScriptGrade NLP Engine — Alibaba Cloud DashScope async gateway client.

Single unified transport for every Qwen inference call in the engine:

* ``chat``   — Qwen-2.5 / Qwen-Plus text completion (strict JSON mode)
* ``vision`` — Qwen-VL multimodal completion (OCR + diagram inspection)
* ``embed``  — Alibaba Cloud Text-Embedding vectors for AnalyticDB pgvector

The client speaks DashScope's OpenAI-compatible REST surface over ``httpx``
with bounded exponential-backoff retries, so no heavyweight SDK is required.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from functools import lru_cache
from typing import Any

import httpx

from config import EngineSettings, get_settings

logger = logging.getLogger(__name__)

_RETRYABLE_STATUS = {408, 409, 429, 500, 502, 503, 504}


class DashScopeClientError(RuntimeError):
    """Raised when a DashScope inference call ultimately fails."""


class APIKeyMissingError(DashScopeClientError):
    """Raised when QWEN_API_KEY is absent — a config fault, never retried."""


class DashScopeClient:
    """Async client for Alibaba Cloud DashScope (Qwen LLM / VL / Embeddings)."""

    def __init__(self, settings: EngineSettings | None = None) -> None:
        self.settings = settings or get_settings()

    # ------------------------------------------------------------------ #
    # Transport                                                          #
    # ------------------------------------------------------------------ #
    def _headers(self) -> dict[str, str]:
        if not self.settings.qwen_api_key:
            raise APIKeyMissingError(
                "QWEN_API_KEY is not configured — set it in nlp-engine/.env "
                "to reach Alibaba Cloud DashScope."
            )
        return {
            "Authorization": f"Bearer {self.settings.qwen_api_key}",
            "Content-Type": "application/json",
        }

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.settings.dashscope_base_url.rstrip('/')}/{path}"
        last_error: Exception | None = None
        for attempt in range(1, self.settings.llm_max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=self.settings.http_timeout_seconds
                ) as client:
                    response = await client.post(
                        url, headers=self._headers(), json=payload
                    )
                if response.status_code in _RETRYABLE_STATUS:
                    raise DashScopeClientError(
                        f"DashScope returned HTTP {response.status_code}: "
                        f"{response.text[:300]}"
                    )
                if response.status_code >= 400:
                    raise DashScopeClientError(
                        f"DashScope rejected request (HTTP {response.status_code}): "
                        f"{response.text[:500]}"
                    )
                return response.json()
            except APIKeyMissingError:
                raise  # configuration fault — retrying is pointless
            except (httpx.HTTPError, DashScopeClientError) as exc:
                last_error = exc
                if attempt >= self.settings.llm_max_retries:
                    break
                backoff = 2 ** (attempt - 1)
                logger.warning(
                    "DashScope call failed (attempt %d/%d): %s — retrying in %ds",
                    attempt,
                    self.settings.llm_max_retries,
                    exc,
                    backoff,
                )
                await asyncio.sleep(backoff)
        raise DashScopeClientError(f"DashScope call failed after retries: {last_error}")

    @staticmethod
    def _extract_content(body: dict[str, Any]) -> str:
        try:
            message = body["choices"][0]["message"]
            content = message["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise DashScopeClientError(
                f"Malformed DashScope response: {json.dumps(body)[:400]}"
            ) from exc
        if isinstance(content, list):  # multimodal responses
            return "".join(
                part.get("text", "") for part in content if isinstance(part, dict)
            )
        return str(content)

    # ------------------------------------------------------------------ #
    # Qwen-2.5 / Qwen-Plus text completion                               #
    # ------------------------------------------------------------------ #
    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        model: str | None = None,
        json_mode: bool = True,
        temperature: float | None = None,
        max_tokens: int = 2048,
    ) -> str:
        """Run a chat completion and return the raw assistant message text."""
        payload: dict[str, Any] = {
            "model": model or self.settings.qwen_llm_model,
            "messages": messages,
            "temperature": (
                temperature if temperature is not None else self.settings.llm_temperature
            ),
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        body = await self._post("chat/completions", payload)
        return self._extract_content(body)

    # ------------------------------------------------------------------ #
    # Qwen-VL multimodal completion                                      #
    # ------------------------------------------------------------------ #
    async def vision(
        self,
        prompt: str,
        image_urls: list[str],
        *,
        model: str | None = None,
        json_mode: bool = True,
        max_tokens: int = 2048,
    ) -> str:
        """Run a Qwen-VL completion over one or more scanned-sheet images."""
        content: list[dict[str, Any]] = [
            {"type": "image_url", "image_url": {"url": url}} for url in image_urls
        ]
        content.append({"type": "text", "text": prompt})
        payload: dict[str, Any] = {
            "model": model or self.settings.qwen_vl_model,
            "messages": [{"role": "user", "content": content}],
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        body = await self._post("chat/completions", payload)
        return self._extract_content(body)

    # ------------------------------------------------------------------ #
    # Alibaba Cloud Text-Embedding models                                #
    # ------------------------------------------------------------------ #
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts (≤25 per call) into pgvector-ready vectors."""
        vectors: list[list[float]] = []
        for start in range(0, len(texts), 25):
            batch = [text if text.strip() else " " for text in texts[start:start + 25]]
            body = await self._post(
                "embeddings",
                {
                    "model": self.settings.qwen_embedding_model,
                    "input": batch,
                    "encoding_format": "float",
                },
            )
            try:
                ordered = sorted(body["data"], key=lambda item: item["index"])
                vectors.extend([list(item["embedding"]) for item in ordered])
            except (KeyError, TypeError) as exc:
                raise DashScopeClientError(
                    f"Malformed embedding response: {json.dumps(body)[:300]}"
                ) from exc
        return vectors

    async def embed_one(self, text: str) -> list[float]:
        return (await self.embed([text]))[0]

    # ------------------------------------------------------------------ #
    # Connectivity probe (README quickstart healthcheck)                  #
    # ------------------------------------------------------------------ #
    async def healthcheck(self) -> bool:
        """Ping Qwen LLM with a trivial prompt; True when inference is live."""
        try:
            reply = await self.chat(
                [{"role": "user", "content": "Reply with the single word: OK"}],
                json_mode=False,
                max_tokens=8,
            )
            logger.info("DashScope healthcheck reply: %s", reply.strip())
            return bool(reply.strip())
        except DashScopeClientError as exc:
            logger.error("DashScope healthcheck failed: %s", exc)
            return False


@lru_cache(maxsize=1)
def get_dashscope_client() -> DashScopeClient:
    """Return the process-wide cached DashScope client singleton."""
    return DashScopeClient()


# ---------------------------------------------------------------------- #
# Robust strict-JSON extraction from LLM output                           #
# ---------------------------------------------------------------------- #
_CODE_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def extract_json(raw: str) -> Any:
    """Parse strict JSON out of an LLM reply, tolerating fences and prose.

    Strategy: direct parse → fenced block parse → first balanced ``{...}`` /
    ``[...]`` scan. Raises ``ValueError`` when no valid JSON is recoverable.
    """
    text = raw.strip()
    for candidate in [text, *_CODE_FENCE_RE.findall(text)]:
        try:
            return json.loads(candidate)
        except (json.JSONDecodeError, TypeError):
            continue
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        if start == -1:
            continue
        depth = 0
        for index in range(start, len(text)):
            if text[index] == opener:
                depth += 1
            elif text[index] == closer:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:index + 1])
                    except json.JSONDecodeError:
                        break
    raise ValueError(f"No valid JSON object found in LLM output: {text[:300]}")
