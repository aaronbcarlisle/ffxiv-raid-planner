"""Add audit_log table

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-08-08

Site-wide admin/action audit log (Admin Dashboard V2 slice AD1a; spec
design/redesign/specs/2026-08-08-admin-v2-spec.md §3.1). Rows are written in
the same session as the mutation they record, so the pair commits atomically.

Conventions per the PR #233 lesson: idempotency guard (no-op if the table
already exists), sa.false() rather than a literal "0" server_default for the
boolean (PostgreSQL rejects BOOLEAN DEFAULT 0), portable types only — this
migration must pass both the SQLite create_all dev path and the live
PostgreSQL round-trip the migration-exec CI job runs.

target_id is String(64), not 36: error-review targets are SHA-256
fingerprints (error_reports.fingerprint). static_group_id intentionally has
NO foreign key — audit rows must survive static deletion. actor_user_id is
nullable so ON DELETE SET NULL (and GDPR user deletion) is valid.
"""

from alembic import op
import sqlalchemy as sa

revision = "k4l5m6n7o8p9"
down_revision = "j3k4l5m6n7o8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    tables = sa.inspect(op.get_bind()).get_table_names()

    if "audit_log" not in tables:
        op.create_table(
            "audit_log",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column(
                "actor_user_id",
                sa.String(36),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("actor_label", sa.String(100), nullable=False),
            sa.Column("credential", sa.String(10), nullable=False),
            sa.Column("impersonating_user_id", sa.String(36), nullable=True),
            sa.Column(
                "admin_override",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
            sa.Column("action", sa.String(60), nullable=False),
            sa.Column("target_type", sa.String(30), nullable=False),
            sa.Column("target_id", sa.String(64), nullable=False),
            sa.Column("target_label", sa.String(200), nullable=False),
            sa.Column("static_group_id", sa.String(36), nullable=True),
            sa.Column("old_values", sa.JSON(), nullable=True),
            sa.Column("new_values", sa.JSON(), nullable=True),
            sa.Column("request_id", sa.String(36), nullable=True),
        )
        op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])
        op.create_index("ix_audit_log_actor_user_id", "audit_log", ["actor_user_id"])
        op.create_index("ix_audit_log_action", "audit_log", ["action"])
        op.create_index("ix_audit_log_static_group_id", "audit_log", ["static_group_id"])
        op.create_index("ix_audit_log_target", "audit_log", ["target_type", "target_id"])


def downgrade() -> None:
    tables = sa.inspect(op.get_bind()).get_table_names()

    if "audit_log" in tables:
        op.drop_table("audit_log")
