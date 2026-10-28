from __future__ import annotations

import getpass
import json
import os
from pathlib import Path
from typing import Any

import httpx

PREFERRED_GEMINI_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
]

RETRYABLE_GEMINI_ERROR_SNIPPETS = (
    "high demand",
    "temporarily unavailable",
    "resource exhausted",
    "rate limit",
    "quota",
    "overloaded",
    "try again later",
    "no longer available to new users",
    "update your code to use models/gemini-3.6-flash",
    "deprecated",
    "shut down",
)

BASE_URL = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"


def _normalize_model_name(value: str) -> str:
    return value.split("/", 1)[-1] if "/" in value else value


def _extract_models(payload: dict[str, Any]) -> list[dict[str, Any]]:
    models = payload.get("models") or []
    return [model for model in models if isinstance(model, dict)]


def list_models(api_key: str) -> list[dict[str, Any]]:
    url = f"{BASE_URL}/models"
    response = httpx.get(url, params={"key": api_key, "pageSize": 1000}, timeout=30.0)
    response.raise_for_status()
    return _extract_models(response.json())


def pick_best_model(models: list[dict[str, Any]]) -> str | None:
    available: dict[str, dict[str, Any]] = {}
    for model in models:
        name = _normalize_model_name(str(model.get("name") or ""))
        supported = model.get("supportedGenerationMethods") or []
        if "generateContent" in supported:
            available[name] = model

    for candidate in PREFERRED_GEMINI_MODELS:
        if candidate in available:
            return candidate

    if available:
        return sorted(available.keys())[0]
    return None


def verify_model(api_key: str, model: str, prompt: str) -> str:
    url = f"{BASE_URL}/models/{model}:generateContent"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "topP": 0.95,
            "maxOutputTokens": 128,
        },
    }
    response = httpx.post(url, params={"key": api_key}, json=payload, timeout=60.0)
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates") or []
    for candidate in candidates:
        content = candidate.get("content") or {}
        parts = content.get("parts") or []
        text = "".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
        if text:
            return text
    raise RuntimeError("Gemini did not return any text")


def _is_retryable_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(snippet in message for snippet in RETRYABLE_GEMINI_ERROR_SNIPPETS)


def _set_env_value(path: Path, key: str, value: str) -> None:
    lines: list[str] = []
    found = False
    if path.exists():
        lines = path.read_text(encoding="utf-8").splitlines()
    updated: list[str] = []
    for line in lines:
        if line.startswith(f"{key}="):
            updated.append(f"{key}={value}")
            found = True
        else:
            updated.append(line)
    if not found:
        if updated and updated[-1].strip():
            updated.append("")
        updated.append(f"{key}={value}")
    path.write_text("\n".join(updated) + "\n", encoding="utf-8")


def main() -> None:
    api_key = os.environ.get("GEMINI_API_KEY") or getpass.getpass("Enter GEMINI_API_KEY: ").strip()
    if not api_key:
        raise SystemExit("No Gemini API key provided.")

    models = list_models(api_key)
    print("Available models:")
    for model in models:
        name = _normalize_model_name(str(model.get("name") or ""))
        methods = ", ".join(str(item) for item in (model.get("supportedGenerationMethods") or []))
        print(f"- {name} [{methods}]")

    best_model = pick_best_model(models)
    if not best_model:
        raise SystemExit("No model with generateContent support was found.")

    print(f"\nSelected best open model: {best_model}")
    prompt = os.environ.get("GEMINI_TEST_PROMPT")
    if not prompt:
        prompt = input("Enter a short test prompt: ").strip()
    prompt = prompt or "Reply with OK and mention the model name."
    candidates = [best_model] + [model_name for model_name in PREFERRED_GEMINI_MODELS if model_name != best_model]
    last_error: str | None = None
    for model_name in candidates:
        try:
            result = verify_model(api_key, model_name, prompt)
            print("\nVerification response:")
            print(result)
            _set_env_value(ENV_PATH, "GEMINI_MODEL", model_name)
            print(f"\nSaved GEMINI_MODEL={model_name} to {ENV_PATH}")
            return
        except Exception as exc:  # pragma: no cover - CLI fallback path
            last_error = f"{model_name}: {exc}"
            print(f"\nModel {model_name} failed: {exc}")
            if not _is_retryable_error(exc):
                break

    raise SystemExit(f"No Gemini model passed verification. Last error: {last_error}")


if __name__ == "__main__":
    main()
