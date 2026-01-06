"""
Loot Tracking Router

API endpoints for loot log and page tracking.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_session
from app.dependencies import get_current_user, get_current_user_optional
from app.models import (
    LootLogEntry,
    MaterialLogEntry,
    PageLedgerEntry,
    SnapshotPlayer,
    TierSnapshot,
    User,
)
from app.permissions import (
    check_view_permission,
    get_static_group,
    require_can_edit_roster,
)
from app.schemas import (
    LootLogEntryCreate,
    LootLogEntryResponse,
    LootLogEntryUpdate,
    MarkFloorClearedRequest,
    MaterialBalanceResponse,
    MaterialLogEntryCreate,
    MaterialLogEntryResponse,
    PageBalanceResponse,
    PageLedgerEntryCreate,
    PageLedgerEntryResponse,
)

router = APIRouter(prefix="/api/static-groups", tags=["loot-tracking"])


# Helper functions


async def get_tier_snapshot(
    db: AsyncSession,
    group_id: str,
    tier_id: str,
) -> TierSnapshot:
    """Get tier snapshot by tier_id (no permission check - caller must check)"""
    result = await db.execute(
        select(TierSnapshot).where(
            TierSnapshot.static_group_id == group_id,
            TierSnapshot.tier_id == tier_id,
        )
    )
    tier = result.scalar_one_or_none()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier snapshot not found")
    return tier


def calculate_week_number(tier: TierSnapshot) -> int:
    """Calculate current week number based on tier start date"""
    start_date_str = tier.week_start_date or tier.created_at
    start_date = datetime.fromisoformat(start_date_str)
    now = datetime.now(timezone.utc)
    weeks_since_start = (now - start_date).days // 7
    return weeks_since_start + 1


async def ensure_week_start_date(session: AsyncSession, tier: TierSnapshot) -> None:
    """Set week_start_date on first entry if not already set.

    This makes "Week 1" mean "our first week raiding" rather than
    "when the tier was created in the app."
    """
    if tier.week_start_date is None:
        tier.week_start_date = datetime.now(timezone.utc).isoformat()
        await session.flush()


# Loot Log Endpoints


@router.get(
    "/{group_id}/tiers/{tier_id}/loot-log",
    response_model=list[LootLogEntryResponse],
)
async def get_loot_log(
    group_id: str,
    tier_id: str,
    week: int | None = None,
    db: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get loot log entries for a tier (optionally filtered by week)"""
    # Check permissions (supports anonymous access for public groups)
    group = await get_static_group(db, group_id)
    await check_view_permission(db, group, current_user)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    query = (
        select(LootLogEntry)
        .where(LootLogEntry.tier_snapshot_id == tier.id)
        .options(
            joinedload(LootLogEntry.recipient_player),
            joinedload(LootLogEntry.created_by),
        )
        .order_by(LootLogEntry.week_number.desc(), LootLogEntry.created_at.desc())
    )

    if week is not None:
        query = query.where(LootLogEntry.week_number == week)

    result = await db.execute(query)
    entries = result.scalars().all()

    # Convert to response schema
    return [
        LootLogEntryResponse(
            id=entry.id,
            tier_snapshot_id=entry.tier_snapshot_id,
            week_number=entry.week_number,
            floor=entry.floor,
            item_slot=entry.item_slot,
            recipient_player_id=entry.recipient_player_id,
            recipient_player_name=entry.recipient_player.name,
            method=entry.method,
            notes=entry.notes,
            created_at=entry.created_at,
            created_by_user_id=entry.created_by_user_id,
            created_by_username=entry.created_by.discord_username,
        )
        for entry in entries
    ]


@router.post(
    "/{group_id}/tiers/{tier_id}/loot-log",
    response_model=LootLogEntryResponse,
    status_code=201,
)
async def create_loot_log_entry(
    group_id: str,
    tier_id: str,
    data: LootLogEntryCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new loot log entry (requires lead or owner role)"""
    # Check permissions
    await get_static_group(db, group_id)
    await require_can_edit_roster(db, current_user.id, group_id)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Set week_start_date on first entry if not already set
    await ensure_week_start_date(db, tier)

    # Verify recipient player exists in this tier
    result = await db.execute(
        select(SnapshotPlayer).where(
            SnapshotPlayer.id == data.recipient_player_id,
            SnapshotPlayer.tier_snapshot_id == tier.id,
        )
    )
    recipient_player = result.scalar_one_or_none()
    if not recipient_player:
        raise HTTPException(status_code=404, detail="Recipient player not found in this tier")

    # Create entry
    entry = LootLogEntry(
        tier_snapshot_id=tier.id,
        week_number=data.week_number,
        floor=data.floor,
        item_slot=data.item_slot,
        recipient_player_id=data.recipient_player_id,
        method=data.method.value,  # Use .value to get lowercase string for PostgreSQL enum
        notes=data.notes,
        created_at=datetime.now(timezone.utc).isoformat(),
        created_by_user_id=current_user.id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    # Load relationships for response
    await db.refresh(entry, ["recipient_player", "created_by"])

    return LootLogEntryResponse(
        id=entry.id,
        tier_snapshot_id=entry.tier_snapshot_id,
        week_number=entry.week_number,
        floor=entry.floor,
        item_slot=entry.item_slot,
        recipient_player_id=entry.recipient_player_id,
        recipient_player_name=entry.recipient_player.name,
        method=entry.method,
        notes=entry.notes,
        created_at=entry.created_at,
        created_by_user_id=entry.created_by_user_id,
        created_by_username=entry.created_by.discord_username,
    )


@router.put(
    "/{group_id}/tiers/{tier_id}/loot-log/{entry_id}",
    response_model=LootLogEntryResponse,
)
async def update_loot_log_entry(
    group_id: str,
    tier_id: str,
    entry_id: int,
    data: LootLogEntryUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a loot log entry (requires lead or owner role)"""
    # Check permissions
    await get_static_group(db, group_id)
    await require_can_edit_roster(db, current_user.id, group_id)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Get entry
    result = await db.execute(
        select(LootLogEntry).where(
            LootLogEntry.id == entry_id,
            LootLogEntry.tier_snapshot_id == tier.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Loot log entry not found")

    # If changing recipient, verify new recipient exists in this tier
    if data.recipient_player_id is not None and data.recipient_player_id != entry.recipient_player_id:
        result = await db.execute(
            select(SnapshotPlayer).where(
                SnapshotPlayer.id == data.recipient_player_id,
                SnapshotPlayer.tier_snapshot_id == tier.id,
            )
        )
        player = result.scalar_one_or_none()
        if not player:
            raise HTTPException(status_code=400, detail="Recipient player not found in this tier")

    # Update fields
    if data.week_number is not None:
        entry.week_number = data.week_number
    if data.floor is not None:
        entry.floor = data.floor
    if data.item_slot is not None:
        entry.item_slot = data.item_slot
    if data.recipient_player_id is not None:
        entry.recipient_player_id = data.recipient_player_id
    if data.method is not None:
        entry.method = data.method.value
    if data.notes is not None:
        entry.notes = data.notes

    await db.commit()
    await db.refresh(entry, ["recipient_player", "created_by"])

    return LootLogEntryResponse(
        id=entry.id,
        tier_snapshot_id=entry.tier_snapshot_id,
        week_number=entry.week_number,
        floor=entry.floor,
        item_slot=entry.item_slot,
        recipient_player_id=entry.recipient_player_id,
        recipient_player_name=entry.recipient_player.name,
        method=entry.method,
        notes=entry.notes,
        created_at=entry.created_at,
        created_by_user_id=entry.created_by_user_id,
        created_by_username=entry.created_by.discord_username,
    )


@router.delete("/{group_id}/tiers/{tier_id}/loot-log/{entry_id}", status_code=204)
async def delete_loot_log_entry(
    group_id: str,
    tier_id: str,
    entry_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a loot log entry (requires owner or lead role)"""
    # Check permissions - leads can also delete loot entries
    await get_static_group(db, group_id)
    await require_can_edit_roster(db, current_user.id, group_id)

    # Get tier (to verify it exists)
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Get entry
    result = await db.execute(
        select(LootLogEntry).where(
            LootLogEntry.id == entry_id,
            LootLogEntry.tier_snapshot_id == tier.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Loot log entry not found")

    await db.delete(entry)
    await db.commit()


# Page Tracking Endpoints


@router.get(
    "/{group_id}/tiers/{tier_id}/page-balances",
    response_model=list[PageBalanceResponse],
)
async def get_page_balances(
    group_id: str,
    tier_id: str,
    week: int | None = None,
    db: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get current page balances for all players in the tier.

    If week is provided, returns balances for that specific week only.
    Otherwise, returns cumulative balances across all weeks.
    """
    # Check permissions (supports anonymous access for public groups)
    group = await get_static_group(db, group_id)
    await check_view_permission(db, group, current_user)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Get all players in tier
    result = await db.execute(
        select(SnapshotPlayer)
        .where(SnapshotPlayer.tier_snapshot_id == tier.id, SnapshotPlayer.configured == True)
        .order_by(SnapshotPlayer.sort_order)
    )
    players = result.scalars().all()

    # Calculate balances for each player
    balances = []
    for player in players:
        # Build query with optional week filter
        query = (
            select(
                PageLedgerEntry.book_type,
                func.sum(PageLedgerEntry.quantity).label("balance"),
            )
            .where(PageLedgerEntry.player_id == player.id)
        )
        if week is not None:
            query = query.where(PageLedgerEntry.week_number == week)
        query = query.group_by(PageLedgerEntry.book_type)

        result = await db.execute(query)
        book_balances = {row.book_type: row.balance for row in result.all()}

        balances.append(
            PageBalanceResponse(
                player_id=player.id,
                player_name=player.name,
                book_I=book_balances.get("I", 0),
                book_II=book_balances.get("II", 0),
                book_III=book_balances.get("III", 0),
                book_IV=book_balances.get("IV", 0),
            )
        )

    return balances


@router.get(
    "/{group_id}/tiers/{tier_id}/page-ledger",
    response_model=list[PageLedgerEntryResponse],
)
async def get_page_ledger(
    group_id: str,
    tier_id: str,
    week: int | None = None,
    db: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get page ledger entries for a tier (optionally filtered by week)"""
    # Check permissions (supports anonymous access for public groups)
    group = await get_static_group(db, group_id)
    await check_view_permission(db, group, current_user)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    query = (
        select(PageLedgerEntry)
        .where(PageLedgerEntry.tier_snapshot_id == tier.id)
        .options(
            joinedload(PageLedgerEntry.player),
            joinedload(PageLedgerEntry.created_by),
        )
        .order_by(PageLedgerEntry.week_number.desc(), PageLedgerEntry.created_at.desc())
    )

    if week is not None:
        query = query.where(PageLedgerEntry.week_number == week)

    result = await db.execute(query)
    entries = result.scalars().all()

    # Convert to response schema
    return [
        PageLedgerEntryResponse(
            id=entry.id,
            tier_snapshot_id=entry.tier_snapshot_id,
            player_id=entry.player_id,
            player_name=entry.player.name,
            week_number=entry.week_number,
            floor=entry.floor,
            book_type=entry.book_type,
            transaction_type=entry.transaction_type,
            quantity=entry.quantity,
            notes=entry.notes,
            created_at=entry.created_at,
            created_by_user_id=entry.created_by_user_id,
            created_by_username=entry.created_by.discord_username,
        )
        for entry in entries
    ]


@router.post(
    "/{group_id}/tiers/{tier_id}/page-ledger",
    response_model=PageLedgerEntryResponse,
    status_code=201,
)
async def create_page_ledger_entry(
    group_id: str,
    tier_id: str,
    data: PageLedgerEntryCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new page ledger entry (requires lead or owner role)"""
    # Check permissions
    await get_static_group(db, group_id)
    await require_can_edit_roster(db, current_user.id, group_id)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Set week_start_date on first entry if not already set
    await ensure_week_start_date(db, tier)

    # Verify player exists in this tier
    result = await db.execute(
        select(SnapshotPlayer).where(
            SnapshotPlayer.id == data.player_id,
            SnapshotPlayer.tier_snapshot_id == tier.id,
        )
    )
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found in this tier")

    # Create entry
    entry = PageLedgerEntry(
        tier_snapshot_id=tier.id,
        player_id=data.player_id,
        week_number=data.week_number,
        floor=data.floor,
        book_type=data.book_type,
        transaction_type=data.transaction_type,
        quantity=data.quantity,
        notes=data.notes,
        created_at=datetime.now(timezone.utc).isoformat(),
        created_by_user_id=current_user.id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    # Load relationships for response
    await db.refresh(entry, ["player", "created_by"])

    return PageLedgerEntryResponse(
        id=entry.id,
        tier_snapshot_id=entry.tier_snapshot_id,
        player_id=entry.player_id,
        player_name=entry.player.name,
        week_number=entry.week_number,
        floor=entry.floor,
        book_type=entry.book_type,
        transaction_type=entry.transaction_type,
        quantity=entry.quantity,
        notes=entry.notes,
        created_at=entry.created_at,
        created_by_user_id=entry.created_by_user_id,
        created_by_username=entry.created_by.discord_username,
    )


@router.post("/{group_id}/tiers/{tier_id}/mark-floor-cleared", status_code=201)
async def mark_floor_cleared(
    group_id: str,
    tier_id: str,
    data: MarkFloorClearedRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Batch create 'earned' entries for players who cleared a floor (requires lead or owner)"""
    # Check permissions
    await get_static_group(db, group_id)
    await require_can_edit_roster(db, current_user.id, group_id)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Set week_start_date on first entry if not already set
    await ensure_week_start_date(db, tier)

    # Determine book type from floor
    # Floor 1 -> I, Floor 2 -> II, Floor 3 -> III, Floor 4 -> IV
    # Supports all tiers: M1S-M4S, M5S-M8S, M9S-M12S, P9S-P12S
    floor_to_book = {
        # Dawntrail Heavyweight (7.4)
        "M9S": "I",
        "M10S": "II",
        "M11S": "III",
        "M12S": "IV",
        # Dawntrail Cruiserweight (7.2)
        "M5S": "I",
        "M6S": "II",
        "M7S": "III",
        "M8S": "IV",
        # Dawntrail Light-heavyweight (7.0)
        "M1S": "I",
        "M2S": "II",
        "M3S": "III",
        "M4S": "IV",
        # Endwalker Anabaseios (6.4)
        "P9S": "I",
        "P10S": "II",
        "P11S": "III",
        "P12S": "IV",
    }
    book_type = floor_to_book.get(data.floor)
    if not book_type:
        raise HTTPException(status_code=400, detail=f"Invalid floor name: {data.floor}")

    # Verify all players exist
    result = await db.execute(
        select(SnapshotPlayer).where(
            SnapshotPlayer.id.in_(data.player_ids),
            SnapshotPlayer.tier_snapshot_id == tier.id,
        )
    )
    players = result.scalars().all()
    if len(players) != len(data.player_ids):
        raise HTTPException(status_code=404, detail="One or more players not found in this tier")

    # Create earned entries for each player
    entries = []
    for player_id in data.player_ids:
        entry = PageLedgerEntry(
            tier_snapshot_id=tier.id,
            player_id=player_id,
            week_number=data.week_number,
            floor=data.floor,
            book_type=book_type,
            transaction_type="earned",
            quantity=1,
            notes=data.notes,
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by_user_id=current_user.id,
        )
        db.add(entry)
        entries.append(entry)

    await db.commit()
    return {"message": f"Marked {len(entries)} players as having cleared {data.floor}"}


@router.get("/{group_id}/tiers/{tier_id}/current-week")
async def get_current_week(
    group_id: str,
    tier_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get the current week number and max logged week for this tier"""
    # Check permissions (supports anonymous access for public groups)
    group = await get_static_group(db, group_id)
    await check_view_permission(db, group, current_user)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)
    week_number = calculate_week_number(tier)

    # Get max week from loot log entries
    loot_max_result = await db.execute(
        select(func.max(LootLogEntry.week_number)).where(
            LootLogEntry.tier_snapshot_id == tier.id
        )
    )
    loot_max_week = loot_max_result.scalar() or 0

    # Get max week from page ledger entries
    ledger_max_result = await db.execute(
        select(func.max(PageLedgerEntry.week_number)).where(
            PageLedgerEntry.tier_snapshot_id == tier.id
        )
    )
    ledger_max_week = ledger_max_result.scalar() or 0

    # Return current week and max logged week (for week selector range)
    max_logged_week = max(loot_max_week, ledger_max_week)
    return {
        "currentWeek": week_number,
        "maxLoggedWeek": max_logged_week,
        "maxWeek": max(week_number, max_logged_week),
    }


@router.get("/{group_id}/tiers/{tier_id}/players/{player_id}/page-ledger")
async def get_player_page_ledger(
    group_id: str,
    tier_id: str,
    player_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get all page ledger entries for a specific player"""
    # Check permissions (supports anonymous access for public groups)
    group = await get_static_group(db, group_id)
    await check_view_permission(db, group, current_user)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Verify player exists in this tier
    result = await db.execute(
        select(SnapshotPlayer).where(
            SnapshotPlayer.id == player_id,
            SnapshotPlayer.tier_snapshot_id == tier.id,
        )
    )
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found in this tier")

    # Get all ledger entries for this player
    query = (
        select(PageLedgerEntry)
        .where(
            PageLedgerEntry.tier_snapshot_id == tier.id,
            PageLedgerEntry.player_id == player_id,
        )
        .options(
            joinedload(PageLedgerEntry.player),
            joinedload(PageLedgerEntry.created_by),
        )
        .order_by(PageLedgerEntry.created_at.desc())
    )

    result = await db.execute(query)
    entries = result.scalars().all()

    # Convert to response schema
    return [
        PageLedgerEntryResponse(
            id=entry.id,
            tier_snapshot_id=entry.tier_snapshot_id,
            player_id=entry.player_id,
            player_name=entry.player.name,
            week_number=entry.week_number,
            floor=entry.floor,
            book_type=entry.book_type,
            transaction_type=entry.transaction_type,
            quantity=entry.quantity,
            notes=entry.notes,
            created_at=entry.created_at,
            created_by_user_id=entry.created_by_user_id,
            created_by_username=entry.created_by.discord_username,
        )
        for entry in entries
    ]


@router.delete(
    "/{group_id}/tiers/{tier_id}/players/{player_id}/page-ledger",
    status_code=204,
)
async def clear_player_page_ledger(
    group_id: str,
    tier_id: str,
    player_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Clear all page ledger entries for a specific player"""
    # Check edit permissions (Owner/Lead only)
    group = await get_static_group(db, group_id)
    await check_edit_permission(db, group, current_user)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Verify player exists in this tier
    result = await db.execute(
        select(SnapshotPlayer).where(
            SnapshotPlayer.id == player_id,
            SnapshotPlayer.tier_snapshot_id == tier.id,
        )
    )
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found in this tier")

    # Delete all ledger entries for this player
    await db.execute(
        PageLedgerEntry.__table__.delete().where(
            PageLedgerEntry.tier_snapshot_id == tier.id,
            PageLedgerEntry.player_id == player_id,
        )
    )
    await db.commit()


@router.get("/{group_id}/tiers/{tier_id}/weeks-with-entries")
async def get_weeks_with_entries(
    group_id: str,
    tier_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get all weeks that have loot log OR page ledger entries"""
    # Check permissions (supports anonymous access for public groups)
    group = await get_static_group(db, group_id)
    await check_view_permission(db, group, current_user)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Get distinct weeks from loot log
    loot_weeks_result = await db.execute(
        select(LootLogEntry.week_number)
        .where(LootLogEntry.tier_snapshot_id == tier.id)
        .distinct()
    )
    loot_weeks = {row[0] for row in loot_weeks_result.all()}

    # Get distinct weeks from page ledger
    ledger_weeks_result = await db.execute(
        select(PageLedgerEntry.week_number)
        .where(PageLedgerEntry.tier_snapshot_id == tier.id)
        .distinct()
    )
    ledger_weeks = {row[0] for row in ledger_weeks_result.all()}

    # Get distinct weeks from material log
    material_weeks_result = await db.execute(
        select(MaterialLogEntry.week_number)
        .where(MaterialLogEntry.tier_snapshot_id == tier.id)
        .distinct()
    )
    material_weeks = {row[0] for row in material_weeks_result.all()}

    # Merge and return sorted list
    all_weeks = sorted(loot_weeks | ledger_weeks | material_weeks)
    return {"weeks": all_weeks}


@router.get("/{group_id}/tiers/{tier_id}/weeks-data-types")
async def get_weeks_data_types(
    group_id: str,
    tier_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get weeks with their entry types (loot/books/mats)"""
    # Check permissions (supports anonymous access for public groups)
    group = await get_static_group(db, group_id)
    await check_view_permission(db, group, current_user)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Get distinct weeks from each source
    loot_weeks_result = await db.execute(
        select(LootLogEntry.week_number)
        .where(LootLogEntry.tier_snapshot_id == tier.id)
        .distinct()
    )
    loot_weeks = {row[0] for row in loot_weeks_result.all()}

    ledger_weeks_result = await db.execute(
        select(PageLedgerEntry.week_number)
        .where(PageLedgerEntry.tier_snapshot_id == tier.id)
        .distinct()
    )
    ledger_weeks = {row[0] for row in ledger_weeks_result.all()}

    material_weeks_result = await db.execute(
        select(MaterialLogEntry.week_number)
        .where(MaterialLogEntry.tier_snapshot_id == tier.id)
        .distinct()
    )
    material_weeks = {row[0] for row in material_weeks_result.all()}

    # Build week info list
    all_weeks = sorted(loot_weeks | ledger_weeks | material_weeks)
    weeks_data = []
    for week in all_weeks:
        types = []
        if week in loot_weeks:
            types.append("loot")
        if week in ledger_weeks:
            types.append("books")
        if week in material_weeks:
            types.append("mats")
        weeks_data.append({
            "week": week,
            "types": types,
        })

    return {"weeks": weeks_data}


# Material Log Endpoints


@router.get(
    "/{group_id}/tiers/{tier_id}/material-log",
    response_model=list[MaterialLogEntryResponse],
)
async def get_material_log(
    group_id: str,
    tier_id: str,
    week: int | None = None,
    db: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get material log entries for a tier (optionally filtered by week)"""
    # Check permissions (supports anonymous access for public groups)
    group = await get_static_group(db, group_id)
    await check_view_permission(db, group, current_user)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    query = (
        select(MaterialLogEntry)
        .where(MaterialLogEntry.tier_snapshot_id == tier.id)
        .options(
            joinedload(MaterialLogEntry.recipient_player),
            joinedload(MaterialLogEntry.created_by),
        )
        .order_by(MaterialLogEntry.week_number.desc(), MaterialLogEntry.created_at.desc())
    )

    if week is not None:
        query = query.where(MaterialLogEntry.week_number == week)

    result = await db.execute(query)
    entries = result.scalars().all()

    # Convert to response schema
    return [
        MaterialLogEntryResponse(
            id=entry.id,
            tier_snapshot_id=entry.tier_snapshot_id,
            week_number=entry.week_number,
            floor=entry.floor,
            material_type=entry.material_type,
            recipient_player_id=entry.recipient_player_id,
            recipient_player_name=entry.recipient_player.name,
            notes=entry.notes,
            created_at=entry.created_at,
            created_by_user_id=entry.created_by_user_id,
            created_by_username=entry.created_by.discord_username,
        )
        for entry in entries
    ]


@router.post(
    "/{group_id}/tiers/{tier_id}/material-log",
    response_model=MaterialLogEntryResponse,
    status_code=201,
)
async def create_material_log_entry(
    group_id: str,
    tier_id: str,
    data: MaterialLogEntryCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new material log entry (requires lead or owner role)"""
    # Check permissions
    await get_static_group(db, group_id)
    await require_can_edit_roster(db, current_user.id, group_id)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Set week_start_date on first entry if not already set
    await ensure_week_start_date(db, tier)

    # Verify recipient player exists in this tier
    result = await db.execute(
        select(SnapshotPlayer).where(
            SnapshotPlayer.id == data.recipient_player_id,
            SnapshotPlayer.tier_snapshot_id == tier.id,
        )
    )
    recipient_player = result.scalar_one_or_none()
    if not recipient_player:
        raise HTTPException(status_code=404, detail="Recipient player not found in this tier")

    # Create entry
    entry = MaterialLogEntry(
        tier_snapshot_id=tier.id,
        week_number=data.week_number,
        floor=data.floor,
        material_type=data.material_type.value,  # Use .value to get lowercase string
        recipient_player_id=data.recipient_player_id,
        notes=data.notes,
        created_at=datetime.now(timezone.utc).isoformat(),
        created_by_user_id=current_user.id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    # Load relationships for response
    await db.refresh(entry, ["recipient_player", "created_by"])

    return MaterialLogEntryResponse(
        id=entry.id,
        tier_snapshot_id=entry.tier_snapshot_id,
        week_number=entry.week_number,
        floor=entry.floor,
        material_type=entry.material_type,
        recipient_player_id=entry.recipient_player_id,
        recipient_player_name=entry.recipient_player.name,
        notes=entry.notes,
        created_at=entry.created_at,
        created_by_user_id=entry.created_by_user_id,
        created_by_username=entry.created_by.discord_username,
    )


@router.delete("/{group_id}/tiers/{tier_id}/material-log/{entry_id}", status_code=204)
async def delete_material_log_entry(
    group_id: str,
    tier_id: str,
    entry_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a material log entry (requires owner or lead role)"""
    # Check permissions
    await get_static_group(db, group_id)
    await require_can_edit_roster(db, current_user.id, group_id)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Get entry
    result = await db.execute(
        select(MaterialLogEntry).where(
            MaterialLogEntry.id == entry_id,
            MaterialLogEntry.tier_snapshot_id == tier.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Material log entry not found")

    await db.delete(entry)
    await db.commit()


@router.get(
    "/{group_id}/tiers/{tier_id}/material-balances",
    response_model=list[MaterialBalanceResponse],
)
async def get_material_balances(
    group_id: str,
    tier_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get cumulative material counts for all players in the tier"""
    # Check permissions (supports anonymous access for public groups)
    group = await get_static_group(db, group_id)
    await check_view_permission(db, group, current_user)

    # Get tier
    tier = await get_tier_snapshot(db, group_id, tier_id)

    # Get all players in tier
    players_result = await db.execute(
        select(SnapshotPlayer)
        .where(SnapshotPlayer.tier_snapshot_id == tier.id, SnapshotPlayer.configured == True)
        .order_by(SnapshotPlayer.sort_order)
    )
    players = players_result.scalars().all()

    # Single aggregated query for all material counts (avoids N+1)
    material_counts_result = await db.execute(
        select(
            MaterialLogEntry.recipient_player_id,
            MaterialLogEntry.material_type,
            func.count(MaterialLogEntry.id).label("count"),
        )
        .where(MaterialLogEntry.tier_snapshot_id == tier.id)
        .group_by(MaterialLogEntry.recipient_player_id, MaterialLogEntry.material_type)
    )

    # Build lookup map: player_id -> {material_type: count}
    material_map: dict[str, dict[str, int]] = {}
    for row in material_counts_result.all():
        if row.recipient_player_id not in material_map:
            material_map[row.recipient_player_id] = {"twine": 0, "glaze": 0, "solvent": 0}
        material_map[row.recipient_player_id][row.material_type] = row.count

    # Build response using the lookup map
    balances = []
    for player in players:
        counts = material_map.get(player.id, {"twine": 0, "glaze": 0, "solvent": 0})
        balances.append(
            MaterialBalanceResponse(
                player_id=player.id,
                player_name=player.name,
                twine=counts.get("twine", 0),
                glaze=counts.get("glaze", 0),
                solvent=counts.get("solvent", 0),
            )
        )

    return balances
