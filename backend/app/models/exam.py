"""`exams` table — graded exam sessions (PRD §3.B)."""

import enum
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExamStatus(str, enum.Enum):
    """Exam lifecycle: draft → processing (batch queued) → completed."""

    draft = "draft"
    processing = "processing"
    completed = "completed"


class Exam(Base):
    __tablename__ = "exams"

    exam_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    question_paper_url: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    sample_answer_url: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    status: Mapped[ExamStatus] = mapped_column(
        sa.Enum(ExamStatus, name="exam_status", native_enum=True),
        nullable=False,
        default=ExamStatus.draft,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
    )

    owner: Mapped["User"] = relationship(back_populates="exams")  # noqa: F821
    rubric: Mapped["Rubric | None"] = relationship(  # noqa: F821
        back_populates="exam", uselist=False, cascade="all, delete-orphan",
        lazy="selectin",
    )
    papers: Mapped[list["StudentPaper"]] = relationship(  # noqa: F821
        back_populates="exam", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Exam {self.exam_id} '{self.title}' status={self.status.value}>"
