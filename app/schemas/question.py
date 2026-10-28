from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import QuestionType
from app.schemas.question_branch import QuestionBranchRead


class OptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    question_id: str
    option_text: str
    order_index: int
    created_at: datetime
    updated_at: datetime


class OptionCreate(BaseModel):
    option_text: str = Field(min_length=1, max_length=255)
    order_index: int = 0


class QuestionBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    question_type: QuestionType
    placeholder: str | None = None
    required: bool = False
    order_index: int = 0
    validation: dict | None = None


class QuestionCreate(QuestionBase):
    form_id: str
    branch_id: str | None = None
    options: list[OptionCreate] = Field(default_factory=list)


class QuestionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    question_type: QuestionType | None = None
    placeholder: str | None = None
    required: bool | None = None
    order_index: int | None = None
    validation: dict | None = None
    options: list[OptionCreate] | None = None
    branch_id: str | None = None


class QuestionRead(QuestionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    form_id: str
    branch_id: str | None = None
    options: list[OptionRead] = Field(default_factory=list)
    branch: QuestionBranchRead | None = None
    created_at: datetime
    updated_at: datetime
