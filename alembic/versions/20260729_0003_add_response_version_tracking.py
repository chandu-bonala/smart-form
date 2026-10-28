"""add response version tracking

Revision ID: 20260729_0003
Revises: 20260727_0002
Create Date: 2026-07-29
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260729_0003"
down_revision = "20260727_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("responses", sa.Column("form_version_id", sa.String(length=36), nullable=True))
    op.add_column("responses", sa.Column("form_version_number", sa.Integer(), nullable=True))
    op.create_index("ix_responses_form_version_id", "responses", ["form_version_id"])
    op.create_index("ix_responses_form_version_number", "responses", ["form_version_number"])
    op.create_foreign_key(
        "fk_responses_form_version_id_form_versions",
        "responses",
        "form_versions",
        ["form_version_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("answers", sa.Column("question_snapshot", sa.JSON(), nullable=True))
    op.alter_column("answers", "question_id", existing_type=sa.String(length=36), nullable=True)
    op.drop_constraint("answers_question_id_fkey", "answers", type_="foreignkey")
    op.create_foreign_key(
        "fk_answers_question_id_questions",
        "answers",
        "questions",
        ["question_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_answers_question_id_questions", "answers", type_="foreignkey")
    op.create_foreign_key(
        "answers_question_id_fkey",
        "answers",
        "questions",
        ["question_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.alter_column("answers", "question_id", existing_type=sa.String(length=36), nullable=False)
    op.drop_column("answers", "question_snapshot")

    op.drop_constraint("fk_responses_form_version_id_form_versions", "responses", type_="foreignkey")
    op.drop_index("ix_responses_form_version_number", table_name="responses")
    op.drop_index("ix_responses_form_version_id", table_name="responses")
    op.drop_column("responses", "form_version_number")
    op.drop_column("responses", "form_version_id")
