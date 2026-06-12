"""Add static_activity_log table

Revision ID: g4h5i6j7k8l9
Revises: f3g4h5i6j7k8
Create Date: 2026-06-13

Persists notable group events (mount obtained, totem updated, plugin sync)
so the Recent Activity feed survives page refreshes and new sessions.
"""

from alembic import op
import sqlalchemy as sa

revision = 'g4h5i6j7k8l9'
down_revision = 'f3g4h5i6j7k8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'static_activity_log',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column(
            'static_group_id', sa.String(36),
            sa.ForeignKey('static_groups.id', ondelete='CASCADE'),
            nullable=False, index=True,
        ),
        sa.Column(
            'actor_user_id', sa.String(36),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column('actor_display_name', sa.Text, nullable=True),
        sa.Column('actor_display', sa.String(20), nullable=False, server_default='named'),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('trial_id', sa.Text, nullable=True),
        sa.Column('label', sa.Text, nullable=False),
        sa.Column('created_at', sa.Text, nullable=False),
    )


def downgrade() -> None:
    op.drop_table('static_activity_log')
