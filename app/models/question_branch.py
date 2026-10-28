from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.form import Form
    from app.models.question import Question


class QuestionBranch(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "question_branches"

    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger_question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger_option_text: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    form: Mapped[Form] = relationship("Form", back_populates="branches")
    trigger_question: Mapped[Question] = relationship("Question", foreign_keys=[trigger_question_id], viewonly=True)
    questions: Mapped[list[Question]] = relationship(
        "Question",
        back_populates="branch",
        foreign_keys="[Question.branch_id]",
        primaryjoin="QuestionBranch.id == Question.branch_id",
        cascade="all, delete-orphan",
        order_by="Question.order_index",
    )
