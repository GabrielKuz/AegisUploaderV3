"""Add storage provider to UplaodRecord

Revision ID: 1ae52079ba72
Revises: 7704833e2889
Create Date: 2026-07-21 15:28:17.428252+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ae52079ba72'
down_revision: Union[str, Sequence[str], None] = '7704833e2889'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'uploads',
        sa.Column('storage_region', sa.Enum('US', 'EU', 'ITAR', name='storageregion'), nullable=True, default='US'),
        schema='LinkDB'
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('uploads', 'storage_region', schema='LinkDB')
    # ### end Alembic commands ###
