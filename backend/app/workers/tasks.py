"""Celery tasks: asynchronous per-paper OCR + 8-debugger evaluation (Page 4/5).

Each queued `student_papers` row is processed here:
  1. Download the scanned page from Alibaba Cloud OSS.
  2. Transcribe it with Qwen-VL (fallback: embedded PDF text layer).
  3. Evaluate the transcript against the exam rubric (8 diagnostic modules).
  4. Persist scores + diagnostic JSONB and advance batch/exam lifecycle.
"""

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.celery_app import celery
from app.models.batch import BatchStatus, BatchUpload
from app.models.exam import Exam, ExamStatus
from app.models.rubric import Rubric
from app.models.student_paper import PaperStatus, StudentPaper
from app.services.ai_client import OCRResult, ai_client
from app.services.evaluation import Toggles, VisualEvidence, evaluate_answer
from app.services.oss_storage import storage_service
from app.utils.pdf_tools import extract_text_from_pdf
from app.workers.database import worker_session

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Execute an async coroutine from the synchronous Celery worker."""
    return asyncio.run(coro)


def _transcribe(page_bytes: bytes) -> OCRResult:
    """Qwen-VL OCR with a deterministic text-layer fallback."""
    if ai_client.is_configured:
        try:
            return _run_async(ai_client.ocr_image(page_bytes, "application/pdf"))
        except Exception as exc:  # noqa: BLE001 — degrade, never crash the batch
            logger.warning("Qwen-VL OCR failed (%s); using PDF text layer.", exc)
    transcript = extract_text_from_pdf(page_bytes)
    return OCRResult(
        transcript=transcript,
        confidence=90.0 if transcript else 0.0,
        diagram_present=False,
        visual_elements=[],
    )


def _advance_batch(session: Session, batch: BatchUpload, exam: Exam) -> None:
    """Increment processed counter and finalise batch/exam when complete."""
    batch.processed_papers += 1
    if batch.processed_papers >= batch.total_papers:
        batch.status = BatchStatus.completed

    remaining = session.execute(
        select(StudentPaper.paper_id).where(
            StudentPaper.exam_id == exam.exam_id,
            StudentPaper.status.in_(
                [PaperStatus.queued, PaperStatus.processing]
            ),
        )
    ).first()
    if remaining is None:
        exam.status = ExamStatus.completed


@celery.task(name="scriptgrade.process_paper", bind=True, max_retries=2)
def process_paper_task(self, paper_id: str) -> dict[str, str]:
    """Evaluate one student paper end-to-end."""
    with worker_session() as session:
        paper = session.get(StudentPaper, UUID(paper_id))
        if paper is None:
            logger.error("Paper %s vanished before processing.", paper_id)
            return {"status": "missing"}

        exam = session.get(Exam, paper.exam_id)
        rubric = session.execute(
            select(Rubric).where(Rubric.exam_id == paper.exam_id)
        ).scalar_one_or_none()
        if exam is None or rubric is None:
            paper.status = PaperStatus.failed
            paper.diagnostic_logs = {
                "error": "Exam or rubric missing at evaluation time."
            }
            return {"status": "failed", "reason": "missing-rubric"}

        paper.status = PaperStatus.processing
        session.flush()

        try:
            page_bytes = _run_async(storage_service.get_object(paper.scanned_image_url))
            ocr = _transcribe(page_bytes)
            result = evaluate_answer(
                transcript=ocr.transcript,
                concepts=rubric.concepts,
                synonyms_map=rubric.synonyms,
                toggles=Toggles(
                    ignore_spelling=rubric.ignore_spelling,
                    strict_order=rubric.strict_order,
                    density_scoring=rubric.density_scoring,
                ),
                visual=VisualEvidence(
                    diagram_present=ocr.diagram_present,
                    confidence=ocr.confidence,
                    elements=ocr.visual_elements,
                ),
                ocr_confidence=ocr.confidence,
            )
            paper.ocr_transcript = ocr.transcript
            paper.ocr_confidence = ocr.confidence
            paper.word_count = result.word_count
            paper.total_score = result.total_score
            paper.max_score = result.max_score
            paper.is_flagged = result.is_flagged
            paper.diagnostic_logs = result.diagnostics
            paper.status = PaperStatus.evaluated
            paper.evaluated_at = datetime.now(timezone.utc)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Paper %s evaluation failed.", paper_id)
            paper.status = PaperStatus.failed
            paper.diagnostic_logs = {"error": str(exc)[:500]}
            if paper.batch_id:
                batch = session.get(BatchUpload, paper.batch_id)
                if batch is not None:
                    _advance_batch(session, batch, exam)
            return {"status": "failed", "reason": str(exc)[:200]}

        if paper.batch_id:
            batch = session.get(BatchUpload, paper.batch_id)
            if batch is not None:
                _advance_batch(session, batch, exam)

    return {"status": "evaluated", "paper_id": paper_id}
