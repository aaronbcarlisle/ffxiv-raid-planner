"""Add collection_catalog_items table and catalog FK on collection_goals

Revision ID: e4f5g6h7i8j9
Revises: d3e4f5g6h7i8
Create Date: 2026-06-20 12:00:00.000000

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "e4f5g6h7i8j9"
down_revision: Union[str, None] = "d3e4f5g6h7i8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "collection_catalog_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("external_source", sa.String(30), nullable=False, server_default="manual"),
        sa.Column("external_id", sa.String(50), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("patch", sa.String(10), nullable=True),
        sa.Column("expansion", sa.String(10), nullable=True),
        sa.Column("icon_url", sa.Text, nullable=True),
        sa.Column("image_url", sa.Text, nullable=True),
        sa.Column("source_text", sa.Text, nullable=True),
        sa.Column("source_type", sa.String(30), nullable=True),
        sa.Column("source_duty_name", sa.String(200), nullable=True),
        sa.Column("source_duty_key", sa.String(100), nullable=True),
        sa.Column("token_name", sa.String(100), nullable=True),
        sa.Column("token_cost", sa.Integer, nullable=True),
        sa.Column("tradeable", sa.Boolean, nullable=True),
        sa.Column("rarity_owned_percent", sa.Float, nullable=True),
        sa.Column("metadata_json", sa.Text, nullable=True),
        sa.Column("is_curated", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("updated_at", sa.Text, nullable=False),
    )
    op.create_index("ix_catalog_category", "collection_catalog_items", ["category"])
    op.create_index("ix_catalog_expansion", "collection_catalog_items", ["expansion"])
    op.create_index(
        "ix_catalog_external", "collection_catalog_items",
        ["external_source", "external_id"], unique=True,
    )

    # Add catalog link + token fields to collection_goals
    op.add_column("collection_goals", sa.Column(
        "catalog_item_id", sa.String(36),
        sa.ForeignKey("collection_catalog_items.id", ondelete="SET NULL"),
        nullable=True,
    ))
    op.add_column("collection_goals", sa.Column("token_name", sa.String(100), nullable=True))
    op.add_column("collection_goals", sa.Column("token_cost", sa.Integer, nullable=True))


def downgrade() -> None:
    op.drop_column("collection_goals", "token_cost")
    op.drop_column("collection_goals", "token_name")
    op.drop_column("collection_goals", "catalog_item_id")
    op.drop_index("ix_catalog_external", "collection_catalog_items")
    op.drop_index("ix_catalog_expansion", "collection_catalog_items")
    op.drop_index("ix_catalog_category", "collection_catalog_items")
    op.drop_table("collection_catalog_items")
