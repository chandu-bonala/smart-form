from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.form import Form
    from app.models.question import Question


class ConditionalRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Stores conditional logic rules for forms."""
    __tablename__ = "conditional_rules"

    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger_field_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    trigger_operator: Mapped[str] = mapped_column(String(50), nullable=False)  # equals, not_equals, contains, greater_than, is_empty
    trigger_value: Mapped[str] = mapped_column(String(500), nullable=True)  # Comparison value
    target_field_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    target_action: Mapped[str] = mapped_column(String(50), nullable=False)  # show, hide, require

    form: Mapped[Form] = relationship("Form", back_populates="conditional_rules")
    trigger_field: Mapped[Question] = relationship("Question", foreign_keys=[trigger_field_id], viewonly=True)
    target_field: Mapped[Question] = relationship("Question", foreign_keys=[target_field_id], viewonly=True)
