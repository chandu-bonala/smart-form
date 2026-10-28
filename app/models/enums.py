from __future__ import annotations

from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"


class FormStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ScheduledActionType(str, Enum):
    PUBLISH_FORM = "publish_form"
    SEND_EMAIL = "send_email"


class ScheduledActionStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ConditionType(str, Enum):
    AND = "AND"
    OR = "OR"


class QuestionType(str, Enum):
    SHORT_TEXT = "short_text"
    PARAGRAPH = "paragraph"
    EMAIL = "email"
    PHONE = "phone"
    NUMBER = "number"
    DATE = "date"
    TIME = "time"
    DROPDOWN = "dropdown"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    RATING = "rating"
    YES_NO = "yes_no"
    FILE_UPLOAD = "file_upload"
    URL = "url"
    PASSWORD = "password"
    SIGNATURE = "signature"
    SECTION_TITLE = "section_title"
    IMAGE = "image"
