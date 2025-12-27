"""Share code generation service"""

import secrets
import string

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Static, StaticGroup

# Alphanumeric characters excluding ambiguous ones (0, O, I, l)
SHARE_CODE_CHARS = string.ascii_uppercase.replace("O", "").replace("I", "") + string.digits.replace(
    "0", ""
)
SHARE_CODE_LENGTH = 6
MAX_ATTEMPTS = 10


def _generate_code() -> str:
    """Generate a random share code"""
    return "".join(secrets.choice(SHARE_CODE_CHARS) for _ in range(SHARE_CODE_LENGTH))


async def generate_share_code(session: AsyncSession) -> str:
    """
    Generate a unique share code that doesn't exist in the database.

    Checks both legacy Static table and new StaticGroup table to ensure uniqueness.

    Args:
        session: Database session

    Returns:
        A unique 6-character share code

    Raises:
        RuntimeError: If unable to generate unique code after MAX_ATTEMPTS
    """
    for _ in range(MAX_ATTEMPTS):
        code = _generate_code()

        # Check if code already exists in legacy Static table
        result = await session.execute(select(Static).where(Static.share_code == code))
        if result.scalar_one_or_none() is not None:
            continue

        # Check if code already exists in new StaticGroup table
        result = await session.execute(select(StaticGroup).where(StaticGroup.share_code == code))
        if result.scalar_one_or_none() is not None:
            continue

        return code

    raise RuntimeError(f"Unable to generate unique share code after {MAX_ATTEMPTS} attempts")
