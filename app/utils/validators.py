from __future__ import annotations

import os
import re
from pathlib import Path

from app.utils.constants import DEFAULT_ALLOWED_EXTENSIONS

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_REGEX = re.compile(r"^[0-9+()\-\s]{7,20}$")
URL_REGEX = re.compile(r"^https?://")


def is_valid_email(value: str) -> bool:
    return bool(EMAIL_REGEX.match(value.strip()))


def is_valid_phone(value: str) -> bool:
    return bool(PHONE_REGEX.match(value.strip()))


def is_valid_url(value: str) -> bool:
    return bool(URL_REGEX.match(value.strip()))


def is_allowed_upload(filename: str) -> bool:
    suffix = Path(filename).suffix.lower()
    return suffix in DEFAULT_ALLOWED_EXTENSIONS


def get_file_size(path: str) -> int:
    return os.path.getsize(path)
