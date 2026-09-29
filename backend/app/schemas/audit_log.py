"""Pydantic schemas for the admin Logs read API (Admin Dashboard V2; spec §3.4).

``AuditLogEntry`` mirrors every column of ``models.audit_log.AuditLog``
(``from_attributes=True`` reads it straight off the ORM row). ``old_values``/
``new_values`` are typed as optional free-form dicts, not a fixed shape: the
``audit()`` helper's diff (``compute_changed_fields``) can drop a key whose
value is ``None`` (e.g. ``unlinked_player_id``), and a stricter type would
reject rows the helper legitimately writes.
"""

from pydantic import BaseModel, ConfigDict


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase."""
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


class CamelModel(BaseModel):
    """Base model with camelCase aliases for JSON serialization."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class AuditLogEntry(CamelModel):
    """One row of ``audit_log`` (every ``AuditLog`` column)."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
        from_attributes=True,
    )

    id: int
    created_at: str
    actor_user_id: str | None
    actor_label: str
    credential: str
    impersonating_user_id: str | None
    admin_override: bool
    action: str
    target_type: str
    target_id: str
    target_label: str
    static_group_id: str | None
    old_values: dict | None
    new_values: dict | None
    request_id: str | None


class AuditLogListResponse(CamelModel):
    """Paginated list of audit log rows."""

    items: list[AuditLogEntry]
    total: int
    page: int
    page_size: int
