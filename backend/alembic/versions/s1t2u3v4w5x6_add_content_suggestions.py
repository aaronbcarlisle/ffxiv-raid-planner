"""Add content suggestions, suggestion votes, and join request alignment snapshot

Revision ID: s1t2u3v4w5x6
Revises: goal01a2b3c4d5
Create Date: 2026-06-13

New tables:
  - static_content_suggestions
  - static_content_suggestion_votes

New column:
  - static_join_requests.goal_alignment_snapshot (JSON, nullable)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 's1t2u3v4w5x6'
down_revision = 'goal01a2b3c4d5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # ── static_content_suggestions ───────────────────────────────────────
    if not inspector.has_table('static_content_suggestions'):
        op.create_table(
            'static_content_suggestions',
            sa.Column('id', sa.String(36), nullable=False),
            sa.Column('static_group_id', sa.String(36), nullable=False),
            sa.Column('suggested_by_user_id', sa.String(36), nullable=False),
            sa.Column('promoted_goal_id', sa.String(36), nullable=True),
            sa.Column('category', sa.String(30), nullable=False),
            sa.Column('title', sa.String(200), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('status', sa.String(20), nullable=False, server_default='open'),
            sa.Column('created_at', sa.Text(), nullable=False),
            sa.Column('updated_at', sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(
                ['static_group_id'], ['static_groups.id'], ondelete='CASCADE',
            ),
            sa.ForeignKeyConstraint(
                ['suggested_by_user_id'], ['users.id'], ondelete='CASCADE',
            ),
            sa.ForeignKeyConstraint(
                ['promoted_goal_id'], ['static_objective_goals.id'], ondelete='SET NULL',
            ),
        )
        op.create_index(
            'ix_static_content_suggestions_group_id',
            'static_content_suggestions',
            ['static_group_id'],
        )
        op.create_index(
            'ix_static_content_suggestions_user_id',
            'static_content_suggestions',
            ['suggested_by_user_id'],
        )

    # ── static_content_suggestion_votes ──────────────────────────────────
    if not inspector.has_table('static_content_suggestion_votes'):
        op.create_table(
            'static_content_suggestion_votes',
            sa.Column('id', sa.String(36), nullable=False),
            sa.Column('suggestion_id', sa.String(36), nullable=False),
            sa.Column('user_id', sa.String(36), nullable=False),
            sa.Column('vote', sa.String(20), nullable=False),
            sa.Column('note', sa.Text(), nullable=True),
            sa.Column('created_at', sa.Text(), nullable=False),
            sa.Column('updated_at', sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('suggestion_id', 'user_id', name='uq_suggestion_vote_per_user'),
            sa.ForeignKeyConstraint(
                ['suggestion_id'], ['static_content_suggestions.id'], ondelete='CASCADE',
            ),
            sa.ForeignKeyConstraint(
                ['user_id'], ['users.id'], ondelete='CASCADE',
            ),
        )
        op.create_index(
            'ix_static_content_suggestion_votes_suggestion_id',
            'static_content_suggestion_votes',
            ['suggestion_id'],
        )

    # ── static_join_requests.goal_alignment_snapshot ─────────────────────
    existing = {col['name'] for col in inspector.get_columns('static_join_requests')}
    if 'goal_alignment_snapshot' not in existing:
        op.add_column(
            'static_join_requests',
            sa.Column('goal_alignment_snapshot', sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column('static_join_requests', 'goal_alignment_snapshot')
    op.drop_index('ix_static_content_suggestion_votes_suggestion_id', table_name='static_content_suggestion_votes')
    op.drop_table('static_content_suggestion_votes')
    op.drop_index('ix_static_content_suggestions_user_id', table_name='static_content_suggestions')
    op.drop_index('ix_static_content_suggestions_group_id', table_name='static_content_suggestions')
    op.drop_table('static_content_suggestions')
