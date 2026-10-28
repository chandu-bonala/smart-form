from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import QuestionType

if TYPE_CHECKING:
    from app.models.answer import Answer
    from app.models.form import Form
    from app.models.option import Option
    from app.models.question_branch import QuestionBranch


class Question(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "questions"

    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id: Mapped[str | None] = mapped_column(ForeignKey("question_branches.id", ondelete="CASCADE"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    question_type: Mapped[QuestionType] = mapped_column(
        SAEnum(
            QuestionType,
            name="question_type",
            native_enum=False,
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        default=QuestionType.SHORT_TEXT,
        nullable=False,
    )
    placeholder: Mapped[str | None] = mapped_column(String(255), nullable=True)
    required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    validation: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    form: Mapped[Form] = relationship("Form", back_populates="questions")
    branch: Mapped[QuestionBranch | None] = relationship(
        "QuestionBranch",
        back_populates="questions",
        foreign_keys=[branch_id],
        primaryjoin="Question.branch_id == QuestionBranch.id",
    )
    options: Mapped[list[Option]] = relationship(
        "Option", back_populates="question", cascade="all, delete-orphan", order_by="Option.order_index"
    )
    answers: Mapped[list[Answer]] = relationship("Answer", back_populates="question", passive_deletes=True)
