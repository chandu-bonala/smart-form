from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AnswerBase(BaseModel):
    question_id: str | None = None
    answer: str | None = None
    file_path: str | None = None


class AnswerCreate(BaseModel):
    question_id: str
    answer: str | None = None
    file_path: str | None = None


class AnswerRead(AnswerBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    response_id: str
    question_snapshot: dict | None = None
    created_at: datetime
    updated_at: datetime


class ResponseBase(BaseModel):
    form_id: str
    submitted_by: str | None = None
    respondent_email: str | None = None
    completion_time: float | None = None
    ip_address: str | None = None
    device: str | None = None
    browser: str | None = None


class ResponseCreate(ResponseBase):
    answers: list[AnswerCreate] = Field(default_factory=list)


class ResponseUpdate(BaseModel):
    completion_time: float | None = None
    ip_address: str | None = None
    device: str | None = None
    browser: str | None = None


class ResponseRead(ResponseBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    form_version_id: str | None = None
    form_version_number: int | None = None
    submitted_at: datetime
    answers: list[AnswerRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ResponseList(BaseModel):
    items: list[ResponseRead]
    total: int
