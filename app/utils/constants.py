from __future__ import annotations

from app.models.enums import QuestionType

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
DEFAULT_UPLOAD_MAX_MB = 10
DEFAULT_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".pdf", ".doc", ".docx", ".txt"}
QUESTION_TYPE_VALUES = {question_type.value for question_type in QuestionType}
