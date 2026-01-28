"""remove_email_column

Revision ID: i9j0k1l2m3n4
Revises: g7h8i9j0k1l2
Create Date: 2026-01-28 12:00:00.000000

Removes the email column from the users table. Email was collected during
Discord OAuth but never used by any feature. This migration purges existing
email data and drops the column for data minimization/privacy compliance.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "i9j0k1l2m3n4"
down_revision: Union[str, None] = "g7h8i9j0k1l2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col["name"] for col in inspector.get_columns("users")]

    if "email" in existing_columns:
        # Audit: Log count of users with emails before purging
        result = bind.execute(
            sa.text("SELECT COUNT(*) FROM users WHERE email IS NOT NULL")
        )
        email_count = result.scalar()
        print(f"AUDIT: Purging {email_count} email addresses from users table")

        # Drop the email column (implicitly removes all data)
        op.drop_column("users", "email")
        print("SUCCESS: email column removed from users table")
    else:
        print("SKIP: email column does not exist (already removed)")


def downgrade() -> None:
    # Add column back (data will be lost - this is intentional)
    # Note: Email data cannot be recovered after upgrade
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col["name"] for col in inspector.get_columns("users")]

    if "email" not in existing_columns:
        op.add_column(
            "users",
            sa.Column("email", sa.String(255), nullable=True),
        )
        print("RESTORED: email column added back to users table (data was lost)")
