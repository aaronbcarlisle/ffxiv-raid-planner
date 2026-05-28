"""add_plugin_auth_codes_table

Revision ID: p7q8r9s0t1u2
Revises: cd9366d7e965
Create Date: 2026-05-28 10:00:00.000000

Create the plugin_auth_codes table for the loopback OAuth/PKCE flow used by
the Dalamud plugin's browser sign-in.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "p7q8r9s0t1u2"
down_revision: Union[str, None] = "cd9366d7e965"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create plugin_auth_codes table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "plugin_auth_codes" in inspector.get_table_names():
        return

    op.create_table(
        "plugin_auth_codes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("code_challenge", sa.String(128), nullable=False),
        sa.Column("redirect_uri", sa.Text, nullable=False),
        sa.Column("expires_at", sa.Text, nullable=False),
        sa.Column("used", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.Text, nullable=False),
    )

    op.create_index("ix_plugin_auth_codes_user_id", "plugin_auth_codes", ["user_id"])
    op.create_index(
        "ix_plugin_auth_codes_code_hash", "plugin_auth_codes", ["code_hash"], unique=True
    )


def downgrade() -> None:
    """Drop plugin_auth_codes table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "plugin_auth_codes" not in inspector.get_table_names():
        return

    op.drop_index("ix_plugin_auth_codes_code_hash", table_name="plugin_auth_codes")
    op.drop_index("ix_plugin_auth_codes_user_id", table_name="plugin_auth_codes")
    op.drop_table("plugin_auth_codes")
