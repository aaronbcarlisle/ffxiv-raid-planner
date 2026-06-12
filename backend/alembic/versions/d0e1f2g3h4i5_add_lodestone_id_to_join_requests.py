"""add_lodestone_id_to_join_requests

Revision ID: d0e1f2g3h4i5
Revises: c9d0e1f2g3h4
Create Date: 2026-06-06

Captures the applicant's Lodestone ID at application time for stable
identity tracking alongside display-only name/world/avatar.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d0e1f2g3h4i5"
down_revision: Union[str, None] = "c9d0e1f2g3h4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("static_join_requests") as batch_op:
        batch_op.add_column(
            sa.Column("character_lodestone_id_at_apply", sa.String(50), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("static_join_requests") as batch_op:
        batch_op.drop_column("character_lodestone_id_at_apply")
