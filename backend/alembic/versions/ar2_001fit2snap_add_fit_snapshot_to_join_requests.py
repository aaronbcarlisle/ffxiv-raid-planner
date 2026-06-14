"""add fit_snapshot to join_requests

Revision ID: ar2_001fit2snap
Revises: f4g5h6i7j8k9
Create Date: 2026-06-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ar2_001fit2snap'
down_revision: Union[str, None] = 'f4g5h6i7j8k9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'static_join_requests',
        sa.Column('fit_snapshot', postgresql.JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column('static_join_requests', 'fit_snapshot')
