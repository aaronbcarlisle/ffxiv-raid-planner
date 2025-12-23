"""API router for player operations"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Player, Static
from ..schemas import (
    GearSlotStatus,
    PlayerCreate,
    PlayerResponse,
    PlayerUpdate,
    TomeWeaponStatus,
)

router = APIRouter(prefix="/api/statics/{static_id}/players", tags=["players"])


def model_to_response(player: Player) -> PlayerResponse:
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


async def verify_static_exists(static_id: str, session: AsyncSession) -> None:
    """Verify that a static exists, raise 404 if not"""
    result = await session.execute(select(Static).where(Static.id == static_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Static with id '{static_id}' not found",
        )


@router.post("", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
async def create_player(
    static_id: str,
    data: PlayerCreate,
    session: AsyncSession = Depends(get_session),
) -> PlayerResponse:
    """Add a new player to a static"""
    await verify_static_exists(static_id, session)

    now = datetime.now(timezone.utc).isoformat()

    # Convert gear to JSON format
    gear_json = [
        {
            "slot": g.slot,
            "bisSource": g.bis_source,
            "hasItem": g.has_item,
            "isAugmented": g.is_augmented,
            "itemName": g.item_name,
            "itemLevel": g.item_level,
        }
        for g in data.gear
    ] if data.gear else []

    # Convert tome_weapon to JSON format
    tome_weapon_json = {
        "pursuing": data.tome_weapon.pursuing if data.tome_weapon else False,
        "hasItem": data.tome_weapon.has_item if data.tome_weapon else False,
        "isAugmented": data.tome_weapon.is_augmented if data.tome_weapon else False,
    }

    player = Player(
        id=str(uuid.uuid4()),
        static_id=static_id,
        name=data.name,
        job=data.job,
        role=data.role,
        position=data.position,
        tank_role=data.tank_role,
        configured=data.configured,
        sort_order=data.sort_order,
        is_substitute=data.is_substitute,
        notes=data.notes,
        lodestone_id=data.lodestone_id,
        bis_link=data.bis_link,
        fflogs_id=data.fflogs_id,
        gear=gear_json,
        tome_weapon=tome_weapon_json,
        created_at=now,
        updated_at=now,
    )

    session.add(player)
    await session.flush()

    return model_to_response(player)


@router.put("/{player_id}", response_model=PlayerResponse)
async def update_player(
    static_id: str,
    player_id: str,
    data: PlayerUpdate,
    session: AsyncSession = Depends(get_session),
) -> PlayerResponse:
    """Update a player"""
    await verify_static_exists(static_id, session)

    result = await session.execute(
        select(Player).where(Player.id == player_id, Player.static_id == static_id)
    )
    player = result.scalar_one_or_none()

    if player is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Player with id '{player_id}' not found in static '{static_id}'",
        )

    # Update scalar fields
    if data.name is not None:
        player.name = data.name
    if data.job is not None:
        player.job = data.job
    if data.role is not None:
        player.role = data.role
    if data.position is not None:
        player.position = data.position
    if data.tank_role is not None:
        player.tank_role = data.tank_role
    if data.configured is not None:
        player.configured = data.configured
    if data.sort_order is not None:
        player.sort_order = data.sort_order
    if data.is_substitute is not None:
        player.is_substitute = data.is_substitute
    if data.notes is not None:
        player.notes = data.notes
    if data.lodestone_id is not None:
        player.lodestone_id = data.lodestone_id
    if data.bis_link is not None:
        player.bis_link = data.bis_link
    if data.fflogs_id is not None:
        player.fflogs_id = data.fflogs_id

    # Update gear (JSON)
    if data.gear is not None:
        player.gear = [
            {
                "slot": g.slot,
                "bisSource": g.bis_source,
                "hasItem": g.has_item,
                "isAugmented": g.is_augmented,
                "itemName": g.item_name,
                "itemLevel": g.item_level,
            }
            for g in data.gear
        ]

    # Update tome_weapon (JSON)
    if data.tome_weapon is not None:
        player.tome_weapon = {
            "pursuing": data.tome_weapon.pursuing,
            "hasItem": data.tome_weapon.has_item,
            "isAugmented": data.tome_weapon.is_augmented,
        }

    player.updated_at = datetime.now(timezone.utc).isoformat()

    await session.flush()

    return model_to_response(player)


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_player(
    static_id: str,
    player_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Remove a player from a static"""
    await verify_static_exists(static_id, session)

    result = await session.execute(
        select(Player).where(Player.id == player_id, Player.static_id == static_id)
    )
    player = result.scalar_one_or_none()

    if player is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Player with id '{player_id}' not found in static '{static_id}'",
        )

    await session.delete(player)
