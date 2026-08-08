"""Add player_collection_snapshots and player_collection_intents tables

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-08-07

Both models shipped with the Collections Center feature (#141) but no
migration was ever written for them. Local dev never noticed because
database.create_tables() runs Base.metadata.create_all, which builds every
table straight from the models; production only runs `alembic upgrade head`,
so these two tables were never created there. The result was
UndefinedTableError 500s for real users on any Collections read.

This migration creates both tables to match the model definitions in
app/models/player_collection_snapshot.py and app/models/player_collection_intent.py.

Index names use SQLAlchemy's default `ix_<table>_<column>` form so that a
database built by create_all (dev/SQLite) and one built by this migration
(prod/Postgres) agree.
"""

from alembic import op
import sqlalchemy as sa

revision = "i2j3k4l5m6n7"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotency guard, matching this repo's convention for new-table
    # migrations (p7q8r9s0t1u2, m3n4o5p6q7r8, u1v2w3x4y5z6, j0k1l2m3n4o5,
    # a1b2c3d4e5f6). It matters more than usual here: the whole premise of this
    # migration is that both tables already exist in every create_all-built
    # database, so this is the one migration guaranteed to meet its own tables
    # somewhere. Checked per-table so a partially-present schema still resolves.
    existing_tables = sa.inspect(op.get_bind()).get_table_names()

    if "player_collection_snapshots" not in existing_tables:
        op.create_table(
            "player_collection_snapshots",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "profile_id",
                sa.String(36),
                sa.ForeignKey("player_profiles.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "catalog_item_id",
                sa.String(36),
                sa.ForeignKey("collection_catalog_items.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "ownership_state",
                sa.String(10),
                nullable=False,
                server_default="unknown",
            ),
            sa.Column("token_count", sa.Integer(), nullable=True),
            sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
            sa.Column("confidence", sa.String(10), nullable=False, server_default="low"),
            sa.Column("last_synced_at", sa.Text, nullable=True),
            sa.Column("updated_at", sa.Text, nullable=False),
            sa.UniqueConstraint(
                "profile_id",
                "catalog_item_id",
                name="uq_player_collection_snapshot_profile_item",
            ),
        )
        op.create_index(
            "ix_player_collection_snapshots_profile_id",
            "player_collection_snapshots",
            ["profile_id"],
        )

    if "player_collection_intents" not in existing_tables:
        op.create_table(
            "player_collection_intents",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "profile_id",
                sa.String(36),
                sa.ForeignKey("player_profiles.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "catalog_item_id",
                sa.String(36),
                sa.ForeignKey("collection_catalog_items.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "intent", sa.String(15), nullable=False, server_default="interested"
            ),
            sa.Column("priority", sa.String(10), nullable=False, server_default="medium"),
            sa.Column(
                "visibility", sa.String(20), nullable=False, server_default="private"
            ),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("updated_at", sa.Text, nullable=False),
            sa.UniqueConstraint(
                "profile_id",
                "catalog_item_id",
                name="uq_player_collection_intent_profile_item",
            ),
        )
        op.create_index(
            "ix_player_collection_intents_profile_id",
            "player_collection_intents",
            ["profile_id"],
        )


def downgrade() -> None:
    # Mirror of upgrade(): only drop what is actually there, so a downgrade
    # against a partially-present schema doesn't fail on a missing table.
    existing_tables = sa.inspect(op.get_bind()).get_table_names()

    if "player_collection_intents" in existing_tables:
        op.drop_index(
            "ix_player_collection_intents_profile_id",
            table_name="player_collection_intents",
        )
        op.drop_table("player_collection_intents")

    if "player_collection_snapshots" in existing_tables:
        op.drop_index(
            "ix_player_collection_snapshots_profile_id",
            table_name="player_collection_snapshots",
        )
        op.drop_table("player_collection_snapshots")
