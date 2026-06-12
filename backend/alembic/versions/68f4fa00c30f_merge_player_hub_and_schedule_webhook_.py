"""merge player hub and schedule webhook heads

Revision ID: 68f4fa00c30f
Revises: e1f2g3h4i5j6, f2g3h4i5j6k7
Create Date: 2026-06-08 03:25:06.436779

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "68f4fa00c30f"
down_revision: Union[str, Sequence[str], None] = (
    "e1f2g3h4i5j6",
    "f2g3h4i5j6k7",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
