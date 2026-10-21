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
from app.utils.pdf_tools import (
    convert_image_to_pdf,
    is_image_content,
    is_pdf_content,
    split_pdf_pages,
)

logger = logging.getLogger(__name__)


class BatchIngestionError(RuntimeError):
    """Raised for validation or queue-dispatch failures during ingestion."""


def _is_redis_broker_available() -> bool:
    """Fast check whether Redis is listening on localhost:6379."""
    import socket
    try:
        with socket.create_connection(("127.0.0.1", 6379), timeout=0.3):
            return True
    except (OSError, TimeoutError):
        return False


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
        raise BatchIngestionError("At least one scanner PDF or image must be provided.")
    if len(files) > settings.max_batch_files:
        raise BatchIngestionError(
            f"Batch size exceeds the maximum of {settings.max_batch_files} files."
        )

    logger.info(
        "ingest_batch: starting processing for exam %s (user %s) with %d upload file(s).",
        exam.exam_id,
        user.user_id,
        len(files),
    )

    # 1) Read and validate every upload before persisting anything.
    payloads: list[tuple[str, list[bytes]]] = []
    for upload in files:
        data = await upload.read()
        logger.info(
            "ingest_batch: validating upload '%s' (%d bytes)...",
            upload.filename,
            len(data),
        )
        if len(data) > settings.max_upload_bytes:
            raise BatchIngestionError(
                f"File '{upload.filename}' exceeds the {settings.max_upload_bytes} byte limit."
            )
        if is_pdf_content(data):
            pages = split_pdf_pages(data)
        elif is_image_content(data, upload.filename or ""):
            logger.info(
                "ingest_batch: upload '%s' detected as image (%d bytes); converting to PDF format...",
                upload.filename,
                len(data),
            )
            pdf_bytes = convert_image_to_pdf(data, upload.filename or "image.png")
            pages = [pdf_bytes]
        else:
            raise BatchIngestionError(
                f"File '{upload.filename}' is not a valid PDF scanner export or supported image."
            )
        if not pages:
            raise BatchIngestionError(f"File '{upload.filename}' contains no readable pages.")
        logger.info(
            "ingest_batch: upload '%s' produced %d page(s).",
            upload.filename,
            len(pages),
        )
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
    logger.info("ingest_batch: created batch record %s.", batch.batch_id)

    # 3) Split pages into individual student papers and upload each to OSS.
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
    for filename, pages in payloads:
        for page_bytes in pages:
            global_index += 1
            seq += 1
            identifier = f"STU-2026-{seq:03d}"
            key = storage_service.build_key(
                "papers", exam.exam_id, f"paper_{global_index:03d}.pdf"
            )
            logger.info(
                "ingest_batch: saving paper %s (%d bytes) to storage key '%s'...",
                identifier,
                len(page_bytes),
                key,
            )
            url = await storage_service.put_object(
                key, page_bytes, "application/pdf"
            )
            if not url:
                raise BatchIngestionError(
                    f"Object storage returned no URL for paper {identifier}; "
                    "cannot ingest a sheet without a source document."
                )
            logger.info("ingest_batch: paper %s stored at '%s'.", identifier, url)
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
    logger.info(
        "ingest_batch: finished stage 1 for exam %s, total %d paper(s) created and queued.",
        exam.exam_id,
        len(created),
    )
    return batch, created


def dispatch_evaluation(paper_ids: list[UUID]) -> None:
    """Queue Celery tasks per paper (or execute in-process if Celery broker is offline)."""
    from app.workers.tasks import process_paper_task  # local import: Celery-free API boot

    logger.info("dispatch_evaluation: starting evaluation dispatch for %d paper(s)...", len(paper_ids))
    redis_active = _is_redis_broker_available()

    for paper_id in paper_ids:
        paper_id_str = str(paper_id)
        if redis_active:
            try:
                logger.info("dispatch_evaluation: dispatching paper %s to Celery worker queue...", paper_id_str)
                process_paper_task.delay(paper_id_str)
                logger.info("dispatch_evaluation: paper %s successfully queued in Celery.", paper_id_str)
                continue
            except Exception as exc:
                logger.warning(
                    "dispatch_evaluation: Celery dispatch failed (%s); falling back to in-process execution.",
                    exc,
                )

        logger.info(
            "dispatch_evaluation: executing paper %s in-process with identical 8-debugger pipeline...",
            paper_id_str,
        )
        try:
            result = process_paper_task.apply(args=[paper_id_str])
            logger.info(
                "dispatch_evaluation: paper %s in-process evaluation finished with status=%s.",
                paper_id_str,
                getattr(result, "result", result),
            )
        except Exception as exc:
            logger.exception("dispatch_evaluation: in-process evaluation failed for paper %s: %s", paper_id_str, exc)
            raise


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
