"""add group_id to notifications

Revision ID: n1o2p3q4r5s6
Revises: ar2_001fit2snap
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = 'n1o2p3q4r5s6'
down_revision = 'ar2_001fit2snap'
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
