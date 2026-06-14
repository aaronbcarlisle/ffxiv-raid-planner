"""add is_public to bis_target_sets and expand purpose vocabulary

Revision ID: e3f4g5h6i7j8
Revises: d1e2f3g4h5i6
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'e3f4g5h6i7j8'
down_revision = 'h5i6j7k8l9m0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'bis_target_sets',
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():
    op.drop_column('bis_target_sets', 'is_public')
