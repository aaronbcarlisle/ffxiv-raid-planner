"""Add schedule_availability_templates table

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-05-31

Stores a user's typical weekly availability pattern (day-of-week + time slots)
independent of specific dates.  Used by the "Typical week" grid view.
"""

from alembic import op
import sqlalchemy as sa

revision = 'p6q7r8s9t0u1'
down_revision = 'o5p6q7r8s9t0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'schedule_availability_templates',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('static_group_id', sa.String(36),
                  sa.ForeignKey('static_groups.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('user_id', sa.String(36),
                  sa.ForeignKey('users.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('day_of_week', sa.String(2), nullable=False),
        sa.Column('slots', sa.Text, nullable=False),
        sa.Column('updated_at', sa.Text, nullable=False),
        sa.UniqueConstraint(
            'static_group_id', 'user_id', 'day_of_week',
            name='uq_avail_template_group_user_day',
        ),
    )


def downgrade() -> None:
    op.drop_table('schedule_availability_templates')
