"""Add storage region to links

Revision ID: 45355d3ca366
Revises: 30e20e134652
Create Date: 2026-07-28 14:27:58.775132+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "45355d3ca366"
down_revision: str | Sequence[str] | None = "30e20e134652"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("links", sa.Column("storage_region", sa.Enum("US", "EU", "ITAR", name="storageregion"), nullable=True), schema="LinkDB")
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("links", "storage_region", schema="LinkDB")
    # ### end Alembic commands ###
