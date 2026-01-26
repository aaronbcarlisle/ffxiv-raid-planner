"""sync_material_entries_with_gear

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-01-25 18:45:00.000000

Data migration to retroactively sync existing material log entries with player
gear status. For each material entry, marks the appropriate gear slot as
augmented based on material type.

Material types and their effects:
- universal_tomestone: marks tomeWeapon.hasItem = true
- solvent: marks tomeWeapon.isAugmented = true OR weapon slot isAugmented = true
- twine: marks armor slot (head, body, hands, legs, feet) isAugmented = true
- glaze: marks accessory slot (earring, necklace, bracelet, ring1, ring2) isAugmented = true

For entries without slot_augmented set, uses heuristics to find the first
eligible slot that needs augmentation.
"""

from typing import Sequence, Union
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session


# revision identifiers, used by Alembic.
revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, None] = "f6g7h8i9j0k1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Material type to slot mapping
MATERIAL_SLOTS = {
    "twine": ["head", "body", "hands", "legs", "feet"],
    "glaze": ["earring", "necklace", "bracelet", "ring1", "ring2"],
    "solvent": ["weapon"],
}


def upgrade() -> None:
    """Sync existing material entries with player gear status."""
    bind = op.get_bind()
    session = Session(bind=bind)

    try:
        # Get all material log entries
        result = session.execute(
            sa.text("""
                SELECT id, material_type, recipient_player_id, slot_augmented
                FROM material_log_entries
                ORDER BY created_at ASC
            """)
        )
        entries = result.fetchall()

        if not entries:
            print("No material entries to sync")
            return

        print(f"Processing {len(entries)} material entries...")

        # Track updates per player to avoid redundant queries
        player_updates = {}  # player_id -> (gear, tome_weapon)

        for entry in entries:
            entry_id, material_type, player_id, slot_augmented = entry

            # Skip if no recipient
            if not player_id:
                continue

            # Get player data (cached if already fetched)
            if player_id not in player_updates:
                player_result = session.execute(
                    sa.text("""
                        SELECT gear, tome_weapon
                        FROM snapshot_players
                        WHERE id = :player_id
                    """),
                    {"player_id": player_id}
                )
                player_row = player_result.fetchone()
                if not player_row:
                    continue

                gear_json, tome_weapon_json = player_row
                gear = json.loads(gear_json) if gear_json else []
                tome_weapon = json.loads(tome_weapon_json) if tome_weapon_json else {}
                player_updates[player_id] = (gear, tome_weapon)

            gear, tome_weapon = player_updates[player_id]

            # Process based on material type
            if material_type == "universal_tomestone":
                # Mark tome weapon as obtained
                if tome_weapon.get("pursuing") and not tome_weapon.get("hasItem"):
                    tome_weapon["hasItem"] = True
                    print(f"  Entry {entry_id}: Marked tome weapon as obtained for player {player_id}")

            elif material_type == "solvent":
                # Can augment tome weapon OR weapon gear slot
                if slot_augmented == "tome_weapon":
                    # Explicitly recorded as tome weapon augmentation
                    if tome_weapon.get("pursuing") and tome_weapon.get("hasItem") and not tome_weapon.get("isAugmented"):
                        tome_weapon["isAugmented"] = True
                        print(f"  Entry {entry_id}: Augmented tome weapon for player {player_id}")
                elif slot_augmented:
                    # Explicitly recorded as gear slot augmentation
                    _augment_gear_slot(gear, slot_augmented, entry_id, player_id)
                else:
                    # No slot recorded - use heuristics
                    # Try tome weapon first if pursuing and has item
                    if tome_weapon.get("pursuing") and tome_weapon.get("hasItem") and not tome_weapon.get("isAugmented"):
                        tome_weapon["isAugmented"] = True
                        print(f"  Entry {entry_id}: Augmented tome weapon for player {player_id} (heuristic)")
                    else:
                        # Fall back to weapon gear slot
                        _augment_first_eligible_slot(gear, MATERIAL_SLOTS["solvent"], entry_id, player_id)

            elif material_type in ("twine", "glaze"):
                valid_slots = MATERIAL_SLOTS.get(material_type, [])
                if slot_augmented and slot_augmented in valid_slots:
                    # Explicitly recorded slot
                    _augment_gear_slot(gear, slot_augmented, entry_id, player_id)
                else:
                    # Use heuristics - find first eligible slot
                    _augment_first_eligible_slot(gear, valid_slots, entry_id, player_id)

            # Update cached data
            player_updates[player_id] = (gear, tome_weapon)

        # Write all updates back to database
        print(f"Writing updates for {len(player_updates)} players...")
        for player_id, (gear, tome_weapon) in player_updates.items():
            session.execute(
                sa.text("""
                    UPDATE snapshot_players
                    SET gear = :gear, tome_weapon = :tome_weapon
                    WHERE id = :player_id
                """),
                {
                    "player_id": player_id,
                    "gear": json.dumps(gear),
                    "tome_weapon": json.dumps(tome_weapon),
                }
            )

        session.commit()
        print("Migration complete!")

    except Exception as e:
        session.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        session.close()


def _augment_gear_slot(gear: list, slot_name: str, entry_id: int, player_id: str) -> bool:
    """Mark a specific gear slot as augmented."""
    for slot in gear:
        if slot.get("slot") == slot_name:
            if slot.get("bisSource") == "tome" and slot.get("hasItem") and not slot.get("isAugmented"):
                slot["isAugmented"] = True
                print(f"  Entry {entry_id}: Augmented {slot_name} for player {player_id}")
                return True
            elif slot.get("isAugmented"):
                # Already augmented, skip silently
                return False
    return False


def _augment_first_eligible_slot(gear: list, valid_slots: list, entry_id: int, player_id: str) -> bool:
    """Find and augment the first eligible slot matching criteria."""
    for slot in gear:
        slot_name = slot.get("slot")
        if slot_name in valid_slots:
            if slot.get("bisSource") == "tome" and slot.get("hasItem") and not slot.get("isAugmented"):
                slot["isAugmented"] = True
                print(f"  Entry {entry_id}: Augmented {slot_name} for player {player_id} (heuristic)")
                return True
    return False


def downgrade() -> None:
    """
    Downgrade is intentionally a no-op.

    We cannot reliably reverse this migration because:
    1. We don't know which augmentations were manual vs from this migration
    2. The gear state before migration is not recorded

    If needed, restore from backup.
    """
    print("Downgrade is a no-op - gear augmentation state cannot be reliably reversed")
