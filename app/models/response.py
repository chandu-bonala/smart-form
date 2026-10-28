from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin, utcnow

if TYPE_CHECKING:
    from app.models.answer import Answer
    from app.models.form import Form
    from app.models.form_version import FormVersion
    from app.models.user import User


class Response(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "responses"

    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    form_version_id: Mapped[str | None] = mapped_column(ForeignKey("form_versions.id", ondelete="SET NULL"), nullable=True, index=True)
    form_version_number: Mapped[int | None] = mapped_column(nullable=True, index=True)
    submitted_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    respondent_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    completion_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    device: Mapped[str | None] = mapped_column(String(100), nullable=True)
    browser: Mapped[str | None] = mapped_column(String(100), nullable=True)

    form: Mapped[Form] = relationship("Form", back_populates="responses")
    form_version: Mapped[FormVersion | None] = relationship("FormVersion", back_populates="responses")
    submitted_user: Mapped[User | None] = relationship("User", back_populates="responses")
    answers: Mapped[list[Answer]] = relationship("Answer", back_populates="response", cascade="all, delete-orphan")
