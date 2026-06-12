"""add personal availability templates

Revision ID: 750c92e5c420
Revises: d0e1f2g3h4i5
Create Date: 2026-06-07 00:42:27.885451

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '750c92e5c420'
down_revision: Union[str, Sequence[str], None] = 'd0e1f2g3h4i5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'personal_availability_templates',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('day_of_week', sa.String(length=2), nullable=False),
        sa.Column('slots', sa.Text(), nullable=False),
        sa.Column('timezone', sa.String(length=64), nullable=False),
        sa.Column('updated_at', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'day_of_week', name='uq_personal_avail_template_user_day'),
    )
    with op.batch_alter_table('personal_availability_templates', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_personal_availability_templates_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('personal_availability_templates', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_personal_availability_templates_user_id'))

    op.drop_table('personal_availability_templates')
