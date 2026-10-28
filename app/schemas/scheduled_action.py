from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import ScheduledActionStatus, ScheduledActionType


class ScheduledActionBase(BaseModel):
    action_type: ScheduledActionType
    run_at: datetime
    payload: dict = Field(default_factory=dict)


class ScheduledActionCreate(ScheduledActionBase):
    owner_id: str
    form_id: str


class ScheduledActionRead(ScheduledActionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    form_id: str
    status: ScheduledActionStatus
    error_message: str | None = None
    executed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ScheduledActionList(BaseModel):
    items: list[ScheduledActionRead]
    total: int


class SchedulePublishForm(BaseModel):
    run_at: datetime = Field(description="When the form should be published")


class ScheduleShareForm(BaseModel):
    run_at: datetime = Field(description="When the email should be sent")
    emails: list[EmailStr]
    url: str = Field(min_length=1)
    subject: str | None = None
    message: str | None = None
