"""Alibaba Cloud OSS object storage gateway (async, zero-extra-dependency).

Implements the OSS REST `PUT`/`GET` protocol with HMAC-SHA1 request signing.
When OSS credentials are not configured the service transparently falls back
to a local filesystem bucket so the pipeline remains fully functional in
development environments.
"""

import base64
import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timezone
from email.utils import formatdate
from pathlib import Path
from typing import Final

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_VERB_TO_CONTENT_TYPE: Final[dict[str, str]] = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "txt": "text/plain",
    "csv": "text/csv",
}


class StorageError(RuntimeError):
    """Raised when an object storage operation fails unrecoverably."""


class ObjectStorageService:
    """Async PUT/GET/URL facade over Alibaba Cloud OSS."""

    def __init__(self) -> None:
        self._configured: bool = bool(
            settings.oss_access_key_id and settings.oss_access_key_secret
        )
        self._local_root = Path(settings.local_storage_dir).resolve()
        self._endpoint_host = settings.oss_endpoint.replace("https://", "").replace(
            "http://", ""
        ).rstrip("/")

    # ------------------------------------------------------------------ API

    async def put_object(self, key: str, data: bytes, content_type: str) -> str:
        """Persist an object and return its canonical URL."""
        if not self._configured:
            return self._put_local(key, data)
        date_header = formatdate(timeval=None, usegmt=True)
        signature = self._sign("PUT", key, date_header, content_type)
        url = self._signed_url(key)
        headers = {
            "Date": date_header,
            "Content-Type": content_type,
            "Authorization": f"OSS {settings.oss_access_key_id}:{signature}",
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.put(url, content=data, headers=headers)
        if response.status_code >= 300:
            logger.error("OSS PUT failed key=%s status=%s", key, response.status_code)
            raise StorageError(
                f"OSS upload failed with status {response.status_code}"
            )
        return self._public_url(key)

    async def get_object(self, url: str) -> bytes:
        """Download an object by its stored URL (OSS or local fallback)."""
        if url.startswith("local://"):
            return self._get_local(url)
        key = self._key_from_url(url)
        if not self._configured or key is None:
            raise StorageError(f"Cannot resolve object for URL: {url}")
        date_header = formatdate(timeval=None, usegmt=True)
        signature = self._sign("GET", key, date_header, "")
        headers = {
            "Date": date_header,
            "Authorization": f"OSS {settings.oss_access_key_id}:{signature}",
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(self._signed_url(key), headers=headers)
        if response.status_code >= 300:
            raise StorageError(
                f"OSS download failed with status {response.status_code}"
            )
        return response.content

    async def delete_object(self, url: str) -> None:
        """Best-effort object deletion (used by moderation cleanups)."""
        if url.startswith("local://"):
            path = self._local_root / url[len("local://"):]
            path.unlink(missing_ok=True)
            return
        key = self._key_from_url(url)
        if not self._configured or key is None:
            return
        date_header = formatdate(timeval=None, usegmt=True)
        signature = self._sign("DELETE", key, date_header, "")
        headers = {
            "Date": date_header,
            "Authorization": f"OSS {settings.oss_access_key_id}:{signature}",
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            await client.delete(self._signed_url(key), headers=headers)

    def build_key(self, namespace: str, exam_id: uuid.UUID, filename: str) -> str:
        """Deterministic, collision-free object key."""
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
        return f"{namespace}/{stamp}/{exam_id}/{uuid.uuid4().hex}_{filename}"

    def content_type_for(self, filename: str, default: str = "application/octet-stream") -> str:
        suffix = Path(filename).suffix.lstrip(".").lower()
        return _VERB_TO_CONTENT_TYPE.get(suffix, default)

    # ------------------------------------------------------------- signing

    def _sign(self, verb: str, key: str, date_header: str, content_type: str) -> str:
        """OSS V1 signature: base64(hmac-sha1(secret, string-to-sign))."""
        resource = f"/{settings.oss_bucket_name}/{key}"
        string_to_sign = f"{verb}\n\n{content_type}\n{date_header}\n{resource}"
        digest = hmac.new(
            settings.oss_access_key_secret.encode("utf-8"),
            string_to_sign.encode("utf-8"),
            hashlib.sha1,
        ).digest()
        return base64.b64encode(digest).decode("ascii")

    def _signed_url(self, key: str) -> str:
        return f"https://{settings.oss_bucket_name}.{self._endpoint_host}/{key}"

    def _public_url(self, key: str) -> str:
        if settings.oss_public_base_url:
            return f"{settings.oss_public_base_url.rstrip('/')}/{key}"
        return self._signed_url(key)

    def _key_from_url(self, url: str) -> str | None:
        marker = f"/{settings.oss_bucket_name}/"
        if marker in url:
            return url.split(marker, 1)[1]
        if settings.oss_public_base_url and url.startswith(settings.oss_public_base_url):
            return url[len(settings.oss_public_base_url.rstrip("/")) + 1 :]
        return None

    # ------------------------------------------------------ local fallback

    def _put_local(self, key: str, data: bytes) -> str:
        path = self._local_root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"local://{key}"

    def _get_local(self, url: str) -> bytes:
        path = self._local_root / url[len("local://"):]
        if not path.exists():
            raise StorageError(f"Local object missing: {url}")
        return path.read_bytes()


storage_service = ObjectStorageService()
