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


def create_default_gear() -> list[dict[str, Any]]:
    """Create default gear configuration for a new player."""
    return [
        {"slot": slot, "bisSource": "raid", "hasItem": False, "isAugmented": False}
        for slot in DEFAULT_GEAR_SLOTS
    ]


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
