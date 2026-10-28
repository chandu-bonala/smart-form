"""add respondent_email to responses

Revision ID: 20260727_0001
Revises:
Create Date: 2026-07-27
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260727_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("responses", sa.Column("respondent_email", sa.String(length=255), nullable=True))
    op.create_index("ix_responses_respondent_email", "responses", ["respondent_email"])


def downgrade() -> None:
    op.drop_index("ix_responses_respondent_email", table_name="responses")
    op.drop_column("responses", "respondent_email")
