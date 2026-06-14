"""Add activity_display_mode column to users

Revision ID: f3g4h5i6j7k8
Revises: e2f3g4h5i6j7
Create Date: 2026-06-13

Allows users to choose whether their activity appears as named or anonymous
in the static overview feed.  Defaults to 'named' (current behaviour).
"""

from alembic import op
import sqlalchemy as sa

revision = 'f3g4h5i6j7k8'
down_revision = 'e2f3g4h5i6j7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'activity_display_mode',
            sa.String(20),
            nullable=False,
            server_default='named',
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'activity_display_mode')
