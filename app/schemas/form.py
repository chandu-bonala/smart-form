from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import FormStatus
from app.schemas.conditional_rule import ConditionalRuleRead
from app.schemas.question_branch import QuestionBranchRead
from app.schemas.question import QuestionRead


class FormBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    theme: dict | None = None
    status: FormStatus = FormStatus.DRAFT
    is_public: bool = False
    is_hidden: bool = False
    allow_multiple_responses: bool = False
    collect_email: bool = False
    start_date: date | None = None
    end_date: date | None = None
    qr_code: str | None = None


class FormCreate(FormBase):
    owner_id: str
    form_slug: str | None = None


class FormUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    theme: dict | None = None
    status: FormStatus | None = None
    is_public: bool | None = None
    is_hidden: bool | None = None
    allow_multiple_responses: bool | None = None
    collect_email: bool | None = None
    start_date: date | None = None
    end_date: date | None = None
    form_slug: str | None = None
    qr_code: str | None = None


class ShareForm(BaseModel):
    emails: list[EmailStr]
    url: str = Field(min_length=1)
    subject: str | None = None
    message: str | None = None


class FormRead(FormBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    form_slug: str
    questions: list[QuestionRead] = Field(default_factory=list)
    branches: list[QuestionBranchRead] = Field(default_factory=list)
    conditional_rules: list[ConditionalRuleRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class FormList(BaseModel):
    items: list[FormRead]
    total: int
