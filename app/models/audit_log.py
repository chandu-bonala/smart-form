from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class AuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Stores audit trail of sensitive operations."""
    __tablename__ = "audit_logs"

    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(255), nullable=False, index=True)  # create_form, delete_response, etc.
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)  # form, response, user, etc.
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON description of change
    ip_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
