"""Add storage provider to UplaodRecord

Revision ID: 1ae52079ba72
Revises: 7704833e2889
Create Date: 2026-07-21 15:28:17.428252+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1ae52079ba72"
down_revision: str | Sequence[str] | None = "7704833e2889"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    storage_region_enum = sa.Enum("US", "EU", "ITAR", name="storageregion", create_type=False)

    storage_region_enum.create(op.get_bind(), checkfirst=True)

    op.add_column("uploads", sa.Column("storage_region", storage_region_enum, nullable=True), schema="LinkDB")
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("uploads", "storage_region", schema="LinkDB")
    op.execute("DROP TYPE IF EXISTS storageregion")
    # ### end Alembic commands ###
