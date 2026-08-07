"""Add users.is_admin

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-08-07

`User.is_admin` has been on the model for a long time and exists in the
production database, but no migration ever created it -- production picked it
up outside the migration chain. A database built purely by
`alembic upgrade head` therefore has no `users.is_admin` at all, and the whole
admin system (app/permissions.py, the ADMIN_DISCORD_IDS bootstrap, View As)
fails against it.

Surfaced by scripts/check_model_tables.py, added in the same change as this
migration: production looked clean because it has the column, while a
from-base build did not.

Idempotent, per this repo's convention: production already has the column, so
this is a no-op there and only does real work on a database built from base.
Uses `sa.false()` rather than a literal "0" default -- PostgreSQL rejects
`BOOLEAN DEFAULT 0`, the exact dialect bug the migration-exec CI job exists to
catch.
"""

from alembic import op
import sqlalchemy as sa

revision = "j3k4l5m6n7o8"
down_revision = "i2j3k4l5m6n7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("users")}

    if "is_admin" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "is_admin",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )


def downgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("users")}

    if "is_admin" in columns:
        op.drop_column("users", "is_admin")
