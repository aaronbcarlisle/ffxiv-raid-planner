"""add_profile_fields_to_join_requests

Revision ID: a7b8c9d0e1f2
Revises: z6a7b8c9d0e1
Create Date: 2026-06-06

Adds profile-connected application fields to static_join_requests so
applicants can apply with their Solo Player Hub character, job, gear
snapshot, and readiness data attached.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "z6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("static_join_requests") as batch_op:
        batch_op.add_column(
            sa.Column("player_profile_id", sa.String(36), nullable=True)
        )
        batch_op.add_column(
            sa.Column("player_character_id", sa.String(36), nullable=True)
        )
        batch_op.add_column(
            sa.Column("selected_job", sa.String(10), nullable=True)
        )
        batch_op.add_column(
            sa.Column("selected_role", sa.String(20), nullable=True)
        )
        batch_op.add_column(
            sa.Column("included_alt_jobs", sa.JSON(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("gear_snapshot_summary", sa.JSON(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("readiness_at_apply", sa.String(20), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "profile_share_code_at_apply", sa.String(8), nullable=True
            )
        )
        batch_op.create_foreign_key(
            "fk_join_requests_player_profile",
            "player_profiles",
            ["player_profile_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            "fk_join_requests_player_character",
            "player_characters",
            ["player_character_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("static_join_requests") as batch_op:
        batch_op.drop_constraint(
            "fk_join_requests_player_character", type_="foreignkey"
        )
        batch_op.drop_constraint(
            "fk_join_requests_player_profile", type_="foreignkey"
        )
        batch_op.drop_column("profile_share_code_at_apply")
        batch_op.drop_column("readiness_at_apply")
        batch_op.drop_column("gear_snapshot_summary")
        batch_op.drop_column("included_alt_jobs")
        batch_op.drop_column("selected_role")
        batch_op.drop_column("selected_job")
        batch_op.drop_column("player_character_id")
        batch_op.drop_column("player_profile_id")
