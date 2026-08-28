"""`rubrics` table — magic concepts, weights, synonyms and sensitivity toggles (PRD §3.C).

`concepts_json` is JSONB shaped as:

    {
      "concepts":  [{"keyword": "Sunlight", "weight": 3}, ...],
      "synonyms":  {"Sunlight": ["solar energy"], ...}
    }
"""

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Rubric(Base):
    __tablename__ = "rubrics"
    __table_args__ = (
        sa.UniqueConstraint("exam_id", name="uq_rubrics_exam_id"),
    )

    rubric_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, default=uuid.uuid4
    )
    exam_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("exams.exam_id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    concepts_json: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    # Flaw #4 mitigation — Levenshtein auto-correction at >=85% similarity.
    ignore_spelling: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, default=True, server_default=sa.true()
    )
    # Flaw #5 mitigation — DAG procedural-order enforcement.
    strict_order: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, default=False, server_default=sa.false()
    )
    # Flaw #7 mitigation — anti-fluff information density normalisation.
    density_scoring: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, default=True, server_default=sa.true()
    )

    exam: Mapped["Exam"] = relationship(back_populates="rubric")  # noqa: F821

    @property
    def concepts(self) -> list[dict]:
        return list(self.concepts_json.get("concepts", []))

    @property
    def synonyms(self) -> dict[str, list[str]]:
        return dict(self.concepts_json.get("synonyms", {}))

    @property
    def max_score(self) -> float:
        """Maximum achievable marks = sum of all concept weights."""
        return float(sum(float(c.get("weight", 0)) for c in self.concepts))

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Rubric {self.rubric_id} exam={self.exam_id}>"
