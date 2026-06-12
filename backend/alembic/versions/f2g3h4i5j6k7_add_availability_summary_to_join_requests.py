"""add_application_snapshot_safety_fields

Revision ID: f2g3h4i5j6k7
Revises: 750c92e5c420
Create Date: 2026-06-07

Stores privacy-safe application-time availability and sharing state
without exposing exact personal availability slots.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2g3h4i5j6k7"
down_revision: Union[str, None] = "750c92e5c420"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing_columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("static_join_requests")
    }
    with op.batch_alter_table("static_join_requests") as batch_op:
        if "availability_summary" not in existing_columns:
            batch_op.add_column(sa.Column("availability_summary", sa.JSON(), nullable=True))
        if "profile_visibility_at_apply" not in existing_columns:
            batch_op.add_column(sa.Column("profile_visibility_at_apply", sa.String(20), nullable=True))
        if "profile_share_enabled_at_apply" not in existing_columns:
            batch_op.add_column(sa.Column("profile_share_enabled_at_apply", sa.Boolean(), nullable=True))


def downgrade() -> None:
    existing_columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("static_join_requests")
    }
    with op.batch_alter_table("static_join_requests") as batch_op:
        if "profile_share_enabled_at_apply" in existing_columns:
            batch_op.drop_column("profile_share_enabled_at_apply")
        if "profile_visibility_at_apply" in existing_columns:
            batch_op.drop_column("profile_visibility_at_apply")
        if "availability_summary" in existing_columns:
            batch_op.drop_column("availability_summary")
