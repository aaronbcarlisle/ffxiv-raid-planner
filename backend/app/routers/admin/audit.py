"""Admin Logs read API (Admin Dashboard V2; spec §3.4, R-AD-H).

``GET /api/admin/logs`` is the one genuinely unbounded admin table: it reads
``audit_log`` rows written by ``services.audit.audit()`` (AD1a/AD1b emits),
filtered and server-paginated. No V2 UI consumes it yet (the Logs tab is
AD3) — this task is the read contract only.
"""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_session
from ...models import AuditLog, User
from ...schemas.audit_log import AuditLogEntry, AuditLogListResponse
from .deps import require_admin

router = APIRouter(tags=["admin-audit"])


def _parse_boundary(value: str, param_name: str) -> str:
    """Parse an ISO-8601 query boundary to the UTC isoformat string stored in
    ``AuditLog.created_at`` (R-AD-H). Accepts ``Z``, an offset, or a bare
    date; a naive result is read as UTC (never local time). Unparseable or
    out of range after the UTC conversion → 422 (``astimezone`` raises
    ``OverflowError`` near datetime.min/max)."""
    try:
        parsed = datetime.fromisoformat(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat()
    except (ValueError, OverflowError):
        raise HTTPException(
            status_code=422, detail=f"Invalid {param_name}: not a valid ISO-8601 datetime"
        ) from None


@router.get("/api/admin/logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
    actor: str | None = Query(None),
    action: str | None = Query(None),
    target_type: str | None = Query(None),
    target_id: str | None = Query(None),
    static_id: str | None = Query(None),
    credential: Literal["cookie", "api_key", "system"] | None = Query(None),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> AuditLogListResponse:
    """List audit log rows, newest first, for the admin Logs surface."""
    query = select(AuditLog)

    # An empty string is "unset" for the free-string filters (form submits).
    if actor:
        query = query.where(AuditLog.actor_user_id == actor)
    if action:
        query = query.where(AuditLog.action.startswith(action.lower(), autoescape=True))
    if target_type:
        query = query.where(AuditLog.target_type == target_type)
    if target_id:
        query = query.where(AuditLog.target_id == target_id)
    if static_id:
        query = query.where(AuditLog.static_group_id == static_id)
    if credential is not None:
        query = query.where(AuditLog.credential == credential)
    if from_:
        query = query.where(AuditLog.created_at >= _parse_boundary(from_, "from"))
    if to:
        query = query.where(AuditLog.created_at < _parse_boundary(to, "to"))

    count_query = select(func.count()).select_from(query.subquery())
    result = await session.execute(count_query)
    total = result.scalar() or 0

    query = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await session.execute(query)
    rows = result.scalars().all()

    return AuditLogListResponse(
        items=[AuditLogEntry.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )
