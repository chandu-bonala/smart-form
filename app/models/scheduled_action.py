from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ScheduledActionStatus, ScheduledActionType

if TYPE_CHECKING:
    from app.models.form import Form
    from app.models.user import User


class ScheduledAction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scheduled_actions"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type: Mapped[ScheduledActionType] = mapped_column(
        SAEnum(
            ScheduledActionType,
            name="scheduled_action_type",
            native_enum=False,
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        nullable=False,
    )
    status: Mapped[ScheduledActionStatus] = mapped_column(
        SAEnum(
            ScheduledActionStatus,
            name="scheduled_action_status",
            native_enum=False,
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        default=ScheduledActionStatus.PENDING,
        nullable=False,
        index=True,
    )
    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped[User] = relationship("User")
    form: Mapped[Form] = relationship("Form", back_populates="scheduled_actions")
