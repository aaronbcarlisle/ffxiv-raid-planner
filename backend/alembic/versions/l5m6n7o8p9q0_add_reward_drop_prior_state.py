"""Add reward_drop_log.recipient_prior_state and recipient_prior_state_at

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-09-30

P0 safety slice, SEC-1 (design/redesign/plans/2026-09-30-p0-safety.md,
R-P0-2). `log_drop` flips a recipient's participant state need/want -> have,
and the new DELETE drop route restores that state, so the drop row now records
the state it replaced (NULL when the drop caused no flip) and when the flip
happened, which travels with the prior when a delete hands it to another drop.

Idempotent add-column, per j3k4l5m6n7o8_add_users_is_admin.py: dev SQLite
picks the column up from the model (create_all / _add_missing_columns), so the
guard keeps this a no-op there and it does real work only on a database built
by the migration chain (production, the migration-exec CI job).
"""

import sqlalchemy as sa

from alembic import op

revision = "l5m6n7o8p9q0"
down_revision = "k4l5m6n7o8p9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("reward_drop_log")}

    if "recipient_prior_state" not in columns:
        op.add_column(
            "reward_drop_log",
            sa.Column("recipient_prior_state", sa.String(10), nullable=True),
        )
    if "recipient_prior_state_at" not in columns:
        op.add_column(
            "reward_drop_log",
            sa.Column("recipient_prior_state_at", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("reward_drop_log")}

    if "recipient_prior_state_at" in columns:
        op.drop_column("reward_drop_log", "recipient_prior_state_at")
    if "recipient_prior_state" in columns:
        op.drop_column("reward_drop_log", "recipient_prior_state")
