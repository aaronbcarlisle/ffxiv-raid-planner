"""migrate player_bis_target_sets to shared bis_target_sets

Adds owner_type / owner_id generic ownership, a typed FK for roster context
(snapshot_player_id), patch and created_by columns; renames the table from
player_bis_target_sets to bis_target_sets.

Revision ID: d1e2f3g4h5i6
Revises: c9d0e1f2a3b4
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = 'd1e2f3g4h5i6'
down_revision = 'c9d0e1f2a3b4'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'bis_target_sets',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('owner_type', sa.String(30), nullable=False),
        sa.Column('owner_id', sa.String(36), nullable=False),
        sa.Column('job_profile_id', sa.String(36), nullable=True),
        sa.Column('snapshot_player_id', sa.String(36), nullable=True),
        sa.Column('group_id', sa.String(36), nullable=True),
        sa.Column('profile_id', sa.String(36), nullable=True),
        sa.Column('job', sa.String(10), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('purpose', sa.String(20), nullable=False, server_default='savage'),
        sa.Column('source_type', sa.String(20), nullable=False, server_default='manual'),
        sa.Column('external_url', sa.Text(), nullable=True),
        sa.Column('import_status', sa.String(20), nullable=False, server_default='linked_only'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('patch', sa.String(20), nullable=True),
        sa.Column('item_level', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('items_json', sa.JSON(), nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
        sa.Column('created_at', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ['job_profile_id'], ['player_job_profiles.id'], ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['snapshot_player_id'], ['snapshot_players.id'], ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['created_by'], ['users.id'], ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_bis_target_sets_owner_id', 'bis_target_sets', ['owner_id'])
    op.create_index('ix_bis_target_sets_job_profile_id', 'bis_target_sets', ['job_profile_id'])
    op.create_index('ix_bis_target_sets_snapshot_player_id', 'bis_target_sets', ['snapshot_player_id'])
    op.create_index('ix_bis_target_sets_group_id', 'bis_target_sets', ['group_id'])
    op.create_index('ix_bis_target_sets_owner', 'bis_target_sets', ['owner_type', 'owner_id'])

    # Migrate existing player_bis_target_sets rows
    op.execute("""
        INSERT INTO bis_target_sets (
            id, owner_type, owner_id, job_profile_id, profile_id,
            job, name, purpose, source_type, external_url,
            import_status, is_active, item_level, notes, items_json,
            created_by, created_at, updated_at
        )
        SELECT
            p.id,
            'player_job_profile',
            p.job_profile_id,
            p.job_profile_id,
            p.profile_id,
            p.job, p.name, p.purpose, p.source_type, p.external_url,
            p.import_status, p.is_active, p.item_level, p.notes, p.items_json,
            pp.user_id,
            p.created_at, p.updated_at
        FROM player_bis_target_sets p
        JOIN player_profiles pp ON pp.id = p.profile_id
    """)

    op.drop_table('player_bis_target_sets')


def downgrade():
    op.create_table(
        'player_bis_target_sets',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('profile_id', sa.String(36), nullable=False),
        sa.Column('job_profile_id', sa.String(36), nullable=False),
        sa.Column('job', sa.String(10), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('purpose', sa.String(20), nullable=False, server_default='savage'),
        sa.Column('source_type', sa.String(20), nullable=False, server_default='manual'),
        sa.Column('external_url', sa.Text(), nullable=True),
        sa.Column('import_status', sa.String(20), nullable=False, server_default='linked_only'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('item_level', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('items_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['profile_id'], ['player_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['job_profile_id'], ['player_job_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_player_bis_target_sets_profile_id', 'player_bis_target_sets', ['profile_id'],
    )
    op.create_index(
        'ix_player_bis_target_sets_job_profile_id', 'player_bis_target_sets', ['job_profile_id'],
    )

    op.execute("""
        INSERT INTO player_bis_target_sets (
            id, profile_id, job_profile_id,
            job, name, purpose, source_type, external_url,
            import_status, is_active, item_level, notes, items_json,
            created_at, updated_at
        )
        SELECT
            id, profile_id, owner_id,
            job, name, purpose, source_type, external_url,
            import_status, is_active, item_level, notes, items_json,
            created_at, updated_at
        FROM bis_target_sets
        WHERE owner_type = 'player_job_profile'
    """)

    for idx in [
        'ix_bis_target_sets_owner',
        'ix_bis_target_sets_owner_id',
        'ix_bis_target_sets_job_profile_id',
        'ix_bis_target_sets_snapshot_player_id',
        'ix_bis_target_sets_group_id',
    ]:
        op.drop_index(idx, table_name='bis_target_sets')
    op.drop_table('bis_target_sets')
