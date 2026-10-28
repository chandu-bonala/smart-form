from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.enums import UserRole
from app.models.form import Form
from app.models.response import Response
from app.models.user import User
from app.schemas.response import ResponseCreate, ResponseList, ResponseRead
from app.services.form_service import create_response, delete_response, get_form_or_404, get_response_or_404, list_responses_by_form

router = APIRouter(prefix="/responses", tags=["Responses"])


async def _ensure_form_access(form: Form, user: User) -> None:
    if user.role != UserRole.ADMIN and form.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this form")


async def _ensure_response_access(response: Response, user: User, db: AsyncSession) -> None:
    form = await get_form_or_404(db, response.form_id)
    if user.role != UserRole.ADMIN and form.owner_id != user.id and response.submitted_by != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this response")


@router.post("", response_model=ResponseRead, status_code=status.HTTP_201_CREATED)
async def submit_response(payload: ResponseCreate, db: AsyncSession = Depends(get_db)) -> ResponseRead:
    response = await create_response(db, payload)
    return ResponseRead.model_validate(response)


@router.get("/forms/{form_id}", response_model=ResponseList)
async def get_form_responses(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ResponseList:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    responses = await list_responses_by_form(db, form_id)
    return ResponseList(items=[ResponseRead.model_validate(response) for response in responses], total=len(responses))


@router.get("/{response_id}", response_model=ResponseRead)
async def get_response(
    response_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ResponseRead:
    response = await get_response_or_404(db, response_id)
    await _ensure_response_access(response, user, db)
    return ResponseRead.model_validate(response)


@router.delete("/{response_id}")
async def remove_response(
    response_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    response = await get_response_or_404(db, response_id)
    await _ensure_response_access(response, user, db)
    await delete_response(db, response)
    return {"message": "Response deleted successfully"}
