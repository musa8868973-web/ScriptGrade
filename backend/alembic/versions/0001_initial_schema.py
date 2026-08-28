"""Initial ScriptGrade schema (users, exams, rubrics, student_papers, batch_uploads).

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.database import Base

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ENUMS = ("paper_status", "batch_status", "exam_status", "user_role")


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
    for enum_name in _ENUMS:
        bind.execute(sa.text(f"DROP TYPE IF EXISTS {enum_name}"))
