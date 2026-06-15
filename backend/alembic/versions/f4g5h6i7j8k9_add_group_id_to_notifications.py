"""add group_id to notifications

Revision ID: f4g5h6i7j8k9
Revises: e3f4g5h6i7j8
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = 'f4g5h6i7j8k9'
down_revision = 'e3f4g5h6i7j8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'notifications',
        sa.Column('group_id', sa.String(36), nullable=True),
    )
    op.create_index('ix_notifications_group_id', 'notifications', ['group_id'])


def downgrade():
    op.drop_index('ix_notifications_group_id', table_name='notifications')
    op.drop_column('notifications', 'group_id')
