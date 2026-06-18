"""add schedule exceptions, discord mirrors, banner fields, and bot settings

Revision ID: s7t8u9v0w1x2
Revises: n1o2p3q4r5s6
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa

revision = 's7t8u9v0w1x2'
down_revision = 'n1o2p3q4r5s6'
branch_labels = None
depends_on = None


def upgrade():
    # ── Banner fields on schedule_sessions ──────────────────────────────────
    op.add_column('schedule_sessions', sa.Column('banner_url', sa.Text(), nullable=True))
    op.add_column('schedule_sessions', sa.Column('banner_key', sa.String(500), nullable=True))
    op.add_column('schedule_sessions', sa.Column('banner_source_type', sa.String(20), nullable=True))

    # ── Discord bot settings on schedule_settings ────────────────────────────
    op.add_column('schedule_settings', sa.Column('discord_bot_token', sa.Text(), nullable=True))
    op.add_column('schedule_settings', sa.Column('discord_guild_id', sa.String(32), nullable=True))

    # ── schedule_exceptions ──────────────────────────────────────────────────
    op.create_table(
        'schedule_exceptions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('session_id', sa.String(36), nullable=False),
        sa.Column('occurrence_date', sa.String(20), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('override_start_time', sa.Text(), nullable=True),
        sa.Column('override_end_time', sa.Text(), nullable=True),
        sa.Column('override_title', sa.String(200), nullable=True),
        sa.Column('override_description', sa.Text(), nullable=True),
        sa.Column('override_banner_url', sa.Text(), nullable=True),
        sa.Column('override_banner_key', sa.String(500), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.String(36), nullable=False),
        sa.Column('created_at', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['schedule_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id', 'occurrence_date', name='uq_schedule_exception_session_occurrence'),
    )
    op.create_index('ix_schedule_exceptions_session_id', 'schedule_exceptions', ['session_id'])

    # ── schedule_discord_mirrors ─────────────────────────────────────────────
    op.create_table(
        'schedule_discord_mirrors',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('session_id', sa.String(36), nullable=False),
        sa.Column('occurrence_date', sa.String(20), nullable=True),
        sa.Column('discord_guild_id', sa.String(32), nullable=False),
        sa.Column('discord_scheduled_event_id', sa.Text(), nullable=False),
        sa.Column('discord_channel_id', sa.String(32), nullable=True),
        sa.Column('sync_status', sa.String(30), nullable=False, server_default='pending'),
        sa.Column('last_synced_at', sa.Text(), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('banner_hash_synced', sa.String(64), nullable=True),
        sa.Column('created_at', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['schedule_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id', 'occurrence_date', name='uq_discord_mirror_session_occurrence'),
    )
    op.create_index('ix_schedule_discord_mirrors_session_id', 'schedule_discord_mirrors', ['session_id'])


def downgrade():
    op.drop_index('ix_schedule_discord_mirrors_session_id', table_name='schedule_discord_mirrors')
    op.drop_table('schedule_discord_mirrors')

    op.drop_index('ix_schedule_exceptions_session_id', table_name='schedule_exceptions')
    op.drop_table('schedule_exceptions')

    op.drop_column('schedule_settings', 'discord_guild_id')
    op.drop_column('schedule_settings', 'discord_bot_token')

    op.drop_column('schedule_sessions', 'banner_source_type')
    op.drop_column('schedule_sessions', 'banner_key')
    op.drop_column('schedule_sessions', 'banner_url')
