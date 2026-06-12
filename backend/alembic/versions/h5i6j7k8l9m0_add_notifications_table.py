"""Add notifications table

Revision ID: h5i6j7k8l9m0
Revises: g4h5i6j7k8l9
Create Date: 2026-06-13

Persisted in-app notifications with read/unread state.  Enables the
notification bell/badge UI and read-state persistence across sessions.
"""

from alembic import op
import sqlalchemy as sa

revision = 'h5i6j7k8l9m0'
down_revision = 'g4h5i6j7k8l9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'notifications',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column(
            'user_id', sa.String(36),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False, index=True,
        ),
        sa.Column('notification_type', sa.String(50), nullable=False),
        sa.Column('title', sa.Text, nullable=False),
        sa.Column('body', sa.Text, nullable=True),
        sa.Column('href', sa.Text, nullable=True),
        sa.Column('is_read', sa.Boolean, nullable=False, server_default='0'),
        sa.Column('created_at', sa.Text, nullable=False),
    )


def downgrade() -> None:
    op.drop_table('notifications')
