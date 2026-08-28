"""Analytics export contract (PRD endpoint #9 — CSV/PDF class reports)."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_owned_exam
from app.database import get_db
from app.models.student_paper import StudentPaper
from app.models.user import User
from app.services.export_service import build_csv_bytes, build_pdf_bytes

router = APIRouter()


@router.get(
    "/analytics/export",
    summary="Download class performance report (CSV or PDF)",
    responses={
        200: {
            "content": {"text/csv": {}, "application/pdf": {}},
            "description": "Binary report stream",
        }
    },
)
async def export_analytics(
    exam_id: UUID = Query(..., description="Exam to export"),
    format: str = Query("csv", pattern="^(csv|pdf)$", description="csv | pdf"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Stream a downloadable class performance report for the exam."""
    exam = await get_owned_exam(db, exam_id, current_user)

    result = await db.execute(
        select(StudentPaper)
        .where(StudentPaper.exam_id == exam.exam_id)
        .options(selectinload(StudentPaper.exam))
        .order_by(StudentPaper.student_identifier)
    )
    papers = list(result.scalars().all())

    slug = "".join(ch if ch.isalnum() else "_" for ch in exam.title)[:60] or "exam"

    if format == "pdf":
        payload = build_pdf_bytes(exam, papers)
        return Response(
            content=payload,
            media_type="application/pdf",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="scriptgrade_{slug}_report.pdf"'
                )
            },
        )

    payload = build_csv_bytes(exam, papers)
    return Response(
        content=payload,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="scriptgrade_{slug}_report.csv"'
            )
        },
    )
