"""add_default_priority_settings

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-02-01 13:15:00.000000

Data migration to add default prioritySettings to existing static groups.
This ensures all groups have the new priority system configuration with
sensible defaults that preserve existing behavior.

For groups with legacy lootPriority settings, the role order is preserved
in the new roleBasedConfig.
"""

from typing import Sequence, Union
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session


# revision identifiers, used by Alembic.
revision: str = "k1l2m3n4o5p6"
down_revision: Union[str, None] = "j0k1l2m3n4o5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Default priority settings matching frontend DEFAULT_PRIORITY_SETTINGS
DEFAULT_PRIORITY_SETTINGS = {
    "mode": "role-based",
    "roleBasedConfig": {
        "roleOrder": ["melee", "ranged", "caster", "tank", "healer"],
    },
    "advancedOptions": {
        "showPriorityScores": True,
        "preset": "balanced",
        "enableEnhancedFairness": False,
        "droughtBonusMultiplier": 10,
        "droughtBonusCapWeeks": 5,
        "balancePenaltyMultiplier": 15,
        "balancePenaltyCapDrops": 3,
        "useMultipliers": True,
        "rolePriorityMultiplier": 25,
        "gearNeededMultiplier": 10,
        "lootReceivedPenalty": 15,
        "useWeightedNeed": True,
        "useLootAdjustments": True,
    },
}


def upgrade() -> None:
    """Add default prioritySettings to existing static groups without them."""
    bind = op.get_bind()
    session = Session(bind=bind)

    try:
        # Get all static groups
        result = session.execute(
            sa.text("""
                SELECT id, settings
                FROM static_groups
            """)
        )
        groups = result.fetchall()

        if not groups:
            print("No static groups to migrate")
            return

        updated_count = 0
        skipped_count = 0

        print(f"Processing {len(groups)} static groups...")

        for group in groups:
            group_id, settings_json = group

            # Parse settings (handle both JSON strings and native objects)
            if isinstance(settings_json, dict):
                settings = settings_json
            elif settings_json:
                try:
                    settings = json.loads(settings_json)
                except json.JSONDecodeError as e:
                    print(f"  Warning: Invalid JSON for group {group_id}, skipping: {e}")
                    continue
            else:
                settings = {}

            # Skip if prioritySettings already exists
            if settings.get("prioritySettings"):
                skipped_count += 1
                continue

            # Create default priority settings
            priority_settings = dict(DEFAULT_PRIORITY_SETTINGS)
            priority_settings["roleBasedConfig"] = dict(DEFAULT_PRIORITY_SETTINGS["roleBasedConfig"])
            priority_settings["advancedOptions"] = dict(DEFAULT_PRIORITY_SETTINGS["advancedOptions"])

            # Preserve legacy lootPriority order if it exists
            if settings.get("lootPriority"):
                legacy_order = settings["lootPriority"]
                # Validate it's a valid role order
                valid_roles = {"melee", "ranged", "caster", "tank", "healer"}
                if isinstance(legacy_order, list) and all(r in valid_roles for r in legacy_order):
                    priority_settings["roleBasedConfig"]["roleOrder"] = legacy_order
                    print(f"  Group {group_id}: Preserved legacy lootPriority order: {legacy_order}")
                else:
                    print(f"  Warning: Group {group_id}: Skipped invalid lootPriority: {legacy_order}")

            # Preserve legacy showPriorityScores if explicitly set
            if "showPriorityScores" in settings:
                priority_settings["advancedOptions"]["showPriorityScores"] = settings["showPriorityScores"]

            # Preserve legacy enableEnhancedScoring if set
            if settings.get("enableEnhancedScoring"):
                priority_settings["advancedOptions"]["enableEnhancedFairness"] = True

            # Add prioritySettings to settings
            settings["prioritySettings"] = priority_settings

            # Update the group - use proper JSON type binding for Postgres JSON column
            session.execute(
                sa.text("""
                    UPDATE static_groups
                    SET settings = :settings
                    WHERE id = :group_id
                """).bindparams(
                    sa.bindparam("settings", type_=sa.JSON),
                ),
                {
                    "group_id": group_id,
                    "settings": settings,
                }
            )
            updated_count += 1

        session.commit()
        print(f"Migration complete! Updated {updated_count} groups, skipped {skipped_count} (already had prioritySettings)")

    except Exception as e:
        session.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        session.close()


def downgrade() -> None:
    """Remove prioritySettings from static groups."""
    bind = op.get_bind()
    session = Session(bind=bind)

    try:
        result = session.execute(
            sa.text("""
                SELECT id, settings
                FROM static_groups
            """)
        )
        groups = result.fetchall()

        if not groups:
            print("No static groups to process")
            return

        updated_count = 0
        print(f"Processing {len(groups)} static groups...")

        for group in groups:
            group_id, settings_json = group

            if isinstance(settings_json, dict):
                settings = settings_json
            elif settings_json:
                try:
                    settings = json.loads(settings_json)
                except json.JSONDecodeError:
                    continue
            else:
                continue

            # Remove prioritySettings if it exists
            if "prioritySettings" in settings:
                del settings["prioritySettings"]

                # Use proper JSON type binding for Postgres JSON column
                session.execute(
                    sa.text("""
                        UPDATE static_groups
                        SET settings = :settings
                        WHERE id = :group_id
                    """).bindparams(
                        sa.bindparam("settings", type_=sa.JSON),
                    ),
                    {
                        "group_id": group_id,
                        "settings": settings,
                    }
                )
                updated_count += 1

        session.commit()
        print(f"Downgrade complete! Removed prioritySettings from {updated_count} groups")

    except Exception as e:
        session.rollback()
        print(f"Downgrade failed: {e}")
        raise
    finally:
        session.close()
