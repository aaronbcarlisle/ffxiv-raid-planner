"""add goals alignment: intent_level, is_public on player_goals; static_objective_goals table

Revision ID: e2f3g4h5i6j7
Revises: d1e2f3g4h5i6
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

revision = 'e2f3g4h5i6j7'
down_revision = 'd1e2f3g4h5i6'
branch_labels = None
depends_on = None


def upgrade():
    # Add intent_level and is_public to player_goals
    op.add_column('player_goals', sa.Column('intent_level', sa.String(20), nullable=True))
    op.add_column('player_goals', sa.Column('is_public', sa.Boolean(), nullable=False, server_default='0'))

    # Create static_objective_goals table
    op.create_table(
        'static_objective_goals',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('static_group_id', sa.String(36), nullable=False),
        sa.Column('created_by_id', sa.String(36), nullable=True),
        sa.Column('category', sa.String(30), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(20), nullable=False),
        sa.Column('created_at', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(
            ['static_group_id'], ['static_groups.id'],
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['created_by_id'], ['users.id'],
            ondelete='SET NULL',
        ),
    )
    op.create_index(
        'ix_static_objective_goals_static_group_id',
        'static_objective_goals',
        ['static_group_id'],
    )


def downgrade():
    op.drop_index('ix_static_objective_goals_static_group_id', table_name='static_objective_goals')
    op.drop_table('static_objective_goals')
    op.drop_column('player_goals', 'is_public')
    op.drop_column('player_goals', 'intent_level')
