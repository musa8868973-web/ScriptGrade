"""Class performance report renderer (PDF) built on ReportLab."""

import io
from dataclasses import dataclass
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


@dataclass(frozen=True, slots=True)
class ReportRow:
    """One graded student row for the export report."""

    student_identifier: str
    score: float | None
    max_score: float | None
    percentage: float | None
    is_flagged: bool
    overridden: bool
    evaluated_at: str


def render_pdf_report(
    exam_title: str,
    rows: list[ReportRow],
    summary: dict[str, float | int],
) -> bytes:
    """Render a downloadable class performance PDF as raw bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        title=f"ScriptGrade Report — {exam_title}",
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )
    styles = getSampleStyleSheet()
    story: list = [
        Paragraph("ScriptGrade — Class Performance Report", styles["Title"]),
        Paragraph(f"Exam: {exam_title}", styles["Heading2"]),
        Paragraph(
            f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            styles["Normal"],
        ),
        Spacer(1, 6 * mm),
        Paragraph(
            "Students: {students} | Evaluated: {evaluated} | Class average: {average} | "
            "Flagged: {flagged} | Overrides: {overrides}".format(**summary),
            styles["Normal"],
        ),
        Spacer(1, 8 * mm),
    ]

    header = [
        "Student",
        "Score",
        "Max",
        "%",
        "Flagged",
        "Override",
        "Evaluated At",
    ]
    data: list[list[str]] = [header]
    for row in rows:
        data.append(
            [
                row.student_identifier,
                f"{row.score:.1f}" if row.score is not None else "—",
                f"{row.max_score:.1f}" if row.max_score is not None else "—",
                f"{row.percentage:.1f}" if row.percentage is not None else "—",
                "Yes" if row.is_flagged else "No",
                "Yes" if row.overridden else "No",
                row.evaluated_at,
            ]
        )

    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
                ("ALIGN", (1, 0), (3, -1), "RIGHT"),
                ("ALIGN", (4, 0), (5, -1), "CENTER"),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    return buffer.getvalue()
