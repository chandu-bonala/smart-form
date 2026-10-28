from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class QuestionBranchBase(BaseModel):
    form_id: str
    trigger_question_id: str
    trigger_option_text: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    order_index: int = 0


class QuestionBranchCreate(QuestionBranchBase):
    pass


class QuestionBranchUpdate(BaseModel):
    trigger_option_text: str | None = Field(default=None, min_length=1, max_length=255)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    order_index: int | None = None


class QuestionBranchRead(QuestionBranchBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
