"""add form hidden flag

Revision ID: 20260727_0002
Revises: 20260727_0001
Create Date: 2026-07-27
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260727_0002"
down_revision = "20260727_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("forms", sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column("forms", "is_hidden", server_default=None)


def downgrade() -> None:
    op.drop_column("forms", "is_hidden")
