"""Student paper contracts (PRD endpoints #6 batch-upload / #7 detail / #8 override)."""

from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import can_view_cross_institution, get_current_user, get_owned_exam
from app.database import get_db
from app.models.exam import Exam
from app.models.student_paper import PaperStatus, StudentPaper
from app.models.user import User
from app.schemas.paper import (
    BatchUploadResponse,
    OverrideRequest,
    OverrideResponse,
    PaperDetailResponse,
    PaperIdentityRequest,
    PaperIdentityResponse,
    PaperQueueResponse,
    QueuePaper,
    QueuedPaperRef,
)
from app.services.batch_service import (
    BatchIngestionError,
    dispatch_evaluation,
    ingest_batch,
)

router = APIRouter()

# Backend PaperStatus → Frontend PRD §1.3 UI state (queue feed is consumed
# verbatim by the ingestion page, which performs no status translation).
_UI_STATUS: dict[PaperStatus, str] = {
    PaperStatus.queued: "queued",
    PaperStatus.processing: "ocr_in_progress",
    PaperStatus.evaluated: "evaluated",
    PaperStatus.failed: "needs_review",
}


async def _resolve_paper(
    db: AsyncSession, student_id: str, user: User, exam_id: UUID | None = None
) -> StudentPaper:
    """Resolve a paper by paper UUID or by student roll-no/identifier.

    ``STU-2026-NNN`` identifiers are unique only WITHIN an exam, so an
    identifier lookup is scoped to ``exam_id`` when supplied — otherwise a
    freshly-uploaded paper can resolve to a same-numbered row from a previous
    exam (breaking the ID↔name mapping and Studio routing, spec §2b/§3).
    """
    try:
        paper_uuid = UUID(student_id)
        query = select(StudentPaper).where(StudentPaper.paper_id == paper_uuid)
    except ValueError:
        query = (
            select(StudentPaper)
            .join(Exam, Exam.exam_id == StudentPaper.exam_id)
            .where(func.lower(StudentPaper.student_identifier) == student_id.lower())
        )
        if exam_id is not None:
            query = query.where(StudentPaper.exam_id == exam_id)
        if not can_view_cross_institution(user):
            query = query.where(Exam.user_id == user.user_id)
        query = query.order_by(StudentPaper.evaluated_at.desc().nullslast())

    paper = (await db.execute(query)).scalars().first()
    if paper is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student paper not found",
        )

    exam = await db.get(Exam, paper.exam_id)
    if (
        exam is not None
        and exam.user_id != user.user_id
        and not can_view_cross_institution(user)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this paper",
        )
    return paper


@router.post(
    "/papers/batch-upload",
    response_model=BatchUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Bulk scanner upload → OSS → async Celery evaluation",
)
async def batch_upload(
    exam_id: UUID = Form(...),
    batch_pdf_file: UploadFile | None = File(default=None),
    files: list[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BatchUploadResponse:
    """Accept ADF scanner PDFs and queue asynchronous OCR + grading."""
    exam = await get_owned_exam(db, exam_id, current_user)

    uploads: list[UploadFile] = [f for f in (batch_pdf_file, *files) if f is not None]
    if not uploads:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide scanner PDFs via 'batch_pdf_file' or 'files'",
        )

    try:
        batch, papers = await ingest_batch(db, exam, current_user, uploads)
    except BatchIngestionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Commit before dispatch so Celery workers can see the queued rows.
    await db.commit()

    paper_ids = [p.paper_id for p in papers]
    try:
        dispatch_evaluation(paper_ids)
    except Exception as exc:  # noqa: BLE001 — broker outage is a 503
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Task queue unavailable; batch stored but not dispatched",
        ) from exc

    return BatchUploadResponse(
        batch_id=batch.batch_id,
        total_papers=batch.total_papers,
        status="processing",
        papers=[
            QueuedPaperRef(id=p.paper_id, student_id=p.student_identifier)
            for p in papers
        ],
    )


@router.get(
    "/papers/queue",
    response_model=PaperQueueResponse,
    summary="Poll live grading progress for every paper in an exam",
)
async def get_paper_queue(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaperQueueResponse:
    """Frontend PRD §5.3 polling contract driving the ingestion progress feed.

    Declared before ``/papers/{student_id}`` so the literal ``queue`` path is
    not captured by the student-id route.
    """
    exam = await get_owned_exam(db, exam_id, current_user)
    papers = (
        await db.execute(
            select(StudentPaper)
            .where(StudentPaper.exam_id == exam.exam_id)
            .order_by(StudentPaper.student_identifier)
        )
    ).scalars().all()
    return PaperQueueResponse(
        exam_id=exam.exam_id,
        papers=[
            QueuePaper(
                id=paper.paper_id,
                student_id=paper.student_identifier,
                student_name=paper.student_name,
                status=_UI_STATUS.get(paper.status, "queued"),
                score=paper.effective_score,
                max_score=paper.max_score if paper.max_score is not None else 10.0,
            )
            for paper in papers
        ],
    )


@router.get(
    "/papers/{student_id}",
    response_model=PaperDetailResponse,
    summary="Full evaluation breakdown + 8-debugger diagnostics",
)
async def get_paper_detail(
    student_id: str,
    exam_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaperDetailResponse:
    """OCR transcript, score, diagnostics and override state for one paper.

    ``exam_id`` disambiguates ``STU-2026-NNN`` identifiers that recur across
    exams; a raw paper UUID resolves regardless.
    """
    paper = await _resolve_paper(db, student_id, current_user, exam_id)
    return PaperDetailResponse(
        student_id=paper.student_identifier,
        student_name=paper.student_name,
        paper_id=paper.paper_id,
        exam_id=paper.exam_id,
        score=paper.effective_score,
        max_score=paper.max_score,
        status=paper.status.value,
        ocr_confidence=paper.ocr_confidence,
        ocr_transcript=paper.ocr_transcript,
        word_count=paper.word_count,
        evaluated_at=paper.evaluated_at,
        is_flagged=paper.is_flagged,
        diagnostics=paper.diagnostic_logs or {},
        teacher_override={
            "applied": paper.teacher_override_score is not None,
            "override_score": paper.teacher_override_score,
            "moderation_note": paper.moderation_note,
        },
    )


@router.post(
    "/papers/{student_id}/override",
    response_model=OverrideResponse,
    summary="Teacher manual score override + moderation note",
)
async def override_paper_score(
    student_id: str,
    payload: OverrideRequest,
    exam_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OverrideResponse:
    """Apply a manual score; class analytics recompute live from the DB."""
    paper = await _resolve_paper(db, student_id, current_user, exam_id)
    if paper.max_score is not None and payload.new_score > paper.max_score:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"new_score cannot exceed the exam max of {paper.max_score}"
            ),
        )

    paper.teacher_override_score = payload.new_score
    paper.moderation_note = payload.moderation_note
    await db.flush()

    return OverrideResponse(status="override_applied", updated_score=payload.new_score)


@router.patch(
    "/papers/{student_id}/identity",
    response_model=PaperIdentityResponse,
    summary="Map a display name onto an auto-assigned student id",
)
async def set_paper_identity(
    student_id: str,
    payload: PaperIdentityRequest,
    exam_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaperIdentityResponse:
    """Persist the teacher's ID↔name mapping to the DB (workflow spec §2b).

    ``student_id`` accepts the paper UUID (returned by batch-upload) or the
    auto-assigned ``STU-2026-NNN`` identifier; pass ``exam_id`` when using the
    latter so it cannot match a same-numbered paper from another exam.
    """
    paper = await _resolve_paper(db, student_id, current_user, exam_id)
    name = payload.student_name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="student_name cannot be blank",
        )
    paper.student_name = name[:255]
    await db.flush()

    return PaperIdentityResponse(
        paper_id=paper.paper_id,
        student_id=paper.student_identifier,
        student_name=paper.student_name,
    )
