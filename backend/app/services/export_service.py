"""Class performance export service (PRD endpoint #9 — CSV / PDF streams)."""

import csv
import io
from datetime import datetime, timezone

from app.models.exam import Exam
from app.models.student_paper import StudentPaper
from app.utils.reports import ReportRow, render_pdf_report

_CSV_COLUMNS = (
    "student_identifier",
    "automated_score",
    "override_score",
    "effective_score",
    "max_score",
    "percentage",
    "is_flagged",
    "evaluated_at",
    "moderation_note",
)


def _percentage(score: float | None, max_score: float | None) -> float | None:
    if score is None or not max_score:
        return None
    return round(score / max_score * 100, 2)


def _fmt_when(value: datetime | None) -> str:
    return value.strftime("%Y-%m-%d %H:%M UTC") if value else ""


def build_summary(papers: list[StudentPaper]) -> dict[str, float | int]:
    """Aggregate counters shared by the CSV and PDF renderers."""
    evaluated = [p for p in papers if p.effective_score is not None]
    scores = [p.effective_score for p in evaluated]  # type: ignore[list-item]
    average = round(sum(scores) / len(scores), 2) if scores else 0.0
    return {
        "students": len(papers),
        "evaluated": len(evaluated),
        "average": average,
        "flagged": sum(1 for p in papers if p.is_flagged),
        "overrides": sum(1 for p in papers if p.teacher_override_score is not None),
    }


def build_report_rows(papers: list[StudentPaper]) -> list[ReportRow]:
    """Convert ORM rows into renderer-ready records."""
    return [
        ReportRow(
            student_identifier=paper.student_identifier,
            score=paper.effective_score,
            max_score=paper.max_score,
            percentage=_percentage(paper.effective_score, paper.max_score),
            is_flagged=paper.is_flagged,
            overridden=paper.teacher_override_score is not None,
            evaluated_at=_fmt_when(paper.evaluated_at),
        )
        for paper in sorted(papers, key=lambda p: p.student_identifier)
    ]


def build_csv_bytes(exam: Exam, papers: list[StudentPaper]) -> bytes:
    """Render the class performance report as UTF-8 CSV bytes."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([f"ScriptGrade Class Report — {exam.title}"])
    writer.writerow([f"Generated,{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"])
    summary = build_summary(papers)
    writer.writerow(
        [
            "Students", summary["students"],
            "Evaluated", summary["evaluated"],
            "Class average", summary["average"],
            "Flagged", summary["flagged"],
            "Overrides", summary["overrides"],
        ]
    )
    writer.writerow([])
    writer.writerow(_CSV_COLUMNS)
    for paper in sorted(papers, key=lambda p: p.student_identifier):
        writer.writerow(
            [
                paper.student_identifier,
                paper.total_score if paper.total_score is not None else "",
                paper.teacher_override_score if paper.teacher_override_score is not None else "",
                paper.effective_score if paper.effective_score is not None else "",
                paper.max_score if paper.max_score is not None else "",
                _percentage(paper.effective_score, paper.max_score) or "",
                paper.is_flagged,
                _fmt_when(paper.evaluated_at),
                paper.moderation_note or "",
            ]
        )
    return buffer.getvalue().encode("utf-8-sig")


def build_pdf_bytes(exam: Exam, papers: list[StudentPaper]) -> bytes:
    """Render the class performance report as PDF bytes (ReportLab)."""
    return render_pdf_report(
        exam_title=exam.title,
        rows=build_report_rows(papers),
        summary=build_summary(papers),
    )
