"""API router for user notifications."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..dependencies import get_current_user
from ..models import Notification, User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: str
    notification_type: str
    title: str
    body: str | None
    href: str | None
    is_read: bool
    created_at: str

    model_config = {"from_attributes": True}


class UnreadCountResponse(BaseModel):
    unread_count: int


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    limit: int = 20,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[NotificationResponse]:
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(desc(Notification.created_at))
        .limit(max(1, min(limit, 50)))
    )
    return [NotificationResponse.model_validate(n) for n in result.scalars().all()]


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> UnreadCountResponse:
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
    )
    count = len(result.scalars().all())
    return UnreadCountResponse(unread_count=count)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> NotificationResponse:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.is_read = True
    await db.flush()
    await db.commit()
    return NotificationResponse.model_validate(notification)


@router.post("/read-all", response_model=UnreadCountResponse)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> UnreadCountResponse:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
    return UnreadCountResponse(unread_count=0)


# ─── Helper used by other routers ────────────────────────────────────────────

async def create_notification(
    db: AsyncSession,
    *,
    user_id: str,
    notification_type: str,
    title: str,
    body: str | None = None,
    href: str | None = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    db.add(
        Notification(
            id=str(uuid.uuid4()),
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            href=href,
            is_read=False,
            created_at=now,
        )
    )
