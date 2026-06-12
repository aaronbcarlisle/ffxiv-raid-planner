"""Add webhook delivery status columns to schedule_discord_messages

Revision ID: e2f3g4h5i6j7
Revises: d1e2f3g4h5i6
Create Date: 2026-06-13

Persists last HTTP status, error text, and retry count so failures are
visible in the DB instead of only appearing in structured logs.
"""

from alembic import op
import sqlalchemy as sa

revision = 'e2f3g4h5i6j7'
down_revision = 'd1e2f3g4h5i6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'schedule_discord_messages',
        sa.Column('last_delivery_status', sa.Integer, nullable=True),
    )
    op.add_column(
        'schedule_discord_messages',
        sa.Column('last_delivery_error', sa.Text, nullable=True),
    )
    op.add_column(
        'schedule_discord_messages',
        sa.Column('delivery_retry_count', sa.Integer, nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('schedule_discord_messages', 'delivery_retry_count')
    op.drop_column('schedule_discord_messages', 'last_delivery_error')
    op.drop_column('schedule_discord_messages', 'last_delivery_status')
