from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Enum as SAEnum, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import FormStatus

if TYPE_CHECKING:
    from app.models.conditional_rule import ConditionalRule
    from app.models.form_version import FormVersion
    from app.models.question import Question
    from app.models.question_branch import QuestionBranch
    from app.models.scheduled_action import ScheduledAction
    from app.models.response import Response
    from app.models.user import User


class Form(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "forms"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    theme: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[FormStatus] = mapped_column(
        SAEnum(
            FormStatus,
            name="form_status",
            native_enum=False,
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        default=FormStatus.DRAFT,
        nullable=False,
    )
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allow_multiple_responses: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    collect_email: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    form_slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    qr_code: Mapped[str | None] = mapped_column(String(500), nullable=True)

    owner: Mapped[User] = relationship("User", back_populates="forms")
    questions: Mapped[list[Question]] = relationship(
        "Question", back_populates="form", cascade="all, delete-orphan", order_by="Question.order_index"
    )
    branches: Mapped[list[QuestionBranch]] = relationship(
        "QuestionBranch", back_populates="form", cascade="all, delete-orphan", order_by="QuestionBranch.order_index"
    )
    responses: Mapped[list[Response]] = relationship("Response", back_populates="form", cascade="all, delete-orphan")
    versions: Mapped[list[FormVersion]] = relationship("FormVersion", back_populates="form", cascade="all, delete-orphan")
    conditional_rules: Mapped[list[ConditionalRule]] = relationship("ConditionalRule", back_populates="form", cascade="all, delete-orphan")
    scheduled_actions: Mapped[list[ScheduledAction]] = relationship(
        "ScheduledAction", back_populates="form", cascade="all, delete-orphan"
    )
