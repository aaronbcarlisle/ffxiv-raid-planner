"""add discord_install_claims and static_discord_links tables

Revision ID: t1u2v3w4x5y6
Revises: s7t8u9v0w1x2
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa

revision = 't1u2v3w4x5y6'
down_revision = 's7t8u9v0w1x2'
branch_labels = None
depends_on = None


def upgrade():
    # ── discord_install_claims ───────────────────────────────────────────────
    op.create_table(
        'discord_install_claims',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('static_group_id', sa.String(36), nullable=False),
        sa.Column('created_by_id', sa.String(36), nullable=False),
        sa.Column('claim_token_hash', sa.String(64), nullable=False),
        sa.Column('oauth_state', sa.String(128), nullable=True),
        sa.Column('expires_at', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('discord_guild_id', sa.String(32), nullable=True),
        sa.Column('discord_channel_id', sa.String(32), nullable=True),
        sa.Column('claimed_by_discord_user_id', sa.String(32), nullable=True),
        sa.Column('created_at', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['static_group_id'], ['static_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('claim_token_hash', name='uq_discord_install_claim_token_hash'),
    )
    op.create_index('ix_discord_install_claims_static_group_id', 'discord_install_claims', ['static_group_id'])
    op.create_index('ix_discord_install_claims_claim_token_hash', 'discord_install_claims', ['claim_token_hash'])

    # ── static_discord_links ─────────────────────────────────────────────────
    op.create_table(
        'static_discord_links',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('static_group_id', sa.String(36), nullable=False),
        sa.Column('discord_guild_id', sa.String(32), nullable=False),
        sa.Column('discord_guild_name', sa.String(200), nullable=True),
        sa.Column('schedule_channel_id', sa.String(32), nullable=True),
        sa.Column('announcement_channel_id', sa.String(32), nullable=True),
        sa.Column('voice_channel_id', sa.String(32), nullable=True),
        sa.Column('linked_by_user_id', sa.String(36), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='connected'),
        sa.Column('permissions_snapshot', sa.Text(), nullable=True),
        sa.Column('last_permission_check_at', sa.Text(), nullable=True),
        sa.Column('created_at', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['static_group_id'], ['static_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['linked_by_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('static_group_id', name='uq_static_discord_link_group'),
    )
    op.create_index('ix_static_discord_links_static_group_id', 'static_discord_links', ['static_group_id'])
    op.create_index('ix_static_discord_links_discord_guild_id', 'static_discord_links', ['discord_guild_id'])


def downgrade():
    op.drop_index('ix_static_discord_links_discord_guild_id', table_name='static_discord_links')
    op.drop_index('ix_static_discord_links_static_group_id', table_name='static_discord_links')
    op.drop_table('static_discord_links')

    op.drop_index('ix_discord_install_claims_claim_token_hash', table_name='discord_install_claims')
    op.drop_index('ix_discord_install_claims_static_group_id', table_name='discord_install_claims')
    op.drop_table('discord_install_claims')
