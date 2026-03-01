"""add_api_keys_table

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-02-24 12:00:00.000000

Create the api_keys table for external authentication (Dalamud plugin).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision: str = "m3n4o5p6q7r8"
down_revision: Union[str, None] = "l2m3n4o5p6q7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create api_keys table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Check if table already exists (idempotent)
    if "api_keys" in inspector.get_table_names():
        return

    op.create_table(
        "api_keys",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("key_prefix", sa.String(12), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("scopes", JSON, nullable=False),
        sa.Column("last_used_at", sa.Text, nullable=True),
        sa.Column("expires_at", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.Text, nullable=False),
    )

    op.create_index("ix_api_keys_user_id", "api_keys", ["user_id"])
    op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"], unique=True)


def downgrade() -> None:
    """Drop api_keys table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "api_keys" not in inspector.get_table_names():
        return

    op.drop_index("ix_api_keys_key_hash", table_name="api_keys")
    op.drop_index("ix_api_keys_user_id", table_name="api_keys")
    op.drop_table("api_keys")
