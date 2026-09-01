"""Analytics contracts (PRD endpoint #9 CSV/PDF export + #10 summary charts)."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_owned_exam
from app.database import get_db
from app.models.rubric import Rubric
from app.models.student_paper import StudentPaper
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsSummary,
    ConceptMasteryStat,
    DebuggerStat,
)
from app.services.export_service import build_csv_bytes, build_pdf_bytes

router = APIRouter()


def _aggregator_missed(diag: dict) -> bool:
    rows = diag.get("rubric_breakdown") or []
    return any(
        float(r.get("max") or 0) > 0
        and float(r.get("awarded") or 0) < float(r.get("max") or 0)
        for r in rows
        if isinstance(r, dict)
    )


# (key, diagnostic blob, human label, "raised its signal" predicate) — the
# eight debugger error parameters surfaced on the Analytics breakdown chart.
_DEBUGGER_SIGNALS: tuple[tuple[str, str, str, object], ...] = (
    ("garbage", "I_garbage_text", "Garbage / padding", lambda d: bool(d.get("flagged"))),
    ("negation", "II_negation_detection", "Negation reversal", lambda d: bool(d.get("negation_detected"))),
    ("synonym", "III_synonym_match", "Synonym gap", lambda d: not bool(d.get("synonym_matched"))),
    ("spelling", "IV_spelling_correction", "Spelling corrected", lambda d: bool(d.get("corrections"))),
    ("sequence", "V_sequence_dag", "Sequence breakage", lambda d: not bool(d.get("sequence_match", True))),
    ("vision", "VI_diagram_visual", "Diagram unverified", lambda d: not bool(d.get("diagram_verified"))),
    ("density", "VII_density_scorer", "Low density (fluff)", lambda d: bool(d.get("flagged"))),
    ("aggregator", "VIII_rubric_aggregator", "Concept missed", _aggregator_missed),
)


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


@router.get(
    "/analytics/summary",
    response_model=AnalyticsSummary,
    summary="Chart-ready class analytics for one exam (single-subject view)",
)
async def get_analytics_summary(
    exam_id: UUID = Query(..., description="Exam to aggregate"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsSummary:
    """Aggregate every evaluated paper's 8-debugger JSONB into Analytics charts.

    Surfaces (a) per-question concept mastery + class average and (b) the
    eight-debugger error-parameter breakdown for the whole class.
    """
    exam = await get_owned_exam(db, exam_id, current_user)
    papers = list(
        (
            await db.execute(
                select(StudentPaper).where(StudentPaper.exam_id == exam.exam_id)
            )
        )
        .scalars()
        .all()
    )
    rubric = (
        await db.execute(select(Rubric).where(Rubric.exam_id == exam.exam_id))
    ).scalar_one_or_none()

    evaluated = [p for p in papers if p.diagnostic_logs]
    scored = [p for p in evaluated if p.effective_score is not None]

    max_score = float(rubric.max_score) if rubric is not None else 0.0
    if max_score <= 0:
        max_score = max((p.max_score or 0.0 for p in evaluated), default=0.0)
    if max_score <= 0:
        max_score = 10.0

    class_average = (
        round(sum(p.effective_score for p in scored) / len(scored), 2)
        if scored
        else 0.0
    )

    # Score distribution across five percentage bands (0–20 … 80–100).
    bands = [0, 0, 0, 0, 0]
    for p in scored:
        pct = (p.effective_score / max_score) * 100 if max_score else 0.0
        idx = min(4, int(pct // 20))
        bands[idx] += 1

    # Per-question (concept) mastery, seeded from the rubric for stable order.
    agg: dict[str, dict] = {}
    order: list[str] = []
    if rubric is not None:
        for c in rubric.concepts:
            kw = str(c.get("keyword", "")).strip()
            if kw and kw not in agg:
                agg[kw] = {
                    "awarded_sum": 0.0,
                    "full": 0,
                    "max": float(c.get("weight") or 0),
                    "n": 0,
                }
                order.append(kw)
    for p in evaluated:
        breakdown = (p.diagnostic_logs or {}).get(
            "VIII_rubric_aggregator", {}
        ).get("rubric_breakdown") or []
        for row in breakdown:
            if not isinstance(row, dict):
                continue
            kw = str(row.get("concept", "")).strip()
            if not kw:
                continue
            awarded = float(row.get("awarded") or 0)
            mx = float(row.get("max") or 0)
            slot = agg.get(kw)
            if slot is None:
                slot = {"awarded_sum": 0.0, "full": 0, "max": mx, "n": 0}
                agg[kw] = slot
                order.append(kw)
            slot["awarded_sum"] += awarded
            slot["n"] += 1
            slot["max"] = max(slot["max"], mx)
            if mx > 0 and awarded >= mx:
                slot["full"] += 1

    concept_mastery = [
        ConceptMasteryStat(
            concept=kw,
            awarded=round(agg[kw]["awarded_sum"] / (agg[kw]["n"] or 1), 2),
            max=round(agg[kw]["max"], 1),
            mastery_pct=round(agg[kw]["full"] / (agg[kw]["n"] or 1) * 100, 1),
        )
        for kw in order
    ]

    total = len(evaluated)
    debugger_breakdown: list[DebuggerStat] = []
    for key, blob, label, predicate in _DEBUGGER_SIGNALS:
        count = sum(
            1
            for p in evaluated
            if predicate(((p.diagnostic_logs or {}).get(blob) or {}))
        )
        debugger_breakdown.append(
            DebuggerStat(
                key=key,
                label=label,
                count=count,
                total=total,
                rate=round(count / total * 100, 1) if total else 0.0,
            )
        )

    return AnalyticsSummary(
        exam_id=exam.exam_id,
        title=exam.title,
        total_papers=len(papers),
        scored_papers=len(scored),
        max_score=round(max_score, 2),
        class_average=class_average,
        score_distribution=bands,
        concept_mastery=concept_mastery,
        debugger_breakdown=debugger_breakdown,
    )
