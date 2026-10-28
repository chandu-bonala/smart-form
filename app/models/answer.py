from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.question import Question
    from app.models.response import Response
    from app.models.upload import Upload


class Answer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "answers"

    response_id: Mapped[str] = mapped_column(ForeignKey("responses.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[str | None] = mapped_column(ForeignKey("questions.id", ondelete="SET NULL"), nullable=True, index=True)
    question_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    response: Mapped[Response] = relationship("Response", back_populates="answers")
    question: Mapped[Question | None] = relationship("Question", back_populates="answers")
    upload: Mapped[Upload | None] = relationship("Upload", back_populates="answer", cascade="all, delete-orphan", uselist=False)
