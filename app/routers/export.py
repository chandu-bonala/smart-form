from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from urllib.parse import quote

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.enums import UserRole
from app.models.form import Form
from app.models.user import User
from app.schemas.export import ExportResponse
from app.services.analytics_service import build_form_analytics
from app.services.export_service import ExportService
from app.services.form_service import get_form_or_404
from io import BytesIO

router = APIRouter(prefix="/export", tags=["Export"])


def _attachment_headers(filename: str) -> dict[str, str]:
    encoded_filename = quote(filename)
    return {
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}; filename=\"{filename}\"",
    }


async def _ensure_form_access(form: Form, user: User) -> None:
    if user.role != UserRole.ADMIN and form.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this form")


@router.get("/forms/{form_id}/csv")
async def export_form_csv(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export form responses as CSV."""
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)

    csv_content = await ExportService.export_to_csv(db, form_id)
    
    return StreamingResponse(
        BytesIO(csv_content.encode()),
        media_type="text/csv",
        headers=_attachment_headers(f"{form.form_slug}_responses.csv"),
    )


@router.get("/forms/{form_id}/json")
async def export_form_json(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export form responses as JSON."""
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)

    json_content = await ExportService.export_to_json(db, form_id)
    
    return StreamingResponse(
        BytesIO(json_content.encode()),
        media_type="application/json",
        headers=_attachment_headers(f"{form.form_slug}_responses.json"),
    )


@router.get("/forms/{form_id}/xlsx")
async def export_form_xlsx(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export form responses as a clean Excel workbook."""
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)

    xlsx_content = await ExportService.export_to_xlsx(db, form_id)

    return StreamingResponse(
        BytesIO(xlsx_content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=_attachment_headers(f"{form.form_slug}_responses.xlsx"),
    )


@router.get("/forms/{form_id}/docx")
async def export_form_docx(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export form analytics summary as a clean Word document."""
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)

    analytics_data = await build_form_analytics(db, form_id)
    docx_content = ExportService.export_to_docx(form, analytics_data)

    return StreamingResponse(
        BytesIO(docx_content),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=_attachment_headers(f"{form.form_slug}_analytics.docx"),
    )


@router.get("/forms/{form_id}/analytics")
async def export_form_analytics(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export form analytics as JSON for download."""
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)

    analytics_data = await build_form_analytics(db, form_id)
    analytics_json = json.dumps(analytics_data.model_dump(), indent=2, default=str)

    return StreamingResponse(
        BytesIO(analytics_json.encode()),
        media_type="application/json",
        headers=_attachment_headers(f"{form.form_slug}_analytics.json"),
    )
