"""Drop share_discord, add contact_discord to static_join_requests

Privacy hardening: remove the share_discord preference flag and replace
the old Discord-identity-leak pattern with a voluntary, user-provided
contact_discord handle that is redacted on resolution.

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Create Date: 2026-06-02
"""

from alembic import op
import sqlalchemy as sa

revision = 's9t0u1v2w3x4'
down_revision = 'r8s9t0u1v2w3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('static_join_requests') as batch_op:
        batch_op.drop_column('share_discord')
        batch_op.add_column(
            sa.Column('contact_discord', sa.String(100), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table('static_join_requests') as batch_op:
        batch_op.drop_column('contact_discord')
        batch_op.add_column(
            sa.Column('share_discord', sa.Boolean, nullable=False, server_default='0')
        )
