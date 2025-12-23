"""API router for static operations"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..models import Player, Static
from ..schemas import (
    GearSlotStatus,
    PlayerResponse,
    StaticCreate,
    StaticResponse,
    StaticSettings,
    StaticUpdate,
    StaticWithPlayers,
    TomeWeaponStatus,
)
from ..services import generate_share_code

router = APIRouter(prefix="/api/statics", tags=["statics"])

# Default gear slots for a new player
DEFAULT_GEAR_SLOTS = [
    "weapon",
    "head",
    "body",
    "hands",
    "legs",
    "feet",
    "earring",
    "necklace",
    "bracelet",
    "ring1",
    "ring2",
]


def create_default_gear() -> list[dict]:
    """Create default gear configuration for a new player"""
    return [
        {
            "slot": slot,
            "bisSource": "raid",
            "hasItem": False,
            "isAugmented": False,
        }
        for slot in DEFAULT_GEAR_SLOTS
    ]


def create_default_tome_weapon() -> dict:
    """Create default tome weapon status"""
    return {"pursuing": False, "hasItem": False, "isAugmented": False}


def create_template_players(static_id: str) -> list[Player]:
    """Create 8 template player slots for a new static"""
    now = datetime.now(timezone.utc).isoformat()
    players = []

    for i in range(8):
        players.append(
            Player(
                id=str(uuid.uuid4()),
                static_id=static_id,
                name="",
                job="",
                role="",
                configured=False,
                sort_order=i,
                is_substitute=False,
                gear=create_default_gear(),
                tome_weapon=create_default_tome_weapon(),
                created_at=now,
                updated_at=now,
            )
        )

    return players


def model_to_player_response(player: Player) -> PlayerResponse:
    """Convert Player model to PlayerResponse schema"""
    # Convert gear JSON to GearSlotStatus objects
    gear = [
        GearSlotStatus(
            slot=g["slot"],
            bis_source=g.get("bisSource", "raid"),
            has_item=g.get("hasItem", False),
            is_augmented=g.get("isAugmented", False),
            item_name=g.get("itemName"),
            item_level=g.get("itemLevel"),
        )
        for g in (player.gear or [])
    ]

    # Convert tome_weapon JSON to TomeWeaponStatus
    tw = player.tome_weapon or {}
    tome_weapon = TomeWeaponStatus(
        pursuing=tw.get("pursuing", False),
        has_item=tw.get("hasItem", False),
        is_augmented=tw.get("isAugmented", False),
    )

    return PlayerResponse(
        id=player.id,
        static_id=player.static_id,
        name=player.name,
        job=player.job,
        role=player.role,
        position=player.position,
        tank_role=player.tank_role,
        configured=player.configured,
        sort_order=player.sort_order,
        is_substitute=player.is_substitute,
        notes=player.notes,
        lodestone_id=player.lodestone_id,
        bis_link=player.bis_link,
        fflogs_id=player.fflogs_id,
        last_sync=player.last_sync,
        gear=gear,
        tome_weapon=tome_weapon,
        created_at=player.created_at,
        updated_at=player.updated_at,
    )


def model_to_static_response(static: Static) -> StaticWithPlayers:
    """Convert Static model to StaticWithPlayers schema"""
    # Convert settings JSON to StaticSettings
    s = static.settings or {}
    settings = StaticSettings(
        display_order=s.get("displayOrder", ["tank", "healer", "melee", "ranged", "caster"]),
        loot_priority=s.get("lootPriority", ["melee", "ranged", "caster", "tank", "healer"]),
        timezone=s.get("timezone", "America/New_York"),
        auto_sync=s.get("autoSync", False),
        sync_frequency=s.get("syncFrequency", "weekly"),
    )

    # Convert players
    players = [model_to_player_response(p) for p in static.players]

    return StaticWithPlayers(
        id=static.id,
        name=static.name,
        tier=static.tier,
        share_code=static.share_code,
        settings=settings,
        players=players,
        created_at=static.created_at,
        updated_at=static.updated_at,
    )


@router.post("", response_model=StaticWithPlayers, status_code=status.HTTP_201_CREATED)
async def create_static(
    data: StaticCreate,
    session: AsyncSession = Depends(get_session),
) -> StaticWithPlayers:
    """Create a new static with 8 template player slots"""
    now = datetime.now(timezone.utc).isoformat()
    static_id = str(uuid.uuid4())
    share_code = await generate_share_code(session)

    # Use provided settings or defaults
    settings = data.settings or StaticSettings()

    static = Static(
        id=static_id,
        name=data.name,
        tier=data.tier,
        share_code=share_code,
        settings={
            "displayOrder": settings.display_order,
            "lootPriority": settings.loot_priority,
            "timezone": settings.timezone,
            "autoSync": settings.auto_sync,
            "syncFrequency": settings.sync_frequency,
        },
        created_at=now,
        updated_at=now,
    )

    # Create template players
    template_players = create_template_players(static_id)

    session.add(static)
    for player in template_players:
        session.add(player)

    await session.flush()

    # Reload with relationships
    result = await session.execute(
        select(Static).where(Static.id == static_id).options(selectinload(Static.players))
    )
    static = result.scalar_one()

    return model_to_static_response(static)


@router.get("/{share_code}", response_model=StaticWithPlayers)
async def get_static_by_share_code(
    share_code: str,
    session: AsyncSession = Depends(get_session),
) -> StaticWithPlayers:
    """Get a static by its share code"""
    result = await session.execute(
        select(Static)
        .where(Static.share_code == share_code.upper())
        .options(selectinload(Static.players))
    )
    static = result.scalar_one_or_none()

    if static is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Static with share code '{share_code}' not found",
        )

    return model_to_static_response(static)


@router.put("/{static_id}", response_model=StaticResponse)
async def update_static(
    static_id: str,
    data: StaticUpdate,
    session: AsyncSession = Depends(get_session),
) -> StaticResponse:
    """Update a static"""
    result = await session.execute(select(Static).where(Static.id == static_id))
    static = result.scalar_one_or_none()

    if static is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Static with id '{static_id}' not found",
        )

    # Update fields
    if data.name is not None:
        static.name = data.name
    if data.tier is not None:
        static.tier = data.tier
    if data.settings is not None:
        static.settings = {
            "displayOrder": data.settings.display_order,
            "lootPriority": data.settings.loot_priority,
            "timezone": data.settings.timezone,
            "autoSync": data.settings.auto_sync,
            "syncFrequency": data.settings.sync_frequency,
        }

    static.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()

    # Convert settings for response
    s = static.settings or {}
    settings = StaticSettings(
        display_order=s.get("displayOrder", ["tank", "healer", "melee", "ranged", "caster"]),
        loot_priority=s.get("lootPriority", ["melee", "ranged", "caster", "tank", "healer"]),
        timezone=s.get("timezone", "America/New_York"),
        auto_sync=s.get("autoSync", False),
        sync_frequency=s.get("syncFrequency", "weekly"),
    )

    return StaticResponse(
        id=static.id,
        name=static.name,
        tier=static.tier,
        share_code=static.share_code,
        settings=settings,
        created_at=static.created_at,
        updated_at=static.updated_at,
    )


@router.delete("/{static_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_static(
    static_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a static and all its players"""
    result = await session.execute(select(Static).where(Static.id == static_id))
    static = result.scalar_one_or_none()

    if static is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Static with id '{static_id}' not found",
        )

    await session.delete(static)
