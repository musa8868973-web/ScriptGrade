"""`student_papers` table — evaluated answer scripts + 8-debugger diagnostics (PRD §3.D)."""

import enum
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PaperStatus(str, enum.Enum):
    """Evaluation lifecycle for a single answer script."""

    queued = "queued"
    processing = "processing"
    evaluated = "evaluated"
    failed = "failed"


class StudentPaper(Base):
    __tablename__ = "student_papers"
    __table_args__ = (
        sa.Index("ix_student_papers_exam_student", "exam_id", "student_identifier"),
    )

    paper_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, default=uuid.uuid4
    )
    exam_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("exams.exam_id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("batch_uploads.batch_id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    student_identifier: Mapped[str] = mapped_column(sa.String(128), nullable=False)
    scanned_image_url: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    ocr_transcript: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    ocr_confidence: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    word_count: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    total_score: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    max_score: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    is_flagged: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, default=False, server_default=sa.false()
    )
    # Full 8-module diagnostic report (garbage text, negation, synonyms, fuzzy
    # spelling, sequence DAG, visual inspection, density, rubric aggregation).
    diagnostic_logs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    teacher_override_score: Mapped[float | None] = mapped_column(
        sa.Float, nullable=True
    )
    moderation_note: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    status: Mapped[PaperStatus] = mapped_column(
        sa.Enum(PaperStatus, name="paper_status", native_enum=True),
        nullable=False,
        default=PaperStatus.queued,
    )
    evaluated_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )

    exam: Mapped["Exam"] = relationship(back_populates="papers")  # noqa: F821

    @property
    def effective_score(self) -> float | None:
        """Teacher override always wins over the automated score."""
        return (
            self.teacher_override_score
            if self.teacher_override_score is not None
            else self.total_score
        )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<StudentPaper {self.student_identifier} exam={self.exam_id}>"
