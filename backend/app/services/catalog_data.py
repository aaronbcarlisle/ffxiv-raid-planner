"""
Internal curated FFXIV farm data.

Provides seed data for collection_catalog_items so the catalog is useful
immediately without requiring a FFXIV Collect API sync.

Each record has the fields needed to populate CollectionCatalogItem.
The `source_key` is used as external_id with external_source="internal".
"""

from typing import TypedDict


class CuratedItem(TypedDict, total=False):
    source_key: str          # Unique internal key (used as external_id)
    name: str                # Reward display name
    category: str            # mount / orchestrion / minion / glam / title / other
    expansion: str           # arr / hw / sb / shb / ew / dt
    patch: str               # e.g. "7.0"
    source_type: str         # extreme / ultimate / criterion / other
    source_duty_name: str    # Human-readable duty name
    source_duty_key: str     # Internal duty key for linking
    source_text: str         # Full source description
    token_name: str | None   # Currency/totem name, or None if no exchange
    token_cost: int | None   # Cost in tokens, or None if no exchange
    notes: str | None        # Extra notes (e.g. "exchange not available yet")


# ── Dawntrail (7.x) Extreme Trials ────────────────────────────────────────────

DAWNTRAIL_EXTREME_MOUNTS: list[CuratedItem] = [
    {
        "source_key": "dt-ex1-mount",
        "name": "Futures Rewritten (not this) — Wings of Ruin",
        "category": "mount",
        "expansion": "dt",
        "patch": "7.0",
        "source_type": "extreme",
        "source_duty_name": "Worqor Lar Dor (Extreme)",
        "source_duty_key": "dt-worqor-lar-dor-ex",
        "source_text": "Worqor Lar Dor (Extreme) — Valigarmanda",
        "token_name": "Skyruin Totem",
        "token_cost": 99,
        "notes": None,
    },
    {
        "source_key": "dt-ex2-mount",
        "name": "Wings of Ruin",
        "category": "mount",
        "expansion": "dt",
        "patch": "7.0",
        "source_type": "extreme",
        "source_duty_name": "Worqor Lar Dor (Extreme)",
        "source_duty_key": "dt-worqor-lar-dor-ex",
        "source_text": "Worqor Lar Dor (Extreme) — Valigarmanda",
        "token_name": "Skyruin Totem",
        "token_cost": 99,
        "notes": None,
    },
    {
        "source_key": "dt-ex3-mount",
        "name": "Wings of Resolve",
        "category": "mount",
        "expansion": "dt",
        "patch": "7.0",
        "source_type": "extreme",
        "source_duty_name": "Everkeep (Extreme)",
        "source_duty_key": "dt-everkeep-ex",
        "source_text": "Everkeep (Extreme) — Zoraal Ja",
        "token_name": "Resilient Totem",
        "token_cost": 99,
        "notes": None,
    },
    {
        "source_key": "dt-ex4-mount",
        "name": "Wings of Eternity",
        "category": "mount",
        "expansion": "dt",
        "patch": "7.1",
        "source_type": "extreme",
        "source_duty_name": "The Minstrel's Ballad: Sphene's Burden",
        "source_duty_key": "dt-sphene-ex",
        "source_text": "The Minstrel's Ballad: Sphene's Burden",
        "token_name": "Totem of Eternal",
        "token_cost": 99,
        "notes": None,
    },
    {
        "source_key": "dt-ex5-mount",
        "name": "Wings of the Knighthood",
        "category": "mount",
        "expansion": "dt",
        "patch": "7.2",
        "source_type": "extreme",
        "source_duty_name": "Recollection (Extreme)",
        "source_duty_key": "dt-recollection-ex",
        "source_text": "Recollection (Extreme) — Arcadion (M5S Story)",
        "token_name": "Knight Totem",
        "token_cost": 99,
        "notes": None,
    },
    {
        "source_key": "dt-ex6-mount",
        "name": "Wings of Death",
        "category": "mount",
        "expansion": "dt",
        "patch": "7.2",
        "source_type": "extreme",
        "source_duty_name": "The Minstrel's Ballad: Necron's Embrace",
        "source_duty_key": "dt-necron-ex",
        "source_text": "The Minstrel's Ballad: Necron's Embrace",
        "token_name": "Grave Totem",
        "token_cost": 99,
        "notes": None,
    },
    {
        "source_key": "dt-ex7-mount",
        "name": "Felyne Support Team Cart Horn",
        "category": "mount",
        "expansion": "dt",
        "patch": "7.2",
        "source_type": "extreme",
        "source_duty_name": "The Windward Wilds (Extreme)",
        "source_duty_key": "dt-windward-wilds-ex",
        "source_text": "The Windward Wilds (Extreme) — Arkveld (MH Collab)",
        "token_name": "Guardian Arkveld Certificate",
        "token_cost": 99,
        "notes": None,
    },
    {
        "source_key": "dt-ex8-mount",
        "name": "Wings of Mist",
        "category": "mount",
        "expansion": "dt",
        "patch": "7.25",
        "source_type": "extreme",
        "source_duty_name": "Hell on Rails (Extreme)",
        "source_duty_key": "dt-hell-on-rails-ex",
        "source_text": "Hell on Rails (Extreme)",
        "token_name": None,
        "token_cost": None,
        "notes": "Totem exchange not yet available",
    },
    {
        "source_key": "dt-ex9-mount",
        "name": "Wings of Nihility",
        "category": "mount",
        "expansion": "dt",
        "patch": "7.25",
        "source_type": "extreme",
        "source_duty_name": "The Unmaking (Extreme)",
        "source_duty_key": "dt-unmaking-ex",
        "source_text": "The Unmaking (Extreme)",
        "token_name": None,
        "token_cost": None,
        "notes": "Totem exchange not yet available",
    },
]

DAWNTRAIL_ULTIMATE_WEAPONS: list[CuratedItem] = [
    {
        "source_key": "dt-ult1-weapons",
        "name": "Ultimate Edenmorn Weapons",
        "category": "weapon",
        "expansion": "dt",
        "patch": "7.0",
        "source_type": "ultimate",
        "source_duty_name": "Futures Rewritten (Ultimate)",
        "source_duty_key": "dt-futures-rewritten-ult",
        "source_text": "Futures Rewritten (Ultimate) — Oracle of Darkness",
        "token_name": "Oracle Totem",
        "token_cost": 7,
        "notes": None,
    },
    {
        "source_key": "dt-ult2-weapons",
        "name": "Palazzo Diamond Weapons",
        "category": "weapon",
        "expansion": "dt",
        "patch": "7.2",
        "source_type": "ultimate",
        "source_duty_name": "Dancing Mad (Ultimate)",
        "source_duty_key": "dt-dancing-mad-ult",
        "source_text": "Dancing Mad (Ultimate) — The Emperor",
        "token_name": "Mad Harlequin's Totem",
        "token_cost": 7,
        "notes": None,
    },
]

# ── Endwalker (6.x) reference mounts (for statics that still farm these) ──────

ENDWALKER_EXTREME_MOUNTS: list[CuratedItem] = [
    {
        "source_key": "ew-ex1-mount",
        "name": "Lynx of Eternal Darkness",
        "category": "mount",
        "expansion": "ew",
        "patch": "6.0",
        "source_type": "extreme",
        "source_duty_name": "The Dark Inside (Extreme)",
        "source_duty_key": "ew-zodiark-ex",
        "source_text": "The Dark Inside (Extreme) — Zodiark",
        "token_name": "Totem of the Fallen",
        "token_cost": 99,
        "notes": None,
    },
    {
        "source_key": "ew-ex2-mount",
        "name": "Lynx of Righteous Fire",
        "category": "mount",
        "expansion": "ew",
        "patch": "6.0",
        "source_type": "extreme",
        "source_duty_name": "The Mothercrystal (Extreme)",
        "source_duty_key": "ew-hydaelyn-ex",
        "source_text": "The Mothercrystal (Extreme) — Hydaelyn",
        "token_name": "Totem of the Radiant",
        "token_cost": 99,
        "notes": None,
    },
    {
        "source_key": "ew-ex3-mount",
        "name": "Lynx of Imperial Sorrow",
        "category": "mount",
        "expansion": "ew",
        "patch": "6.1",
        "source_type": "extreme",
        "source_duty_name": "Storm's Crown (Extreme)",
        "source_duty_key": "ew-barbariccia-ex",
        "source_text": "Storm's Crown (Extreme) — Barbariccia",
        "token_name": "Totem of the Storm",
        "token_cost": 99,
        "notes": None,
    },
    {
        "source_key": "ew-ex4-mount",
        "name": "Lynx of Divine Light",
        "category": "mount",
        "expansion": "ew",
        "patch": "6.2",
        "source_type": "extreme",
        "source_duty_name": "Mount Ordeals (Extreme)",
        "source_duty_key": "ew-rubicante-ex",
        "source_text": "Mount Ordeals (Extreme) — Rubicante",
        "token_name": "Totem of the Inferno",
        "token_cost": 99,
        "notes": None,
    },
    {
        "source_key": "ew-ex5-mount",
        "name": "Lynx of Eternal Ice",
        "category": "mount",
        "expansion": "ew",
        "patch": "6.3",
        "source_type": "extreme",
        "source_duty_name": "The Voidcast Dais (Extreme)",
        "source_duty_key": "ew-golbez-ex",
        "source_text": "The Voidcast Dais (Extreme) — Golbez",
        "token_name": "Totem of the Dark",
        "token_cost": 99,
        "notes": None,
    },
    {
        "source_key": "ew-ex6-mount",
        "name": "Lynx of Fallen Shadow",
        "category": "mount",
        "expansion": "ew",
        "patch": "6.4",
        "source_type": "extreme",
        "source_duty_name": "Anabaseios: The Tenth Circle (Savage) — Story Mode",
        "source_duty_key": "ew-anabaseios-ex",
        "source_text": "Abyssos: The Seventh Circle (Extreme) — Criterion",
        "token_name": "Totem of the Lost",
        "token_cost": 99,
        "notes": None,
    },
]

ENDWALKER_ULTIMATE_WEAPONS: list[CuratedItem] = [
    {
        "source_key": "ew-ult1-weapons",
        "name": "Manderville Weapons",
        "category": "weapon",
        "expansion": "ew",
        "patch": "6.0",
        "source_type": "ultimate",
        "source_duty_name": "Dragonsong's Reprise (Ultimate)",
        "source_duty_key": "ew-dsr-ult",
        "source_text": "Dragonsong's Reprise (Ultimate) — King Thordan",
        "token_name": "Totem of the Firmament",
        "token_cost": 7,
        "notes": None,
    },
    {
        "source_key": "ew-ult2-weapons",
        "name": "Anabaseios Weapons",
        "category": "weapon",
        "expansion": "ew",
        "patch": "6.2",
        "source_type": "ultimate",
        "source_duty_name": "The Omega Protocol (Ultimate)",
        "source_duty_key": "ew-top-ult",
        "source_text": "The Omega Protocol (Ultimate) — Omega",
        "token_name": "Omega Totem",
        "token_cost": 7,
        "notes": None,
    },
]

# ── Assembled catalog ──────────────────────────────────────────────────────────

ALL_CURATED_ITEMS: list[CuratedItem] = [
    *DAWNTRAIL_EXTREME_MOUNTS,
    *DAWNTRAIL_ULTIMATE_WEAPONS,
    *ENDWALKER_EXTREME_MOUNTS,
    *ENDWALKER_ULTIMATE_WEAPONS,
]

# Fix the incorrectly duplicated first DT EX entry — remove the bad one
ALL_CURATED_ITEMS = [
    item for item in ALL_CURATED_ITEMS
    if item["source_key"] != "dt-ex1-mount"
]
