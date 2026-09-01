"""Add teacher-mapped ``student_name`` to ``student_papers``.

Revision ID: 0002_student_name
Revises: 0001_initial
Create Date: 2026-09-01

Supports the simplified teacher workflow: every auto-assigned identifier
(STU-2026-NNN) can carry a display name saved to the DB.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_student_name"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "student_papers",
        sa.Column("student_name", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("student_papers", "student_name")
