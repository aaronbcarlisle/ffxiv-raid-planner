"""add ui_shell preference

Revision ID: h1i2j3k4l5m6
Revises: e6f7a8b9c0d1
Create Date: 2026-07-11

Adds User.ui_shell — the cross-device mirror of the dual-shell rollout
preference (Phase R). Persists 'legacy' | 'v2', which shell chrome renders
/group/:shareCode for this user. Existing rows backfill to 'legacy' (the
current default in frontend/src/lib/shellPreference.ts).

Uses batch_alter_table so SQLite (dev) and Postgres (prod) both apply the
add/drop correctly.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "h1i2j3k4l5m6"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "ui_shell",
                sa.String(length=10),
                nullable=False,
                server_default="legacy",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("ui_shell")
