"""add goals alignment: intent_level, is_public on player_goals; static_objective_goals table

Revision ID: goal01a2b3c4d5
Revises: h5i6j7k8l9m0
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'goal01a2b3c4d5'
down_revision = 'h5i6j7k8l9m0'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    # ── player_goals columns ──────────────────────────────────────────
    # Both columns may already exist on SQLite dev because database.py
    # create_all + _add_missing_columns runs on every app startup before
    # migrations.  Skip the ADD COLUMN if the column is already present.
    existing = {col['name'] for col in inspector.get_columns('player_goals')}

    if 'intent_level' not in existing:
        op.add_column('player_goals', sa.Column('intent_level', sa.String(20), nullable=True))

    if 'is_public' not in existing:
        # Add nullable first — SQLite rejects ADD COLUMN NOT NULL without a
        # literal DEFAULT clause in the DDL (Alembic's server_default= is not
        # rendered into ALTER TABLE for SQLite).
        op.add_column('player_goals', sa.Column('is_public', sa.Boolean(), nullable=True, server_default=sa.text('0')))
        op.execute(sa.text("UPDATE player_goals SET is_public = 0 WHERE is_public IS NULL"))
        # Tighten to NOT NULL on Postgres after backfill.
        # SQLite does not support ALTER COLUMN; the ORM enforces the invariant there.
        if bind.dialect.name != 'sqlite':
            op.alter_column('player_goals', 'is_public', nullable=False)

    # ── static_objective_goals table ─────────────────────────────────
    # May already exist on SQLite dev (create_all creates it from the model).
    if not inspector.has_table('static_objective_goals'):
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
