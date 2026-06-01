"""Add static_join_requests table for discovery join flow

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-06-01

Players who find a public static via discovery can send a join request.
Owner/Lead reviews and accepts or declines. One pending request per user
per static (enforced by unique constraint on the pair).
"""

from alembic import op
import sqlalchemy as sa

revision = 'r8s9t0u1v2w3'
down_revision = 'q7r8s9t0u1v2'
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
        sa.Column('role_interest', sa.String(30), nullable=True),
        sa.Column('job_interest', sa.String(10), nullable=True),
        sa.Column('availability_note', sa.Text, nullable=True),
        sa.Column('resolved_at', sa.Text, nullable=True),
        sa.Column('resolved_by_user_id', sa.String(36),
                  sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.Text, nullable=False),
        sa.Column('updated_at', sa.Text, nullable=False),
        sa.UniqueConstraint(
            'static_group_id', 'requester_user_id',
            name='uq_one_pending_per_user_per_static',
        ),
    )
    op.create_index('ix_join_requests_status', 'static_join_requests', ['status'])


def downgrade() -> None:
    op.drop_index('ix_join_requests_status', table_name='static_join_requests')
    op.drop_table('static_join_requests')
