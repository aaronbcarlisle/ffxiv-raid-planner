"""Add static_join_requests table for discovery join flow

Revision ID: r8s9t0u1v2w3
Revises: p7q8r9s0t1u2
Create Date: 2026-06-01

Players who find a public static via discovery can send a join request.
Owner/Lead reviews and accepts or declines. One pending request per user
per static (enforced by unique constraint on the pair).
"""

from alembic import op
import sqlalchemy as sa

revision = 'r8s9t0u1v2w3'
down_revision = 'p7q8r9s0t1u2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'static_join_requests',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('static_group_id', sa.String(36),
                  sa.ForeignKey('static_groups.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('requester_user_id', sa.String(36),
                  sa.ForeignKey('users.id'),
                  nullable=False, index=True),
        sa.Column('status', sa.String(20), nullable=False, default='pending'),
        sa.Column('message', sa.Text, nullable=True),
        sa.Column('role_interest', sa.JSON, nullable=True),
        sa.Column('job_interest', sa.JSON, nullable=True),
        sa.Column('availability_note', sa.Text, nullable=True),
        sa.Column('share_discord', sa.Boolean, nullable=False, server_default='0'),
        sa.Column('resolved_at', sa.Text, nullable=True),
        sa.Column('resolved_by_user_id', sa.String(36),
                  sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.Text, nullable=False),
        sa.Column('updated_at', sa.Text, nullable=False),
    )
    op.create_index('ix_join_requests_status', 'static_join_requests', ['status'])


def downgrade() -> None:
    op.drop_index('ix_join_requests_status', table_name='static_join_requests')
    op.drop_table('static_join_requests')
