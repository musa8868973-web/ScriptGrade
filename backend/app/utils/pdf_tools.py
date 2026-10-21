"""PDF utilities: text extraction and per-page splitting for ADF batches.

Uses PyMuPDF (fitz) for fast in-memory manipulation of scanner PDFs.
"""

import io
import logging
import re
from pathlib import Path

import pymupdf as fitz  # PyMuPDF

logger = logging.getLogger(__name__)

PDF_MIME = "application/pdf"

_ROLL_PATTERNS = (
    re.compile(r"roll\s*(?:no|number)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9_\-/]*)", re.IGNORECASE),
    re.compile(r"student\s*(?:id|identifier)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9_\-/]*)", re.IGNORECASE),
    re.compile(r"reg(?:istration)?\s*(?:no|number)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9_\-/]*)", re.IGNORECASE),
)

_IMAGE_MAGIC = (
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpeg"),
    (b"RIFF", "webp"),
    (b"GIF87a", "gif"),
    (b"GIF89a", "gif"),
    (b"BM", "bmp"),
)


def is_pdf_content(data: bytes) -> bool:
    """Cheap magic-number check for PDF payloads."""
    return bool(data and data[:5] == b"%PDF-")


def is_image_content(data: bytes, filename: str = "") -> bool:
    """Check if byte payload or file extension corresponds to a standard image."""
    if not data:
        return False
    for magic, _ in _IMAGE_MAGIC:
        if data.startswith(magic):
            return True
    ext = Path(filename).suffix.lower()
    return ext in (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tiff")


def convert_image_to_pdf(data: bytes, filename: str = "image.png") -> bytes:
    """Convert a single image (PNG/JPG/WEBP) into a single-page PDF document."""
    ext = Path(filename).suffix.lower().lstrip(".") or "png"
    if ext == "jpg":
        ext = "jpeg"
    logger.info("Converting %s image (%d bytes) to PDF format via PyMuPDF...", ext, len(data))
    try:
        with fitz.open(stream=data, filetype=ext) as img_doc:
            pdf_bytes = img_doc.convert_to_pdf()
            logger.info("Successfully converted image to PDF (%d bytes).", len(pdf_bytes))
            return pdf_bytes
    except Exception as exc:
        logger.error("Failed converting image to PDF with filetype=%s: %s", ext, exc)
        # Fallback attempt without specifying filetype
        with fitz.open(stream=data) as img_doc:
            pdf_bytes = img_doc.convert_to_pdf()
            return pdf_bytes


def extract_text_from_pdf(data: bytes) -> str:
    """Concatenated text layer of every page (empty for pure image scans)."""
    if not is_pdf_content(data):
        logger.debug("extract_text_from_pdf: payload is not PDF, returning empty string.")
        return ""
    try:
        with fitz.open(stream=data, filetype="pdf") as doc:
            extracted = "\n".join(page.get_text("text") for page in doc).strip()
            logger.info(
                "extract_text_from_pdf: %d page(s) processed, extracted %d character(s) of text.",
                doc.page_count,
                len(extracted),
            )
            return extracted
    except Exception as exc:
        logger.warning("extract_text_from_pdf failed: %s", exc)
        return ""


def extract_text_or_decode(data: bytes, filename: str) -> str:
    """Best-effort text extraction for setup uploads (PDF or plain text)."""
    if is_pdf_content(data):
        return extract_text_from_pdf(data)
    lowered = filename.lower()
    if lowered.endswith((".txt", ".md", ".csv", ".text")):
        return data.decode("utf-8", errors="ignore").strip()
    return ""


def split_pdf_pages(data: bytes) -> list[bytes]:
    """Split an ADF batch PDF into one single-page PDF per student script."""
    pages: list[bytes] = []
    logger.info("split_pdf_pages: starting page split for PDF (%d bytes)...", len(data))
    with fitz.open(stream=data, filetype="pdf") as doc:
        logger.info("split_pdf_pages: PDF contains %d page(s).", doc.page_count)
        for index in range(doc.page_count):
            single = fitz.open()
            single.insert_pdf(doc, from_page=index, to_page=index)
            buffer = io.BytesIO()
            single.save(buffer)
            single.close()
            pages.append(buffer.getvalue())
    logger.info("split_pdf_pages: split into %d single-page document(s).", len(pages))
    return pages


def detect_student_identifier(page_bytes: bytes) -> str | None:
    """Try to read a roll number / student id annotation from a page."""
    with fitz.open(stream=page_bytes, filetype="pdf") as doc:
        for page in doc:
            text = page.get_text("text")
            for pattern in _ROLL_PATTERNS:
                match = pattern.search(text)
                if match:
                    return match.group(1).strip()
    return None
