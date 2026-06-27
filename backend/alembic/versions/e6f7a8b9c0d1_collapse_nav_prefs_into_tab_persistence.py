"""collapse nav prefs into tab_persistence

Revision ID: e6f7a8b9c0d1
Revises: d4e5f6a7b8c9
Create Date: 2026-06-26

Replaces the remember_sub_tabs / remember_static_tab boolean pair with a single
tab_persistence string ('remember' | 'reset') that governs navigational tab
memory site-wide. Existing rows backfill to 'remember' (the prior default for
sub-tabs; main/static tabs were previously always remembered).

Uses batch_alter_table so SQLite (dev) and Postgres (prod) both apply the
add + drops correctly.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "tab_persistence",
                sa.String(length=20),
                nullable=False,
                server_default="remember",
            )
        )
        batch_op.drop_column("remember_sub_tabs")
        batch_op.drop_column("remember_static_tab")


def downgrade() -> None:
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
        batch_op.drop_column("tab_persistence")
