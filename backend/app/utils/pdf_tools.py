"""PDF utilities: text extraction and per-page splitting for ADF batches.

Uses PyMuPDF (fitz) for fast in-memory manipulation of scanner PDFs.
"""

import io
import re

import pymupdf as fitz  # PyMuPDF

PDF_MIME = "application/pdf"

_ROLL_PATTERNS = (
    re.compile(r"roll\s*(?:no|number)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9_\-/]*)", re.IGNORECASE),
    re.compile(r"student\s*(?:id|identifier)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9_\-/]*)", re.IGNORECASE),
    re.compile(r"reg(?:istration)?\s*(?:no|number)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9_\-/]*)", re.IGNORECASE),
)


def is_pdf_content(data: bytes) -> bool:
    """Cheap magic-number check for PDF payloads."""
    return data[:5] == b"%PDF-"


def extract_text_from_pdf(data: bytes) -> str:
    """Concatenated text layer of every page (empty for pure image scans)."""
    if not is_pdf_content(data):
        return ""
    with fitz.open(stream=data, filetype="pdf") as doc:
        return "\n".join(page.get_text("text") for page in doc).strip()


def extract_text_or_decode(data: bytes, filename: str) -> str:
    """Best-effort text extraction for setup uploads (PDF or plain text)."""
    if is_pdf_content(data):
        return extract_text_from_pdf(data)
    lowered = filename.lower()
    if lowered.endswith((".txt", ".md", ".csv", ".text")):
        return data.decode("utf-8", errors="ignore").strip()
    # Unknown binary payload — nothing extractable client-side.
    return ""


def split_pdf_pages(data: bytes) -> list[bytes]:
    """Split an ADF batch PDF into one single-page PDF per student script."""
    pages: list[bytes] = []
    with fitz.open(stream=data, filetype="pdf") as doc:
        for index in range(doc.page_count):
            single = fitz.open()
            single.insert_pdf(doc, from_page=index, to_page=index)
            buffer = io.BytesIO()
            single.save(buffer)
            single.close()
            pages.append(buffer.getvalue())
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
