from __future__ import annotations

import json
from datetime import datetime, date
from typing import Any

from app.models.enums import QuestionType
from app.schemas.response import AnswerCreate


class FieldValidator:
    """Validates individual field values based on field configuration."""

    @staticmethod
    def validate_email(value: str | None) -> bool:
        if value is None:
            return True
        import re
        pattern = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
        return bool(re.match(pattern, value.strip()))

    @staticmethod
    def validate_phone(value: str | None) -> bool:
        if value is None:
            return True
        import re
        pattern = r"^[0-9+()\-\s]{7,20}$"
        return bool(re.match(pattern, value.strip()))

    @staticmethod
    def validate_url(value: str | None) -> bool:
        if value is None:
            return True
        import re
        pattern = r"^https?://"
        return bool(re.match(pattern, value.strip()))

    @staticmethod
    def validate_number(value: str | None, validation_config: dict | None = None) -> bool:
        if value is None:
            return True
        try:
            num = float(value)
            if validation_config:
                if "min_value" in validation_config and num < validation_config["min_value"]:
                    return False
                if "max_value" in validation_config and num > validation_config["max_value"]:
                    return False
            return True
        except (ValueError, TypeError):
            return False

    @staticmethod
    def validate_date(value: str | None, validation_config: dict | None = None) -> bool:
        if value is None:
            return True
        try:
            date_obj = datetime.strptime(value, "%Y-%m-%d").date()
            if validation_config:
                if "min_date" in validation_config:
                    min_date = datetime.strptime(validation_config["min_date"], "%Y-%m-%d").date()
                    if date_obj < min_date:
                        return False
                if "max_date" in validation_config:
                    max_date = datetime.strptime(validation_config["max_date"], "%Y-%m-%d").date()
                    if date_obj > max_date:
                        return False
            return True
        except (ValueError, TypeError):
            return False

    @staticmethod
    def validate_string_length(value: str | None, validation_config: dict | None = None) -> bool:
        if value is None:
            return True
        length = len(value)
        if validation_config:
            if "min_length" in validation_config and length < validation_config["min_length"]:
                return False
            if "max_length" in validation_config and length > validation_config["max_length"]:
                return False
        return True

    @staticmethod
    def validate_dropdown_member(value: str | None, options: list[str]) -> bool:
        if value is None:
            return True
        return value in options

    @staticmethod
    def validate_multi_member(value: str | None, options: list[str]) -> bool:
        if value is None:
            return True
        try:
            parsed = json.loads(value)
            values = parsed if isinstance(parsed, list) else [value]
        except (TypeError, json.JSONDecodeError):
            values = [item.strip() for item in value.split(",") if item.strip()]
        return all(str(item) in options for item in values)

    @staticmethod
    def validate_field(
        field_type: str,
        value: str | None,
        validation_config: dict | None = None,
        options: list[str] | None = None,
    ) -> tuple[bool, str | None]:
        """
        Validate a field value based on type and configuration.
        Returns (is_valid, error_message)
        """
        if value is None or (isinstance(value, str) and value.strip() == ""):
            return True, None

        validators = {
            QuestionType.EMAIL: (FieldValidator.validate_email, ()),
            QuestionType.PHONE: (FieldValidator.validate_phone, ()),
            QuestionType.URL: (FieldValidator.validate_url, ()),
            QuestionType.NUMBER: (FieldValidator.validate_number, (validation_config,)),
            QuestionType.DATE: (FieldValidator.validate_date, (validation_config,)),
            QuestionType.SHORT_TEXT: (FieldValidator.validate_string_length, (validation_config,)),
            QuestionType.PARAGRAPH: (FieldValidator.validate_string_length, (validation_config,)),
            QuestionType.DROPDOWN: (FieldValidator.validate_dropdown_member, (options,)),
            QuestionType.RADIO: (FieldValidator.validate_dropdown_member, (options,)),
            QuestionType.CHECKBOX: (FieldValidator.validate_multi_member, (options,)),
        }

        if field_type not in validators:
            return True, None

        validator, args = validators[field_type]
        try:
            is_valid = validator(value, *args)
            if not is_valid:
                return False, f"Invalid {field_type.lower()} format or value out of range"
            return True, None
        except Exception as e:
            return False, f"Validation error: {str(e)}"
