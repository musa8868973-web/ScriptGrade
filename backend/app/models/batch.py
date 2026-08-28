"""`batch_uploads` table — tracks bulk scanner ingestion batches (PRD endpoint #6)."""

import enum
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BatchStatus(str, enum.Enum):
    """Aggregated state of all papers in a batch upload."""

    processing = "processing"
    completed = "completed"
    failed = "failed"


class BatchUpload(Base):
    __tablename__ = "batch_uploads"

    batch_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, default=uuid.uuid4
    )
    exam_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("exams.exam_id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    source_filename: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    source_url: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    total_papers: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, default=0
    )
    processed_papers: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, default=0
    )
    status: Mapped[BatchStatus] = mapped_column(
        sa.Enum(BatchStatus, name="batch_status", native_enum=True),
        nullable=False,
        default=BatchStatus.processing,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<BatchUpload {self.batch_id} {self.processed_papers}/"
            f"{self.total_papers} {self.status.value}>"
        )
