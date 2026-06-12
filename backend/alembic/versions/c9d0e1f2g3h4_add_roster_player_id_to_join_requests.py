"""add_roster_player_id_to_join_requests

Revision ID: c9d0e1f2g3h4
Revises: b8c9d0e1f2g3
Create Date: 2026-06-06

Tracks which SnapshotPlayer (roster slot) was created from an accepted
join request, enabling post-accept roster onboarding and duplicate
prevention.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c9d0e1f2g3h4"
down_revision: Union[str, None] = "b8c9d0e1f2g3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("static_join_requests") as batch_op:
        batch_op.add_column(
            sa.Column("roster_player_id", sa.String(36), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_join_requests_roster_player",
            "snapshot_players",
            ["roster_player_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("static_join_requests") as batch_op:
        batch_op.drop_constraint(
            "fk_join_requests_roster_player", type_="foreignkey"
        )
        batch_op.drop_column("roster_player_id")
