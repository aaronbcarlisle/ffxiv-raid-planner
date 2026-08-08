"""Shared constants and factory functions for player/gear creation."""

from typing import Any

# Valid job abbreviations (for BiS import and validation)
VALID_JOBS = frozenset({
    # Tanks
    "pld", "war", "drk", "gnb",
    # Healers
    "whm", "sch", "ast", "sge",
    # Melee DPS
    "mnk", "drg", "nin", "sam", "rpr", "vpr",
    # Ranged Physical DPS
    "brd", "mch", "dnc",
    # Ranged Magical DPS
    "blm", "smn", "rdm", "pct",
})

# Default gear slots for a new player
DEFAULT_GEAR_SLOTS = [
    "weapon",
    "offhand",
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

# Optimal party composition for 8-player raids
OPTIMAL_PARTY_COMP = [
    {"template_role": "tank", "position": "T1", "tank_role": "MT"},
    {"template_role": "tank", "position": "T2", "tank_role": "OT"},
    {"template_role": "pure-healer", "position": "H1", "tank_role": None},
    {"template_role": "barrier-healer", "position": "H2", "tank_role": None},
    {"template_role": "melee", "position": "M1", "tank_role": None},
    {"template_role": "melee", "position": "M2", "tank_role": None},
    {"template_role": "physical-ranged", "position": "R1", "tank_role": None},
    {"template_role": "magical-ranged", "position": "R2", "tank_role": None},
]


def _default_bis_source(slot: str) -> str | None:
    """Default BiS source per slot.

    The off-hand defaults to None (unset): only PLD uses it at endgame, and a
    blanket "raid" default would give every other job a phantom raid shield
    target. Display/math relevance-gate on data, so None keeps it invisible.
    """
    return None if slot == "offhand" else "raid"


def create_default_gear() -> list[dict[str, Any]]:
    """Create default gear configuration for a new player."""
    return [
        {"slot": slot, "bisSource": _default_bis_source(slot), "hasItem": False, "isAugmented": False}
        for slot in DEFAULT_GEAR_SLOTS
    ]


def ensure_offhand_slot(gear: list) -> list:
    """Lazily add the offhand entry to stored 11-slot gear (bisSource None).

    Stored player gear predating the offhand slot never gains entries from
    sync (sync iterates the STORED list) — normalize on every read-for-merge
    and response path so all clients see 12 slots. Idempotent; inserts after
    the weapon when possible, else appends. Non-list/malformed input is
    returned unchanged.
    """
    if not isinstance(gear, list) or not gear:
        return gear
    if any(isinstance(g, dict) and g.get("slot") == "offhand" for g in gear):
        return gear
    entry = {"slot": "offhand", "bisSource": None, "hasItem": False, "isAugmented": False}
    weapon_idx = next(
        (i for i, g in enumerate(gear) if isinstance(g, dict) and g.get("slot") == "weapon"),
        None,
    )
    result = list(gear)
    if weapon_idx is None:
        result.append(entry)
    else:
        result.insert(weapon_idx + 1, entry)
    return result


def create_default_gear_ring2_tome() -> list[dict[str, Any]]:
    """Create default gear with ring2 as tome source (ring restriction)."""
    gear = create_default_gear()
    for slot in gear:
        if slot["slot"] == "ring2":
            slot["bisSource"] = "tome"
    return gear


def create_default_tome_weapon() -> dict[str, Any]:
    """Create default tome weapon status."""
    return {"pursuing": False, "hasItem": False, "isAugmented": False}
