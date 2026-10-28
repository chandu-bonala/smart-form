from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FormVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    form_id: str
    version_number: int
    schema_snapshot: dict
    is_published: bool
    created_at: datetime
    updated_at: datetime


class FormVersionList(BaseModel):
    items: list[FormVersionRead]
    total: int
