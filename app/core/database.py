from __future__ import annotations

from collections.abc import AsyncGenerator

from asyncpg.exceptions import InvalidPasswordError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings
from app.core.security import get_password_hash

settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    from app import models  # noqa: F401

    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        if settings.environment == "development":
            await _seed_demo_accounts()
        print("Database initialized successfully")
    except Exception as e:
        database_host = settings.database_url.split("@")[-1] if "@" in settings.database_url else settings.database_url
        print("Warning: Could not initialize database.")
        print(f"  Database host/db: {database_host}")
        print(f"  Error: {type(e).__name__}: {e}")
        print("The application will continue to run, but database features may be unavailable.")
        print("Make sure PostgreSQL is running and the DATABASE_URL is correct.")


async def _seed_demo_accounts() -> None:
    from app.models.enums import UserRole
    from app.models.user import User

    demo_accounts = (
        {
            "name": "Demo Admin",
            "email": "admin@smartform.dev",
            "password": "Admin123!",
            "role": UserRole.ADMIN,
            "is_verified": True,
        },
        {
            "name": "Demo User",
            "email": "user@smartform.dev",
            "password": "User123!",
            "role": UserRole.USER,
            "is_verified": True,
        },
    )

    async with AsyncSessionLocal() as session:
        for account in demo_accounts:
            result = await session.execute(select(User).where(User.email == account["email"]))
            if result.scalar_one_or_none() is not None:
                continue

            session.add(
                User(
                    name=account["name"],
                    email=account["email"],
                    password_hash=get_password_hash(account["password"]),
                    role=account["role"],
                    is_verified=account["is_verified"],
                    is_active=True,
                )
            )

        await session.commit()
