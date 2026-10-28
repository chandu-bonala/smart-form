from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.database import engine, init_db
from app.routers import (
    ai,
    admin,
    analytics,
    auth,
    forms,
    question_branches,
    questions,
    responses,
    uploads,
    users,
    conditional_rules,
    export,
    response_search,
    public_forms,
)
from app.services.scheduler_service import start_scheduler, stop_scheduler
from app.utils.helpers import ensure_upload_directory

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_upload_directory()
    if settings.environment == "development":
        await init_db()
    await start_scheduler()
    try:
        yield
    finally:
        await stop_scheduler()
        await engine.dispose()


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(ai.router, prefix=settings.api_v1_prefix)
app.include_router(admin.router, prefix=settings.api_v1_prefix)
app.include_router(users.router, prefix=settings.api_v1_prefix)
app.include_router(forms.router, prefix=settings.api_v1_prefix)
app.include_router(questions.router, prefix=settings.api_v1_prefix)
app.include_router(question_branches.router, prefix=settings.api_v1_prefix)
app.include_router(responses.router, prefix=settings.api_v1_prefix)
app.include_router(analytics.router, prefix=settings.api_v1_prefix)
app.include_router(uploads.router, prefix=settings.api_v1_prefix)
app.include_router(conditional_rules.router, prefix=settings.api_v1_prefix)
app.include_router(export.router, prefix=settings.api_v1_prefix)
app.include_router(response_search.router, prefix=settings.api_v1_prefix)
app.include_router(public_forms.router, prefix=settings.api_v1_prefix)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.get("/ready")
async def readiness_check() -> dict[str, str]:
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database is not available") from exc
    return {"status": "ready", "service": settings.app_name}
