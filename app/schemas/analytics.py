from __future__ import annotations

from datetime import date
from datetime import datetime

from pydantic import BaseModel


class CountItem(BaseModel):
    label: str
    value: int


class TopFormItem(CountItem):
    id: str


class TimeSeriesPoint(BaseModel):
    date: date
    count: int


class AnalyticsDashboard(BaseModel):
    total_forms: int
    total_responses: int
    active_forms: int
    draft_forms: int
    completion_rate: float
    average_completion_time: float
    daily_responses: list[TimeSeriesPoint]
    monthly_responses: list[TimeSeriesPoint]
    top_forms: list[TopFormItem]
    device_statistics: list[CountItem]
    browser_statistics: list[CountItem]


class UserAnalytics(BaseModel):
    total_users: int
    verified_users: int
    admin_users: int
    active_users: int


class OptionAnalytics(BaseModel):
    option: str
    count: int
    percentage: float


class QuestionAnalytics(BaseModel):
    question_id: str
    title: str
    question_type: str
    total_answers: int
    skipped: int
    options: list[OptionAnalytics] = []
    text_answers: list[str] = []
    average_rating: float | None = None


class ResponseAnswerDetail(BaseModel):
    question_id: str
    question_title: str
    question_type: str
    answer: str | None = None
    values: list[str] = []


class ResponseDetail(BaseModel):
    id: str
    respondent_label: str
    respondent_email: str | None = None
    submitted_by: str | None = None
    submitted_at: datetime
    completion_time: float | None = None
    device: str | None = None
    browser: str | None = None
    answers: list[ResponseAnswerDetail]


class FormAnalytics(BaseModel):
    form_id: str
    title: str
    total_questions: int
    total_responses: int
    average_completion_time: float
    completion_rate: float
    daily_responses: list[TimeSeriesPoint]
    questions: list[QuestionAnalytics]
    responses: list[ResponseDetail]
