"""Created Upload Sessions

Revision ID: 4d8bf879491e
Revises: 7d79f24cb107
Create Date: 2026-07-13 17:09:56.838995

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d8bf879491e'
down_revision: Union[str, Sequence[str], None] = '7d79f24cb107'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.create_table(
        'upload_sessions',
        sa.Column('upload_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('upload_token', sa.String(length=64), nullable=False),
        sa.Column('link_uuid', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('case_id', sa.String(), nullable=False),
        sa.Column('blob_name', sa.Text(), nullable=False),
        sa.Column('original_filename', sa.Text(), nullable=False),
        sa.Column('content_type', sa.Text(), nullable=True),
        sa.Column('expected_size', sa.BigInteger(), nullable=False),
        sa.Column('expected_sha256', sa.Text(), nullable=False),
        sa.Column('received_ranges', sa.JSON(), nullable=False),
        sa.Column('received_size', sa.BigInteger(), nullable=False),
        sa.Column('chunk_size', sa.BigInteger(), nullable=False),
        sa.Column('completed', sa.Boolean(), nullable=False),
        sa.Column('created', sa.DateTime(), nullable=False),
        sa.Column('last_activity', sa.DateTime(), nullable=False),
        sa.Column('itar_status', sa.Boolean(), nullable=False),
        sa.Column(
            'storage_region',
            sa.Enum('US', 'EU', 'ITAR', name='storageregion'),
            nullable=False
        ),
        sa.PrimaryKeyConstraint('upload_id'),
        sa.UniqueConstraint(
            'link_uuid',
            'blob_name',
            name='uq_upload_blob_name_per_link'
        ),
        schema='LinkDB'
    )

    op.create_index(
        op.f('ix_LinkDB_upload_sessions_link_uuid'),
        'upload_sessions',
        ['link_uuid'],
        unique=False,
        schema='LinkDB'
    )

    op.create_index(
        op.f('ix_LinkDB_upload_sessions_upload_token'),
        'upload_sessions',
        ['upload_token'],
        unique=True,
        schema='LinkDB'
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_index(
        op.f('ix_LinkDB_upload_sessions_upload_token'),
        table_name='upload_sessions',
        schema='LinkDB'
    )

    op.drop_index(
        op.f('ix_LinkDB_upload_sessions_link_uuid'),
        table_name='upload_sessions',
        schema='LinkDB'
    )

    op.drop_table(
        'upload_sessions',
        schema='LinkDB'
    )