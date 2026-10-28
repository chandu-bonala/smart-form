"""add question branches

Revision ID: 20260810_0004
Revises: 20260729_0003
Create Date: 2026-08-10
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260810_0004"
down_revision = "20260729_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "question_branches",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("form_id", sa.String(length=36), nullable=False),
        sa.Column("trigger_question_id", sa.String(length=36), nullable=False),
        sa.Column("trigger_option_text", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["form_id"], ["forms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["trigger_question_id"], ["questions.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_question_branches_form_id", "question_branches", ["form_id"])
    op.create_index("ix_question_branches_trigger_question_id", "question_branches", ["trigger_question_id"])

    op.add_column("questions", sa.Column("branch_id", sa.String(length=36), nullable=True))
    op.create_index("ix_questions_branch_id", "questions", ["branch_id"])
    op.create_foreign_key(
        "fk_questions_branch_id_question_branches",
        "questions",
        "question_branches",
        ["branch_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_questions_branch_id_question_branches", "questions", type_="foreignkey")
    op.drop_index("ix_questions_branch_id", table_name="questions")
    op.drop_column("questions", "branch_id")

    op.drop_index("ix_question_branches_trigger_question_id", table_name="question_branches")
    op.drop_index("ix_question_branches_form_id", table_name="question_branches")
    op.drop_table("question_branches")
