"""add schedule discord delivery overrides

Revision ID: u2v3w4x5y6z7
Revises: t1u2v3w4x5y6
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa

revision = 'u2v3w4x5y6z7'
down_revision = 't1u2v3w4x5y6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('schedule_sessions', sa.Column('mirror_to_discord', sa.Boolean(), nullable=False, server_default='1'))
    op.add_column('schedule_sessions', sa.Column('send_discord_reminders', sa.Boolean(), nullable=False, server_default='1'))
    op.add_column('schedule_sessions', sa.Column('reminder_offsets_minutes', sa.Text(), nullable=True))
    op.add_column('schedule_sessions', sa.Column('missing_rsvp_reminder_enabled', sa.Boolean(), nullable=True))


def downgrade():
    op.drop_column('schedule_sessions', 'missing_rsvp_reminder_enabled')
    op.drop_column('schedule_sessions', 'reminder_offsets_minutes')
    op.drop_column('schedule_sessions', 'send_discord_reminders')
    op.drop_column('schedule_sessions', 'mirror_to_discord')
