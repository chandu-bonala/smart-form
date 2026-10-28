from __future__ import annotations

from pydantic import BaseModel


class ExportResponse(BaseModel):
    """Response for export endpoints."""
    format: str  # csv or json
    filename: str
    content: str  # Actual CSV/JSON content


class PaginatedParams(BaseModel):
    """Query parameters for pagination."""
    page: int = 1
    page_size: int = 20
