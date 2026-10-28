"""add scheduled actions

Revision ID: 20260812_0005_add_scheduled_actions
Revises: 20260810_0004_add_question_branches
Create Date: 2026-08-12 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260812_0005_add_scheduled_actions"
down_revision = "20260810_0004_add_question_branches"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scheduled_actions",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("owner_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("form_id", sa.String(length=36), sa.ForeignKey("forms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_scheduled_actions_owner_id"), "scheduled_actions", ["owner_id"], unique=False)
    op.create_index(op.f("ix_scheduled_actions_form_id"), "scheduled_actions", ["form_id"], unique=False)
    op.create_index(op.f("ix_scheduled_actions_status"), "scheduled_actions", ["status"], unique=False)
    op.create_index(op.f("ix_scheduled_actions_run_at"), "scheduled_actions", ["run_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_scheduled_actions_run_at"), table_name="scheduled_actions")
    op.drop_index(op.f("ix_scheduled_actions_status"), table_name="scheduled_actions")
    op.drop_index(op.f("ix_scheduled_actions_form_id"), table_name="scheduled_actions")
    op.drop_index(op.f("ix_scheduled_actions_owner_id"), table_name="scheduled_actions")
    op.drop_table("scheduled_actions")
