"""Same-session audit-log emit helper (Admin Dashboard V2; spec §3.2).

VERB CATALOG — the single source of audit action names. Dot-namespaced
``family.verb`` strings; families land wave-by-wave (spec §3.3). Populated as
emit points ship:

    (wave 1, AD1b)  error.reviewed / error.unreviewed / error.batch_reviewed
                    catalog.synced / catalog.seeded / catalog.ids_imported
                    static.updated / static.deleted / static.ownership_transferred
                    static.duplicated / member.added / member.removed
                    member.role_changed / tier.deleted / player.deleted
                    week.reverted / player.admin_assigned

Semantics:

- ``audit()`` does a same-session ``session.add()`` and nothing else — the
  caller's commit finalizes the row atomically with the mutation it records.
  Fire-and-forget capture (the ``_capture_error_report`` pattern) is
  explicitly rejected for mutations: it can record actions that rolled back,
  or lose rows for actions that committed.
- ``credential`` comes from ``request.state.auth_credential`` (set by the
  auth validators). ``"cookie"`` includes legacy Authorization-header JWTs —
  the enum distinguishes plugin (``api_key``) from web (``cookie``), not
  cookie from header. Absent request/state (background tasks, optional-auth
  routes where no credential validated) it falls back to ``"system"``.
- ``old``/``new`` both given → only the changed keys are stored (update
  shape). One side given → stored as-is (full state on create/delete).
  Secret-shaped keys are always stripped (see ``_SECRET_KEYS``).

AD1b hazards, recorded here so emit authors see them:

- ``permissions.create_membership_for_assignment`` calls ``session.rollback()``
  in its IntegrityError handler — a pending (uncommitted) audit row added
  before that call is silently discarded. Emit AFTER calls that may roll back.
- ``get_current_user_optional`` returning ``None`` leaves
  ``request.state.auth_credential`` unset, so an emit on such a route would
  be labeled ``"system"``. Guard explicitly when product-ring emits (AD8)
  reach optional-auth routes.
"""

from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AuditLog, User

# Exact key names that are never persisted in old_values/new_values.
_SECRET_KEYS = {
    "token",
    "secret",
    "webhook_url",
    "code_challenge",
    "discord_bot_token",
    "calendar_token",
}
# Suffix rules: catches key_hash/code_hash, client_secret, calendar_token, etc.
# Deliberately NOT a bare "token" substring match — that would gut legitimate
# diff fields like token_name/token_cost/token_item_id/token_count.
_SECRET_SUFFIXES = ("_hash", "_secret", "_token")


def _is_secret_key(key: str) -> bool:
    lowered = key.lower()
    return lowered in _SECRET_KEYS or lowered.endswith(_SECRET_SUFFIXES)


def _strip_secrets(values: dict | None) -> dict | None:
    if values is None:
        return None
    return {k: v for k, v in values.items() if not _is_secret_key(k)}


def compute_changed_fields(
    old: dict, new: dict
) -> tuple[dict, dict]:
    """Return (old_changed, new_changed) keeping only keys whose values differ.

    Keys present on one side only are treated as changed (None on the missing
    side is implied by absence from the other dict).
    """
    old_changed: dict = {}
    new_changed: dict = {}
    for key in old.keys() | new.keys():
        old_value = old.get(key)
        new_value = new.get(key)
        if old_value != new_value:
            if key in old:
                old_changed[key] = old_value
            if key in new:
                new_changed[key] = new_value
    return old_changed, new_changed


async def audit(
    session: AsyncSession,
    *,
    actor: User,
    action: str,
    target_type: str,
    target_id: str,
    target_label: str,
    static_group_id: str | None = None,
    old: dict | None = None,
    new: dict | None = None,
    request: Request | None = None,
    admin_override: bool = False,
) -> None:
    """Add an audit row to the caller's session; the caller's commit finalizes it."""
    if old is not None and new is not None:
        old, new = compute_changed_fields(old, new)

    credential = None
    request_id = None
    impersonating_user_id = None
    if request is not None:
        credential = getattr(request.state, "auth_credential", None)
        request_id = getattr(request.state, "request_id", None)
        impersonating_user_id = request.headers.get("X-View-As")

    session.add(
        AuditLog(
            created_at=datetime.now(timezone.utc).isoformat(),
            actor_user_id=actor.id,
            actor_label=(actor.display_name or actor.discord_username)[:100],
            credential=credential or "system",
            # Client-controlled values: cap to column width before persisting
            impersonating_user_id=impersonating_user_id[:36] if impersonating_user_id else None,
            admin_override=admin_override,
            action=action,
            target_type=target_type,
            target_id=target_id,
            target_label=target_label[:200],
            static_group_id=static_group_id,
            old_values=_strip_secrets(old),
            new_values=_strip_secrets(new),
            request_id=request_id[:36] if request_id else None,
        )
    )
