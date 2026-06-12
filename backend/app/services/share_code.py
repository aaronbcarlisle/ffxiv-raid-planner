"""Share code generation service"""

import secrets
import string

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import StaticGroup
from ..models.player_profile import PlayerProfile

# Alphanumeric characters excluding ambiguous ones (0, O, I, l)
SHARE_CODE_CHARS = string.ascii_uppercase.replace("O", "").replace("I", "") + string.digits.replace(
    "0", ""
)
SHARE_CODE_LENGTH = 6
PROFILE_SHARE_CODE_LENGTH = 8
MAX_ATTEMPTS = 10


def _generate_code(length: int = SHARE_CODE_LENGTH) -> str:
    """Generate a random share code"""
    return "".join(secrets.choice(SHARE_CODE_CHARS) for _ in range(length))


async def generate_share_code(session: AsyncSession) -> str:
    """
    Generate a unique share code that doesn't exist in the database.

    Args:
        session: Database session

    Returns:
        A unique 6-character share code

    Raises:
        RuntimeError: If unable to generate unique code after MAX_ATTEMPTS
    """
    for _ in range(MAX_ATTEMPTS):
        code = _generate_code()

        # Check if code already exists in StaticGroup table
        result = await session.execute(select(StaticGroup).where(StaticGroup.share_code == code))
        if result.scalar_one_or_none() is not None:
            continue

        return code

    raise RuntimeError(f"Unable to generate unique share code after {MAX_ATTEMPTS} attempts")


async def generate_profile_share_code(session: AsyncSession) -> str:
    """Generate a unique 8-char share code for a player profile.

    Uses a longer code than static groups to avoid collisions across
    both namespaces and to make profile URLs non-enumerable.
    """
    for _ in range(MAX_ATTEMPTS):
        code = _generate_code(PROFILE_SHARE_CODE_LENGTH)

        result = await session.execute(
            select(PlayerProfile).where(PlayerProfile.share_code == code)
        )
        if result.scalar_one_or_none() is not None:
            continue

        return code

    raise RuntimeError(f"Unable to generate unique profile share code after {MAX_ATTEMPTS} attempts")
