from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

from app.core.config import get_settings


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-") or "form"


def normalize_email(value: str) -> str:
    return value.strip().lower()


def ensure_upload_directory() -> Path:
    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    return settings.upload_dir


def clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(value, maximum))


def split_csv(values: str | None) -> list[str]:
    if not values:
        return []
    return [item.strip() for item in values.split(",") if item.strip()]


def contains_any(value: str, needles: Iterable[str]) -> bool:
    lowered = value.lower()
    return any(needle.lower() in lowered for needle in needles)
