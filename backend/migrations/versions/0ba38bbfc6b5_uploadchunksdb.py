"""UploadChunksDB

Revision ID: 0ba38bbfc6b5
Revises: 4d8bf879491e
Create Date: 2026-07-14 18:36:00.727108

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0ba38bbfc6b5"
down_revision: Union[str, Sequence[str], None] = "4d8bf879491e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # ---------------------------------------------------------
    # Update upload_sessions
    # Replace expected_sha256 with generic hash fields
    # ---------------------------------------------------------

    op.add_column(
        "upload_sessions",
        sa.Column(
            "expected_hash",
            sa.Text(),
            nullable=True
        ),
        schema="LinkDB"
    )

    op.add_column(
        "upload_sessions",
        sa.Column(
            "hash_algorithm",
            sa.String(length=32),
            nullable=False,
            server_default="blake3-merkle"
        ),
        schema="LinkDB"
    )

    # Copy existing SHA256 values if the column exists
    op.execute(
        sa.text(
            """
            UPDATE "LinkDB".upload_sessions
            SET expected_hash = expected_sha256,
                hash_algorithm = 'sha256'
            """
        )
    )

    op.drop_column(
        "upload_sessions",
        "expected_sha256",
        schema="LinkDB"
    )

    # ---------------------------------------------------------
    # Update uploads table hash column
    # sha256 -> file_hash
    # ---------------------------------------------------------

    op.alter_column(
        "uploads",
        "sha256",
        new_column_name="file_hash",
        existing_type=sa.Text(),
        schema="LinkDB"
    )

    # ---------------------------------------------------------
    # Create upload_chunks table
    # ---------------------------------------------------------

    op.create_table(
        "upload_chunks",
        sa.Column(
            "id",
            sa.UUID(as_uuid=False),
            nullable=False
        ),
        sa.Column(
            "upload_id",
            sa.UUID(as_uuid=False),
            nullable=False
        ),
        sa.Column(
            "offset",
            sa.BigInteger(),
            nullable=False
        ),
        sa.Column(
            "size",
            sa.Integer(),
            nullable=False
        ),
        sa.Column(
            "chunk_index",
            sa.Integer(),
            nullable=False
        ),
        sa.Column(
            "hash",
            sa.String(length=64),
            nullable=False
        ),
        sa.Column(
            "algorithm",
            sa.String(length=32),
            nullable=False,
            server_default="blake3"
        ),
        sa.Column(
            "uploaded",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true()
        ),
        sa.ForeignKeyConstraint(
            ["upload_id"],
            ["LinkDB.upload_sessions.upload_id"]
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "upload_id",
            "offset",
            name="uq_upload_chunk_offset"
        ),
        schema="LinkDB"
    )

    op.create_index(
        op.f("ix_LinkDB_upload_chunks_upload_id"),
        "upload_chunks",
        ["upload_id"],
        unique=False,
        schema="LinkDB"
    )


def downgrade() -> None:
    """Downgrade schema."""

    # Remove upload_chunks

    op.drop_index(
        op.f("ix_LinkDB_upload_chunks_upload_id"),
        table_name="upload_chunks",
        schema="LinkDB"
    )

    op.drop_table(
        "upload_chunks",
        schema="LinkDB"
    )

    # Restore uploads sha256 name

    op.alter_column(
        "uploads",
        "file_hash",
        new_column_name="sha256",
        existing_type=sa.Text(),
        schema="LinkDB"
    )

    # Restore upload_sessions sha256 field

    op.add_column(
        "upload_sessions",
        sa.Column(
            "expected_sha256",
            sa.Text(),
            nullable=True
        ),
        schema="LinkDB"
    )

    op.execute(
        sa.text(
            """
            UPDATE "LinkDB".upload_sessions
            SET expected_sha256 = expected_hash
            """
        )
    )

    op.drop_column(
        "upload_sessions",
        "expected_hash",
        schema="LinkDB"
    )

    op.drop_column(
        "upload_sessions",
        "hash_algorithm",
        schema="LinkDB"
    )