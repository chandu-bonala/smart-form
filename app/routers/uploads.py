from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.answer import Answer
from app.models.upload import Upload
from app.models.user import User
from app.services.signed_url_service import SignedURLService
from app.utils.helpers import ensure_upload_directory
from app.utils.validators import is_allowed_upload

router = APIRouter(prefix="/upload", tags=["Uploads"])


@router.post("")
async def upload_file(
    answer_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> dict[str, str | int]:
    settings = get_settings()
    if not is_allowed_upload(file.filename):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")

    # Ensure answer exists and belongs to a public published form (or otherwise allowed)
    answer_result = await db.execute(
        select(Answer)
        .where(Answer.id == answer_id)
        .options()
    )
    answer = answer_result.scalar_one_or_none()
    if answer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")

    # Verify the parent response and form allow public uploads
    from app.models.response import Response as ResponseModel
    from app.models.form import Form as FormModel

    form_allows = False
    if answer.response_id:
        resp_result = await db.execute(select(ResponseModel).where(ResponseModel.id == answer.response_id))
        response_obj = resp_result.scalar_one_or_none()
        if response_obj:
            form_result = await db.execute(select(FormModel).where(FormModel.id == response_obj.form_id))
            form_obj = form_result.scalar_one_or_none()
            if form_obj and form_obj.status.name.lower() == 'published' and form_obj.is_public and not form_obj.is_hidden:
                form_allows = True

    if not form_allows:
        # Do not allow anonymous upload unless form is public
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Uploads not allowed for this answer")

    upload_dir = ensure_upload_directory()
    safe_name = f"{uuid4().hex}_{Path(file.filename).name}"
    file_path = upload_dir / safe_name

    total_bytes = 0
    async with aiofiles.open(file_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            total_bytes += len(chunk)
            if total_bytes > settings.max_upload_size_mb * 1024 * 1024:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large")
            await buffer.write(chunk)

    upload = Upload(
        answer_id=answer_id,
        file_name=file.filename,
        file_size=total_bytes,
        file_type=file.content_type or "application/octet-stream",
        file_path=str(file_path),
    )
    db.add(upload)
    await db.commit()
    await db.refresh(upload)
    return {"id": upload.id, "file_name": upload.file_name, "file_path": upload.file_path, "file_size": upload.file_size}


@router.delete("/{upload_id}")
async def delete_upload(
    upload_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> dict[str, str]:
    result = await db.execute(select(Upload).where(Upload.id == upload_id))
    upload = result.scalar_one_or_none()
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")

    file_path = Path(upload.file_path)
    if file_path.exists():
        file_path.unlink()
    await db.delete(upload)
    await db.commit()
    return {"message": "Upload deleted successfully"}


@router.get("/{upload_id}/signed-url")
async def get_signed_download_url(
    upload_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str | int]:
    """Generate a time-limited signed URL for file download."""
    result = await db.execute(select(Upload).where(Upload.id == upload_id))
    upload = result.scalar_one_or_none()
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")

    signed_url = SignedURLService.generate_signed_url(upload_id, expires_in_hours=24)
    return {"signed_url": signed_url, "expires_in_hours": 24}


@router.get("/{upload_id}/download")
async def secure_download_file(
    upload_id: str,
    expires: int = Query(...),
    signature: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Download file using signed URL (no authentication required but URL-based access control)."""
    # Verify signed URL
    is_valid, error = SignedURLService.verify_signed_url(upload_id, expires, signature)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error)

    # Get upload
    result = await db.execute(select(Upload).where(Upload.id == upload_id))
    upload = result.scalar_one_or_none()
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")

    file_path = Path(upload.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(
        file_path,
        filename=upload.file_name,
        media_type=upload.file_type,
    )
