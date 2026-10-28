from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.ai import AiAnalysisResponse, AiChatRequest, AiChatResponse, AiFormBuilderRequest, AiFormBuilderResponse
from app.services.ai_service import GeminiNotConfiguredError, analyze_form, analyze_workspace, build_form, chat

router = APIRouter(prefix="/ai", tags=["AI"])


def _translate_config_error(exc: GeminiNotConfiguredError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


@router.post("/chat", response_model=AiChatResponse)
async def ai_chat(
    payload: AiChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AiChatResponse:
    try:
        return await chat(db, user, payload)
    except GeminiNotConfiguredError as exc:
        raise _translate_config_error(exc) from exc


@router.post("/forms/build", response_model=AiFormBuilderResponse)
async def ai_build_form(
    payload: AiFormBuilderRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AiFormBuilderResponse:
    try:
        return await build_form(db, user, payload)
    except GeminiNotConfiguredError as exc:
        raise _translate_config_error(exc) from exc


@router.post("/workspace/analyze", response_model=AiAnalysisResponse)
async def ai_workspace_analysis(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AiAnalysisResponse:
    try:
        return await analyze_workspace(db, user)
    except GeminiNotConfiguredError as exc:
        raise _translate_config_error(exc) from exc


@router.post("/forms/{form_id}/analyze", response_model=AiAnalysisResponse)
async def ai_form_analysis(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AiAnalysisResponse:
    try:
        return await analyze_form(db, user, form_id)
    except GeminiNotConfiguredError as exc:
        raise _translate_config_error(exc) from exc
