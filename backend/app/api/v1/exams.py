"""Exam lifecycle contracts (PRD endpoints #3 dashboard / #4 setup / #5 rubric)."""

from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import can_view_cross_institution, get_current_user, get_owned_exam
from app.database import get_db
from app.models.exam import Exam, ExamStatus
from app.models.rubric import Rubric
from app.models.user import User
from app.schemas.exam import (
    ConceptItem,
    DashboardResponse,
    ExamListItem,
    ExamSetupResponse,
    GlobalMetrics,
    RubricUpdateRequest,
    RubricUpdateResponse,
)
from app.services.oss_storage import storage_service
from app.services.rubric_service import extract_concepts
from app.utils.pdf_tools import extract_text_or_decode

router = APIRouter()


@router.get(
    "/exams/list",
    response_model=DashboardResponse,
    summary="Dashboard metrics & recent exam logs",
)
async def list_exams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardResponse:
    """Global performance counters plus per-exam class summaries."""
    query = select(Exam).order_by(Exam.created_at.desc())
    if not can_view_cross_institution(current_user):
        query = query.where(Exam.user_id == current_user.user_id)
    exams = (await db.execute(query)).scalars().all()

    items: list[ExamListItem] = []
    total_checked = 0
    total_overrides = 0

    for exam in exams:
        papers = exam.papers
        evaluated_scores = [
            p.effective_score for p in papers if p.effective_score is not None
        ]
        total_checked += len(evaluated_scores)
        total_overrides += sum(
            1 for p in papers if p.teacher_override_score is not None
        )
        items.append(
            ExamListItem(
                exam_id=exam.exam_id,
                title=exam.title,
                date=exam.created_at.date(),
                class_size=len(papers),
                status=exam.status,
                class_average=(
                    round(sum(evaluated_scores) / len(evaluated_scores), 2)
                    if evaluated_scores
                    else None
                ),
                created_at=exam.created_at,
            )
        )

    overall_accuracy = (
        round((1 - total_overrides / total_checked) * 100, 1)
        if total_checked
        else 100.0
    )
    hours_saved = round(
        total_checked * settings.minutes_per_paper_manual / 60.0, 1
    )
    return DashboardResponse(
        global_metrics=GlobalMetrics(
            total_checked=total_checked,
            overall_accuracy=overall_accuracy,
            hours_saved=hours_saved,
        ),
        exams=items,
    )


@router.post(
    "/exam/setup",
    response_model=ExamSetupResponse,
    summary="Upload question paper + sample answer; auto-extract rubric",
)
async def exam_setup(
    exam_title: str = Form(min_length=2, max_length=255),
    question_file: UploadFile = File(...),
    sample_answer_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExamSetupResponse:
    """Create a draft exam, archive uploads to OSS and run Qwen-2.5 extraction."""
    question_bytes = await question_file.read()
    sample_bytes = await sample_answer_file.read()
    for name, payload in (
        (question_file.filename or "question", question_bytes),
        (sample_answer_file.filename or "sample", sample_bytes),
    ):
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uploaded file '{name}' is empty",
            )
        if len(payload) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Uploaded file '{name}' exceeds the size limit",
            )

    exam_id = uuid4()
    question_url = await storage_service.put_object(
        storage_service.build_key(
            "exams", exam_id, question_file.filename or "question_paper.pdf"
        ),
        question_bytes,
        storage_service.content_type_for(question_file.filename or "q.pdf"),
    )
    sample_url = await storage_service.put_object(
        storage_service.build_key(
            "exams", exam_id, sample_answer_file.filename or "sample_answer.pdf"
        ),
        sample_bytes,
        storage_service.content_type_for(sample_answer_file.filename or "s.pdf"),
    )

    question_text = extract_text_or_decode(
        question_bytes, question_file.filename or "q.pdf"
    )
    sample_text = extract_text_or_decode(
        sample_bytes, sample_answer_file.filename or "s.pdf"
    )
    concepts, synonyms_map = await extract_concepts(
        exam_title.strip(), question_text, sample_text
    )

    exam = Exam(
        exam_id=exam_id,
        user_id=current_user.user_id,
        title=exam_title.strip(),
        question_paper_url=question_url,
        sample_answer_url=sample_url,
        status=ExamStatus.draft,
    )
    rubric = Rubric(
        exam_id=exam_id,
        concepts_json={"concepts": concepts, "synonyms": synonyms_map},
    )
    db.add_all([exam, rubric])
    await db.flush()

    return ExamSetupResponse(
        exam_id=exam_id,
        extracted_concepts=[ConceptItem(**c) for c in concepts],
        synonyms=synonyms_map,
    )


@router.put(
    "/exam/rubric",
    response_model=RubricUpdateResponse,
    summary="Save teacher-customised rubric (keywords, weights, toggles)",
)
async def update_rubric(
    payload: RubricUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RubricUpdateResponse:
    """Upsert the rubric JSONB and sensitivity toggles for an exam."""
    exam = await get_owned_exam(db, payload.exam_id, current_user)

    concepts_payload = [c.model_dump() for c in payload.concepts]
    result = await db.execute(
        select(Rubric).where(Rubric.exam_id == exam.exam_id)
    )
    rubric = result.scalar_one_or_none()
    if rubric is None:
        rubric = Rubric(exam_id=exam.exam_id)
        db.add(rubric)

    existing_synonyms = rubric.synonyms
    rubric.concepts_json = {
        "concepts": concepts_payload,
        "synonyms": {
            keyword: existing_synonyms[keyword]
            for keyword in (c["keyword"] for c in concepts_payload)
            if keyword in existing_synonyms
        },
    }
    rubric.ignore_spelling = payload.ignore_spelling
    rubric.strict_order = payload.strict_order
    rubric.density_scoring = payload.density_scoring
    await db.flush()

    return RubricUpdateResponse(status="updated", rubric_id=rubric.rubric_id)
