from __future__ import annotations

import json
import re
from collections.abc import Sequence

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.ai import (
    AiAnalysisResponse,
    AiChatRequest,
    AiChatResponse,
    AiFormBuilderRequest,
    AiFormBuilderResponse,
    AiFormQuestion,
    AiInsightMetric,
)
from app.services.analytics_service import build_dashboard, build_form_analytics, build_user_analytics
from app.services.form_service import get_form_or_404, list_forms

settings = get_settings()

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


class GeminiNotConfiguredError(RuntimeError):
    pass


QUESTION_TYPE_ALIASES = {
    "long_text": "paragraph",
    "text": "short_text",
    "shorttext": "short_text",
    "single_choice": "radio",
    "multiple_choice": "checkbox",
    "multi_select": "checkbox",
    "single_select": "radio",
    "yesno": "yes_no",
    "yes_no": "yes_no",
    "email_address": "email",
    "phone_number": "phone",
}

QUESTION_TITLE_KEYS = ("title", "question", "question_text", "question_title", "label", "label_text", "prompt", "text", "name")

QUESTION_FOCUS_KEYS = ("field_focus", "question_focus", "focus", "purpose", "intent", "topic", "field_label", "label")

QUESTION_PLACEHOLDER_KEYS = ("placeholder", "hint", "helper_text", "help_text")


def _json_dumps(value: object) -> str:
    return json.dumps(value, ensure_ascii=True, indent=2, default=str)


def _strip_wrappers(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _extract_candidate_text(payload: dict) -> str:
    candidates = payload.get("candidates") or []
    if not candidates:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Gemini returned no candidates")

    for candidate in candidates:
        content = candidate.get("content") or {}
        parts = content.get("parts") or []
        text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
        if text.strip():
            return text

    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Gemini response did not include text")


def _parse_json_response(text: str) -> dict:
    cleaned = _strip_wrappers(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini response was not valid JSON",
        ) from exc


def _pick_text(payload: dict, keys: Sequence[str], fallback: str = "") -> str:
    for key in keys:
        value = payload.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return fallback


def _normalize_question_type(value: object) -> str:
    raw = str(value or "").strip().lower().replace(" ", "_")
    if not raw:
        return "short_text"
    return QUESTION_TYPE_ALIASES.get(raw, raw)


def _looks_generic_question_title(title: str) -> bool:
    normalized = re.sub(r"\s+", " ", title.strip().lower())
    if not normalized:
        return True
    generic_patterns = (
        r"^question\s*\d+$",
        r"^question$",
        r"^field\s*\d+$",
        r"^field$",
        r"^untitled$",
        r"^short answer$",
        r"^long answer$",
        r"^short text$",
        r"^paragraph$",
        r"^enter\s+.*$",
        r"^your\s+answer$",
        r"^answer\s+here$",
    )
    if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", normalized):
        return True
    if re.match(r"^[+\d][\d\s().-]{6,}$", normalized):
        return True
    return any(re.match(pattern, normalized) for pattern in generic_patterns)


def _fallback_question_title(question_type: str, index: int) -> str:
    templates = {
        "email": "What is your email address?",
        "phone": "What is your phone number?",
        "number": "What number should we record?",
        "date": "What date should we use?",
        "time": "What time works best for you?",
        "yes_no": "Would you like to continue?",
        "rating": "How would you rate this?",
        "dropdown": "Which option best describes you?",
        "radio": "Which option should we select?",
        "checkbox": "Which of these apply to you?",
        "paragraph": "Please share the details.",
        "short_text": "What should we know?",
        "url": "What is the link?",
        "password": "Please enter the password.",
        "file_upload": "Please upload the file.",
        "signature": "Please add your signature.",
        "section_title": "Section heading",
        "image": "Add an image",
    }
    base = templates.get(question_type, "What should we know?")
    return base if index == 0 else f"{base} ({index + 1})"


def _build_title_from_focus(question_type: str, focus: str) -> str | None:
    cleaned = re.sub(r"\s+", " ", focus.strip().strip("?.:;"))
    if not cleaned:
        return None

    normalized = cleaned.lower()
    if "first name" in normalized and "last name" in normalized:
        return "What is your full name?"
    if "email" in normalized:
        return "What is your email address?"
    if any(token in normalized for token in ("phone", "mobile", "contact number")):
        return "What is your phone number?"
    if "date" in normalized:
        return "What date should we use?"
    if "time" in normalized:
        return "What time works best for you?"
    if "year" in normalized and any(token in normalized for token in ("student", "study", "school", "college")):
        return "Which year are you in?"
    if "course" in normalized or "program" in normalized or "major" in normalized:
        return "What course or program are you enrolled in?"
    if "rating" in normalized or "rate" in normalized:
        return "How would you rate this?"
    if question_type in {"dropdown", "radio"}:
        return f"Which {cleaned.lower()} applies?"
    if question_type == "checkbox":
        return f"Which of these {cleaned.lower()} apply?"
    if question_type == "paragraph":
        return f"Please share your {cleaned.lower()}."
    if question_type in {"short_text", "number"}:
        return f"What is your {cleaned.lower()}?"
    return f"Please provide your {cleaned.lower()}."


def _normalize_question_title(item: dict, question_type: str, index: int) -> str:
    title = _pick_text(item, QUESTION_TITLE_KEYS, fallback="")
    focus = _pick_text(item, QUESTION_FOCUS_KEYS, fallback="")

    if title and not _looks_generic_question_title(title):
        normalized_title = re.sub(r"\s+", " ", title).strip()
        if normalized_title and normalized_title[-1] not in "?.!":
            normalized_title = f"{normalized_title}?"
        return normalized_title[:1].upper() + normalized_title[1:] if normalized_title else normalized_title

    focused_title = _build_title_from_focus(question_type, focus)
    if focused_title:
        return focused_title

    return _fallback_question_title(question_type, index)


def _normalize_question_item(item: dict, index: int) -> AiFormQuestion:
    question_type = _normalize_question_type(item.get("question_type") or item.get("type"))
    title = _normalize_question_title(item, question_type, index)
    placeholder = _pick_text(item, QUESTION_PLACEHOLDER_KEYS, fallback="")
    options = [str(option).strip() for option in item.get("options") or [] if str(option).strip()]

    if not placeholder:
        placeholder = None

    if question_type == "yes_no" and not options:
        options = ["Yes", "No"]

    return AiFormQuestion(
        title=title,
        question_type=question_type,
        required=bool(item.get("required", True)),
        placeholder=placeholder,
        options=options,
        validation=item.get("validation") if isinstance(item.get("validation"), dict) else None,
    )


class GeminiClient:
    _resolved_model: str | None = None
    _available_generation_models: dict[str, dict] | None = None

    def __init__(self) -> None:
        self.api_key = settings.gemini_api_key
        self.base_url = settings.gemini_base_url.rstrip("/")

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def list_models(self) -> list[dict]:
        if not self.available:
            raise GeminiNotConfiguredError("GEMINI_API_KEY is not configured")

        url = f"{self.base_url}/models"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params={"key": self.api_key, "pageSize": 1000})
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The backend could not connect to Gemini. Check outbound network access and try again.",
            ) from exc
        if response.status_code >= 400:
            message = response.text
            try:
                parsed = response.json()
                message = parsed.get("error", {}).get("message") or message
            except ValueError:
                pass
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Gemini model lookup failed: {message}",
            )

        payload = response.json()
        models = payload.get("models") or []
        return [model for model in models if isinstance(model, dict)]

    async def _get_available_generation_models(self) -> dict[str, dict]:
        if self.__class__._available_generation_models is not None:
            return self.__class__._available_generation_models

        models = await self.list_models()
        available: dict[str, dict] = {}
        for model in models:
            name = str(model.get("name") or "")
            short_name = name.split("/", 1)[-1] if "/" in name else name
            supported_methods = model.get("supportedGenerationMethods") or []
            if "generateContent" in supported_methods:
                available[short_name] = model

        self.__class__._available_generation_models = available
        return available

    async def resolve_model(self) -> str:
        available = await self._get_available_generation_models()

        configured_model = (settings.gemini_model or "").strip()
        if self.__class__._resolved_model and self.__class__._resolved_model in available:
            return self.__class__._resolved_model

        candidates: list[str] = []
        if configured_model and configured_model in available:
            candidates.append(configured_model)

        for candidate in PREFERRED_GEMINI_MODELS:
            if candidate in available and candidate not in candidates:
                candidates.append(candidate)

        if not candidates and available:
            candidates = sorted(available.keys())

        if candidates:
            self.__class__._resolved_model = candidates[0]
            return candidates[0]

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No Gemini models with generateContent support are available for this API key",
        )

    def _is_retryable_model_error(self, response: httpx.Response, message: str) -> bool:
        if response.status_code in {408, 425, 429, 500, 502, 503, 504}:
            return True
        lowered = message.lower()
        return any(snippet in lowered for snippet in RETRYABLE_GEMINI_ERROR_SNIPPETS)

    async def _generate_json_for_model(
        self,
        *,
        model: str,
        payload: dict,
    ) -> dict:
        url = f"{self.base_url}/models/{model}:generateContent"
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, params={"key": self.api_key}, json=payload)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The backend could not connect to Gemini. Check outbound network access and try again.",
            ) from exc
        if response.status_code >= 400:
            message = response.text
            try:
                parsed = response.json()
                message = parsed.get("error", {}).get("message") or message
            except ValueError:
                pass

            if self._is_retryable_model_error(response, message):
                raise RuntimeError(message)

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Gemini request failed: {message}",
            )

        text = _extract_candidate_text(response.json())
        return _parse_json_response(text)

    async def generate_json(
        self,
        *,
        system_instruction: str,
        user_prompt: str,
        temperature: float = 0.4,
        max_output_tokens: int = 2048,
    ) -> dict:
        if not self.available:
            raise GeminiNotConfiguredError("GEMINI_API_KEY is not configured")

        payload = {
            "systemInstruction": {
                "parts": [{"text": system_instruction}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}],
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "topP": 0.95,
                "maxOutputTokens": max_output_tokens,
                "responseMimeType": "application/json",
            },
        }

        available = await self._get_available_generation_models()
        configured_model = (settings.gemini_model or "").strip()
        candidates: list[str] = []

        if configured_model and configured_model in available:
            candidates.append(configured_model)

        for candidate in PREFERRED_GEMINI_MODELS:
            if candidate in available and candidate not in candidates:
                candidates.append(candidate)

        if not candidates:
            candidates = sorted(available.keys())

        last_retryable_error: str | None = None
        for model in candidates:
            try:
                data = await self._generate_json_for_model(model=model, payload=payload)
                self.__class__._resolved_model = model
                return data
            except RuntimeError as exc:
                last_retryable_error = str(exc)
                continue

        if last_retryable_error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Gemini is temporarily overloaded across the available models. "
                    f"Last error: {last_retryable_error}"
                ),
            )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No Gemini model could complete the request",
        )


def _workspace_forms_snapshot(forms: Sequence) -> list[dict]:
    snapshot: list[dict] = []
    for form in forms:
        snapshot.append(
            {
                "id": form.id,
                "title": form.title,
                "description": form.description,
                "status": form.status.value if hasattr(form.status, "value") else str(form.status),
                "is_public": form.is_public,
                "is_hidden": form.is_hidden,
                "question_count": len(form.questions),
                "created_at": form.created_at.isoformat() if getattr(form, "created_at", None) else None,
            }
        )
    return snapshot


async def _build_workspace_context(db: AsyncSession, user: User) -> dict:
    owner_id = None if user.role == UserRole.ADMIN else user.id
    dashboard = await build_dashboard(db, owner_id=owner_id)
    user_stats = await build_user_analytics(db)
    forms = await list_forms(db, owner_id=owner_id)

    return {
        "owner_scope": "all users" if owner_id is None else user.id,
        "dashboard": dashboard.model_dump(mode="json"),
        "users": user_stats.model_dump(mode="json"),
        "forms": _workspace_forms_snapshot(forms[:15]),
        "top_forms": [item.model_dump(mode="json") for item in dashboard.top_forms[:10]],
    }


def _analysis_from_json(payload: dict, default_title: str) -> AiAnalysisResponse:
    return AiAnalysisResponse(
        title=str(payload.get("title") or default_title),
        overview=str(payload.get("overview") or ""),
        deep_overview=str(payload.get("deep_overview") or payload.get("overview") or ""),
        strengths=[str(item) for item in payload.get("strengths") or [] if str(item).strip()],
        issues=[str(item) for item in payload.get("issues") or [] if str(item).strip()],
        opportunities=[str(item) for item in payload.get("opportunities") or [] if str(item).strip()],
        recommendations=[str(item) for item in payload.get("recommendations") or [] if str(item).strip()],
        quick_wins=[str(item) for item in payload.get("quick_wins") or [] if str(item).strip()],
        metrics=[
            AiInsightMetric(
                label=str(item.get("label") or ""),
                value=str(item.get("value") or ""),
                detail=str(item.get("detail")) if item.get("detail") is not None else None,
            )
            for item in payload.get("metrics") or []
            if isinstance(item, dict)
        ],
        next_questions=[str(item) for item in payload.get("next_questions") or [] if str(item).strip()],
    )


async def chat(
    db: AsyncSession,
    user: User,
    payload: AiChatRequest,
) -> AiChatResponse:
    client = GeminiClient()
    selected_form_context = None
    if payload.form_id:
        form = await get_form_or_404(db, payload.form_id)
        if user.role != UserRole.ADMIN and form.owner_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this form")
        form_analysis = await build_form_analytics(db, payload.form_id)
        selected_form_context = form_analysis.model_dump(mode="json")

    system_instruction = (
        "You are SmartForm AI, a friendly form-building coach. "
        "Your only job is to help the user create better forms step by step. "
        "Ask clarifying questions when needed, suggest question order, field types, labels, and concise wording. "
        "Do not analyze the workspace, response trends, or product health unless the user explicitly asks for form structure help from a selected form. "
        "Always answer in JSON with keys: answer, follow_up_questions, suggested_actions, tone."
    )
    prompt = {
        "message": payload.message,
        "history": [item.model_dump(mode="json") for item in payload.history],
        "selected_form_context": selected_form_context,
        "response_rules": [
            "Keep the answer concise, practical, and form-focused.",
            "Prefer giving one helpful next step at a time.",
            "If the user is vague, ask a short clarifying question about the form goal or audience.",
        ],
    }
    data = await client.generate_json(
        system_instruction=system_instruction,
        user_prompt=_json_dumps(prompt),
        temperature=0.5,
        max_output_tokens=1800,
    )
    return AiChatResponse(
        answer=str(data.get("answer") or ""),
        follow_up_questions=[str(item) for item in data.get("follow_up_questions") or [] if str(item).strip()],
        suggested_actions=[str(item) for item in data.get("suggested_actions") or [] if str(item).strip()],
        tone=str(data.get("tone")) if data.get("tone") is not None else None,
    )


async def build_form(
    db: AsyncSession,
    user: User,
    payload: AiFormBuilderRequest,
) -> AiFormBuilderResponse:
    client = GeminiClient()
    workspace = await _build_workspace_context(db, user)
    question_count = max(3, min(int(payload.question_count), 15))
    system_instruction = (
        "You are SmartForm AI, a senior form designer. Create a practical, conversion-friendly form blueprint. "
        "Return JSON with keys: title, description, rationale, questions, suggested_tags, next_steps. "
        "Each question object must include a natural respondent-facing question sentence in the title field and a short field_focus describing the answer being collected. "
        "Good examples: title='What is your full name?' with field_focus='full name' or title='Which year are you studying in?' with field_focus='year of study'. "
        "Bad examples: 'Full name', 'Question 1', 'Short answer', or an email/phone number as the title. "
        "Questions should be varied, concise, and aligned with the objective. "
        "If the form asks for an email, phone number, date, selection, or rating, choose the best type and write the matching question sentence."
    )
    prompt = {
        "objective": payload.objective,
        "audience": payload.audience,
        "tone": payload.tone,
        "question_count": question_count,
        "include_email": payload.include_email,
        "response_mode": payload.response_mode,
        "context": payload.context,
        "workspace_context": workspace,
        "question_guidance": {
            "types_available": [
                "short_text",
                "long_text",
                "radio",
                "checkbox",
                "dropdown",
                "rating",
                "yes_no",
                "date",
                "email",
                "number",
            ],
            "avoid": [
                "overly long forms",
                "duplicate questions",
                "ambiguous wording",
            ],
        },
    }
    data = await client.generate_json(
        system_instruction=system_instruction,
        user_prompt=_json_dumps(prompt),
        temperature=0.65,
        max_output_tokens=2600,
    )
    normalized_questions = [
        _normalize_question_item(item, index)
        for index, item in enumerate(data.get("questions") or [])
        if isinstance(item, dict)
    ]
    return AiFormBuilderResponse(
        title=str(data.get("title") or payload.objective[:80]),
        description=str(data.get("description") or payload.objective),
        rationale=str(data.get("rationale") or ""),
        questions=normalized_questions,
        suggested_tags=[str(item) for item in data.get("suggested_tags") or [] if str(item).strip()],
        next_steps=[str(item) for item in data.get("next_steps") or [] if str(item).strip()],
    )


async def analyze_workspace(db: AsyncSession, user: User) -> AiAnalysisResponse:
    client = GeminiClient()
    workspace = await _build_workspace_context(db, user)
    system_instruction = (
        "You are SmartForm AI, a senior product analyst. Analyze the workspace deeply and objectively. "
        "Focus on product health, form quality, response behavior, and the best next moves. "
        "Return JSON with keys: title, overview, deep_overview, strengths, issues, opportunities, recommendations, quick_wins, metrics, next_questions."
    )
    data = await client.generate_json(
        system_instruction=system_instruction,
        user_prompt=_json_dumps(
            {
                "analysis_target": "workspace",
                "workspace_context": workspace,
                "analysis_guidance": [
                    "Explain what the workspace is doing well.",
                    "Call out likely bottlenecks or missing capabilities.",
                    "Give implementation ideas that can be acted on quickly.",
                    "Include AI opportunities for chat, generation, and reporting.",
                ],
            }
        ),
        temperature=0.45,
        max_output_tokens=2400,
    )
    return _analysis_from_json(data, "Workspace analysis")


async def analyze_form(db: AsyncSession, user: User, form_id: str) -> AiAnalysisResponse:
    client = GeminiClient()
    form = await get_form_or_404(db, form_id)
    if user.role != UserRole.ADMIN and form.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this form")

    analytics = await build_form_analytics(db, form_id)
    form_context = analytics.model_dump(mode="json")
    system_instruction = (
        "You are SmartForm AI, a senior response analyst. Review the submitted responses deeply and objectively. "
        "Focus on completion behavior, answer quality, skipped questions, recurring patterns, and conversion opportunities. "
        "Return JSON with keys: title, overview, deep_overview, strengths, issues, opportunities, recommendations, quick_wins, metrics, next_questions."
    )
    data = await client.generate_json(
        system_instruction=system_instruction,
        user_prompt=_json_dumps(
            {
                "analysis_target": "response_analyzer",
                "form_metadata": {
                    "id": form.id,
                    "title": form.title,
                    "description": form.description,
                    "status": form.status.value if hasattr(form.status, "value") else str(form.status),
                    "question_count": len(form.questions),
                    "response_count": len(form.responses),
                    "is_public": form.is_public,
                    "is_hidden": form.is_hidden,
                    "allow_multiple_responses": form.allow_multiple_responses,
                    "collect_email": form.collect_email,
                },
                "form_context": form_context,
                "analysis_guidance": [
                    "Explain what the response data says about completion and engagement.",
                    "Call out questions that appear skipped, unclear, or low-performing.",
                    "Summarize recurring answer patterns and notable response trends.",
                    "Recommend practical fixes for wording, ordering, and conversion.",
                ],
            }
        ),
        temperature=0.45,
        max_output_tokens=2400,
    )
    return _analysis_from_json(data, f"Response analysis for {form.title}")
