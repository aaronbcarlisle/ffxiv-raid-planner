"""Add schedule_discord_messages table for webhook message persistence

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Create Date: 2026-05-31

Stores Discord webhook message IDs so that RSVP/session changes can edit
the existing announcement instead of posting a new message every time.
"""

from alembic import op
import sqlalchemy as sa

revision = 'q7r8s9t0u1v2'
down_revision = 'p6q7r8s9t0u1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'schedule_discord_messages',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('session_id', sa.String(36),
                  sa.ForeignKey('schedule_sessions.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('static_group_id', sa.String(36),
                  sa.ForeignKey('static_groups.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('occurrence_start_time', sa.Text, nullable=True),
        sa.Column('webhook_message_id', sa.Text, nullable=False),
        sa.Column('webhook_thread_id', sa.Text, nullable=True),
        sa.Column('last_posted_at', sa.Text, nullable=True),
        sa.Column('last_edited_at', sa.Text, nullable=True),
        sa.Column('last_rsvp_hash', sa.Text, nullable=True),
        sa.Column('created_at', sa.Text, nullable=False),
        sa.Column('updated_at', sa.Text, nullable=False),
        sa.UniqueConstraint(
            'session_id', 'occurrence_start_time',
            name='uq_discord_msg_session_occurrence',
        ),
    )


def downgrade() -> None:
    op.drop_table('schedule_discord_messages')
