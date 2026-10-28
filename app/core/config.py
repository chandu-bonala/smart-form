from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
import json

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file(BASE_DIR / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Smart Form Builder API"
    environment: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    secret_key: str = Field(default="change-me-in-env")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/smart_form_builder",
        env="DATABASE_URL",
    )
    cors_origins_raw: str = Field(
        default="http://localhost:19006,http://localhost:8081,http://localhost:3000,http://localhost:19007,http://127.0.0.1:19006,http://127.0.0.1:8081,http://127.0.0.1:3000,http://127.0.0.1:19007",
        env="CORS_ORIGINS",
    )
    upload_dir: Path = Field(default=BASE_DIR / "app" / "uploads")
    smtp_host: str = Field(default="smtp.gmail.com", env="SMTP_HOST")
    smtp_port: int = Field(default=587, env="SMTP_PORT")
    smtp_username: str | None = Field(default=None, env="SMTP_USERNAME")
    smtp_password: str | None = Field(default=None, env="SMTP_PASSWORD")
    smtp_from_email: str | None = Field(default=None, env="SMTP_FROM_EMAIL")
    smtp_use_tls: bool = Field(default=True, env="SMTP_USE_TLS")
    email_otp_expire_minutes: int = Field(default=10, env="EMAIL_OTP_EXPIRE_MINUTES")
    google_client_ids_raw: str = Field(default="", env="GOOGLE_CLIENT_IDS")
    gemini_api_key: str | None = Field(default=None, env="GEMINI_API_KEY")
    gemini_model: str | None = Field(default=None, env="GEMINI_MODEL")
    gemini_base_url: str = Field(
        default="https://generativelanguage.googleapis.com/v1beta",
        env="GEMINI_BASE_URL",
    )

    @field_validator("environment", mode="before")
    @classmethod
    def normalize_environment(cls, value):
        return str(value or "development").strip().lower()

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value):
        url = str(value or "").strip()
        if url.startswith("postgres://"):
            return "postgresql+asyncpg://" + url.removeprefix("postgres://")
        if url.startswith("postgresql://"):
            return "postgresql+asyncpg://" + url.removeprefix("postgresql://")
        return url

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, bool):
            return value
        if value is None:
            return False

        normalized = str(value).strip().lower()
        if normalized in {"true", "1", "yes", "y", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off", "release", "prod", "production"}:
            return False
        raise ValueError("debug must be a boolean-like value")

    @model_validator(mode="after")
    def validate_production_configuration(self):
        if self.environment not in {"production", "prod"}:
            return self

        if self.debug:
            raise ValueError("DEBUG must be false in production")
        if self.secret_key == "change-me-in-env" or len(self.secret_key) < 32:
            raise ValueError("Set SECRET_KEY to a randomly generated value of at least 32 characters")
        if not self.database_url.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must point to a PostgreSQL database")
        if "@localhost" in self.database_url or "@127.0.0.1" in self.database_url:
            raise ValueError("Set DATABASE_URL to the hosted PostgreSQL database")

        origins = self.cors_origins
        if not origins or any(not origin.startswith("https://") for origin in origins):
            raise ValueError("Set CORS_ORIGINS to the HTTPS origin of the deployed web app")
        return self

    @property
    def cors_origins(self) -> list[str]:
        value = self.cors_origins_raw.strip()
        if value.startswith("[") and value.endswith("]"):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if item]
            except json.JSONDecodeError:
                pass
        return [origin.strip() for origin in value.split(",") if origin.strip()]

    @property
    def google_client_ids(self) -> list[str]:
        value = self.google_client_ids_raw.strip()
        if value.startswith("[") and value.endswith("]"):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if item]
            except json.JSONDecodeError:
                pass
        return [client_id.strip() for client_id in value.split(",") if client_id.strip()]

    max_upload_size_mb: int = 10
    rate_limit: str = "100/minute"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
