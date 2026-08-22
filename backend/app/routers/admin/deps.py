"""Shared dependencies for the admin surface."""

from fastapi import Depends

from ...dependencies import get_current_user_jwt_only
from ...models import User
from ...permissions import PermissionDenied


async def require_admin(user: User = Depends(get_current_user_jwt_only)) -> User:
    """Resolve the current user, requiring browser (JWT) auth and is_admin.

    JWT-only: a leaked xrp_ plugin key must never reach the admin surface, so
    API keys are rejected (403) before the admin check. No extra session
    dependency — ``user.is_admin`` is on the row the validator just loaded,
    the same value a fresh SELECT would return in this request's session.

    Sole permanent exception (spec §2.1): POST /api/admin/collection-catalog/
    import-verified-ids keeps xrp_-accepting auth — the Dalamud plugin's
    /xrp resolve-ids is a live caller. Catalog sync/seed are staged to AD9b.
    """
    if not user.is_admin:
        raise PermissionDenied("Admin access required")
    return user
