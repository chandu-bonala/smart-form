from __future__ import annotations

import asyncio
import subprocess
import sys
from pathlib import Path

from sqlalchemy import inspect, text

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app import models  # noqa: F401 - register all model tables with SQLAlchemy metadata
from app.core.database import Base, engine


async def _inspect_and_bootstrap() -> bool:
    """Create the current schema on a blank DB and report whether it needs a baseline stamp."""
    async with engine.begin() as connection:
        table_names, version = await connection.run_sync(_schema_state)

        if version:
            return False

        model_table_names = set(Base.metadata.tables)
        existing_model_tables = table_names & model_table_names

        if not table_names:
            await connection.run_sync(Base.metadata.create_all)
            print("Created the initial application schema.")
            return True

        if existing_model_tables != model_table_names:
            raise RuntimeError(
                "The database has an unversioned or partial SmartForm schema. "
                "Back it up and migrate it explicitly before deployment."
            )

        missing_columns: list[str] = []
        for table in Base.metadata.sorted_tables:
            actual_columns = await connection.run_sync(
                lambda sync_connection, table_name=table.name: {
                    column["name"] for column in inspect(sync_connection).get_columns(table_name)
                }
            )
            for column in table.columns:
                if column.name not in actual_columns:
                    missing_columns.append(f"{table.name}.{column.name}")

        if missing_columns:
            formatted = ", ".join(missing_columns[:8])
            raise RuntimeError(
                "The database has an unversioned SmartForm schema that is missing current columns: "
                f"{formatted}. Back it up and migrate it explicitly before deployment."
            )

        print("Found the current schema without an Alembic baseline.")
        return True


def _schema_state(sync_connection) -> tuple[set[str], str | None]:
    inspector = inspect(sync_connection)
    tables = set(inspector.get_table_names())
    if "alembic_version" not in tables:
        return tables, None

    version = sync_connection.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).scalar_one_or_none()
    tables.discard("alembic_version")
    return tables, version


def main() -> None:
    needs_baseline = asyncio.run(_inspect_and_bootstrap())
    if needs_baseline:
        subprocess.run(
            [sys.executable, "-m", "alembic", "stamp", "head"],
            cwd=BASE_DIR,
            check=True,
        )

    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BASE_DIR,
        check=True,
    )


if __name__ == "__main__":
    main()
