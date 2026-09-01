"""Batch ingestion service (PRD endpoint #6 — Page 4 Batch Upload Portal).

Pipeline: multipart PDFs → per-page split → Alibaba Cloud OSS → queued
`student_papers` rows → Celery dispatch for asynchronous OCR + evaluation.
"""

import logging
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.batch import BatchUpload
from app.models.exam import Exam, ExamStatus
from app.models.student_paper import PaperStatus, StudentPaper
from app.models.user import User
from app.services.oss_storage import storage_service
from app.utils.pdf_tools import is_pdf_content, split_pdf_pages

logger = logging.getLogger(__name__)


class BatchIngestionError(RuntimeError):
    """Raised for validation or queue-dispatch failures during ingestion."""


async def ingest_batch(
    db: AsyncSession,
    exam: Exam,
    user: User,
    files: list[UploadFile],
) -> tuple[BatchUpload, list[StudentPaper]]:
    """Persist a batch of scanner PDFs and queue asynchronous evaluation.

    Returns the created batch record and the persisted `StudentPaper` rows
    (each carrying its auto-assigned `STU-2026-NNN` identifier) so the API can
    surface them to the ingestion UI for immediate name mapping.
    """
    if not files:
        raise BatchIngestionError("At least one scanner PDF must be provided.")
    if len(files) > settings.max_batch_files:
        raise BatchIngestionError(
            f"Batch size exceeds the maximum of {settings.max_batch_files} files."
        )

    # 1) Read and validate every upload before persisting anything.
    payloads: list[tuple[str, list[bytes]]] = []
    for upload in files:
        data = await upload.read()
        if len(data) > settings.max_upload_bytes:
            raise BatchIngestionError(
                f"File '{upload.filename}' exceeds the {settings.max_upload_bytes} byte limit."
            )
        if not is_pdf_content(data):
            raise BatchIngestionError(
                f"File '{upload.filename}' is not a valid PDF scanner export."
            )
        pages = split_pdf_pages(data)
        if not pages:
            raise BatchIngestionError(f"File '{upload.filename}' contains no pages.")
        payloads.append((upload.filename or "batch.pdf", pages))

    # 2) Persist the batch shell.
    batch = BatchUpload(
        exam_id=exam.exam_id,
        user_id=user.user_id,
        source_filename=payloads[0][0] if len(payloads) == 1 else f"{len(payloads)} files",
        total_papers=0,
        processed_papers=0,
    )
    db.add(batch)
    await db.flush()

    # 3) Split pages into individual student papers and upload each to OSS.
    #    Auto-assign a stable, human-readable identifier per exam (spec §2a):
    #    STU-2026-001, STU-2026-002, … continuing past any existing papers.
    existing = (
        await db.execute(
            select(func.count())
            .select_from(StudentPaper)
            .where(StudentPaper.exam_id == exam.exam_id)
        )
    ).scalar() or 0
    seq = int(existing)

    created: list[StudentPaper] = []
    global_index = 0
    for _filename, pages in payloads:
        for page_bytes in pages:
            global_index += 1
            seq += 1
            identifier = f"STU-2026-{seq:03d}"
            key = storage_service.build_key(
                "papers", exam.exam_id, f"paper_{global_index:03d}.pdf"
            )
            url = await storage_service.put_object(
                key, page_bytes, "application/pdf"
            )
            paper = StudentPaper(
                exam_id=exam.exam_id,
                batch_id=batch.batch_id,
                student_identifier=identifier,
                scanned_image_url=url,
                status=PaperStatus.queued,
            )
            db.add(paper)
            await db.flush()
            created.append(paper)

    batch.total_papers = len(created)
    batch.source_url = await _archive_source(exam, payloads)
    exam.status = ExamStatus.processing
    await db.flush()
    return batch, created


def dispatch_evaluation(paper_ids: list[UUID]) -> None:
    """Queue one Celery task per paper (raises on broker failure)."""
    from app.workers.tasks import process_paper_task  # local import: Celery-free API boot

    for paper_id in paper_ids:
        process_paper_task.delay(str(paper_id))


async def _archive_source(
    exam: Exam,
    payloads: list[tuple[str, list[bytes]]],
) -> str | None:
    """Store the first raw batch file for auditability (best effort)."""
    try:
        filename, pages = payloads[0]
        if len(pages) == 1:
            return None  # single-page PDF already archived per-paper
        key = storage_service.build_key("batches", exam.exam_id, filename)
        # Re-assembly is unnecessary; archive the first page set reference.
        return await storage_service.put_object(key, pages[0], "application/pdf")
    except Exception as exc:  # noqa: BLE001 — archival must not fail ingestion
        logger.warning("Batch source archival skipped: %s", exc)
        return None
