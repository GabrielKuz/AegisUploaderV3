from logging.config import fileConfig
import os

import sqlalchemy as sa
from sqlalchemy import engine_from_config, pool

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url",os.environ["DATABASE_URL"])

from modules.models import Base

target_metadata = Base.metadata  


def runOfflineMigrations() -> None:
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def runOnlineMigrations() -> None:
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.begin() as connection:
        connection.execute(sa.text('CREATE SCHEMA IF NOT EXISTS "LinkDB"'))

    with connectable.connect() as connection:
        context.configure(connection=connection,target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    runOfflineMigrations()
else:
    runOnlineMigrations()