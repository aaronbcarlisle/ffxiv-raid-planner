"""add user navigation preferences

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-26

Adds two user-level navigation preferences:
  * remember_sub_tabs   (default true)  — keep the last sub-tab when revisiting a
    view, vs reset to the default sub-tab.
  * remember_static_tab (default false) — when switching statics, restore that
    static's last tab, vs stay on the current tab.

Booleans use sa.true()/sa.false() server defaults so Postgres accepts them
(sa.text("1")/("0") would render a bare integer and fail on a boolean column).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "remember_sub_tabs",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )
        batch_op.add_column(
            sa.Column(
                "remember_static_tab",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("remember_static_tab")
        batch_op.drop_column("remember_sub_tabs")
