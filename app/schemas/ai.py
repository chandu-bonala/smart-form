from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AiMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AiChatRequest(BaseModel):
    message: str
    history: list[AiMessage] = Field(default_factory=list)
    form_id: str | None = None


class AiChatResponse(BaseModel):
    answer: str
    follow_up_questions: list[str] = Field(default_factory=list)
    suggested_actions: list[str] = Field(default_factory=list)
    tone: str | None = None


class AiFormQuestion(BaseModel):
    title: str
    question_type: str
    required: bool = True
    placeholder: str | None = None
    options: list[str] = Field(default_factory=list)
    validation: dict | None = None


class AiFormBuilderRequest(BaseModel):
    objective: str
    audience: str | None = None
    tone: str | None = None
    question_count: int = Field(default=6, ge=3, le=50)
    include_email: bool = False
    response_mode: str | None = None
    context: str | None = None


class AiFormBuilderResponse(BaseModel):
    title: str
    description: str
    rationale: str
    questions: list[AiFormQuestion] = Field(default_factory=list)
    suggested_tags: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)


class AiInsightMetric(BaseModel):
    label: str
    value: str
    detail: str | None = None


class AiAnalysisResponse(BaseModel):
    title: str
    overview: str
    deep_overview: str
    strengths: list[str] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    quick_wins: list[str] = Field(default_factory=list)
    metrics: list[AiInsightMetric] = Field(default_factory=list)
    next_questions: list[str] = Field(default_factory=list)
