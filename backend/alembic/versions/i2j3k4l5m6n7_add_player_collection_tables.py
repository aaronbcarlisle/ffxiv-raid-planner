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
        sa.Column("intent", sa.String(15), nullable=False, server_default="interested"),
        sa.Column("priority", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("visibility", sa.String(20), nullable=False, server_default="private"),
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
    op.drop_index("ix_player_collection_intents_profile_id")
    op.drop_table("player_collection_intents")
    op.drop_index("ix_player_collection_snapshots_profile_id")
    op.drop_table("player_collection_snapshots")
