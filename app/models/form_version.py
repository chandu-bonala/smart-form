from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.form import Form
    from app.models.response import Response


class FormVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Stores frozen snapshots of published forms."""
    __tablename__ = "form_versions"

    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    schema_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)  # Frozen questions & options
    is_published: Mapped[bool] = mapped_column(default=True, nullable=False)

    form: Mapped[Form] = relationship("Form", back_populates="versions")
    responses: Mapped[list[Response]] = relationship("Response", back_populates="form_version")
