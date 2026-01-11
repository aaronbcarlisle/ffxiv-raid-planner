/**
 * PlayerCard Gear - Compact icons or expanded GearTable
 *
 * Compact mode: Shows 11 gear slot icons in a row with completion visual
 * Expanded mode: Shows full GearTable for editing
 */

import { GearTable } from './GearTable';
import type { GearSlotStatus, TomeWeaponStatus, SnapshotPlayer, GearSlot } from '../../types';
import { GEAR_SLOT_ICONS } from '../../types';
import type { MemberRole } from '../../utils/permissions';

// Slot order for compact display
const SLOT_ORDER: (keyof typeof GEAR_SLOT_ICONS)[] = [
  'weapon', 'head', 'body', 'hands', 'legs', 'feet',
  'earring', 'necklace', 'bracelet', 'ring1', 'ring2'
];

interface PlayerCardGearProps {
  gear: GearSlotStatus[];
  tomeWeapon: TomeWeaponStatus;
  isExpanded: boolean;
  player: SnapshotPlayer;
  userRole?: MemberRole | null;
  currentUserId?: string;
  isAdminAccess?: boolean; // Admin mode active (from Admin Dashboard)
  onGearChange: (slot: string, updates: Partial<GearSlotStatus>) => void;
  onTomeWeaponChange: (updates: Partial<TomeWeaponStatus>) => void;
  /** Slots that have loot entries (for "Go to Loot Entry" feature) */
  slotsWithLootEntries?: Set<GearSlot>;
  /** Navigate to loot entry for a slot */
  onNavigateToLootEntry?: (slot: GearSlot) => void;
}

export function PlayerCardGear({
  gear,
  tomeWeapon,
  isExpanded,
  player,
  userRole,
  currentUserId,
  isAdminAccess,
  onGearChange,
  onTomeWeaponChange,
  slotsWithLootEntries,
  onNavigateToLootEntry,
}: PlayerCardGearProps) {
  if (isExpanded) {
    return (
      <div className="border-t border-border-default p-2">
        <GearTable
          gear={gear}
          tomeWeapon={tomeWeapon}
          onGearChange={onGearChange}
          onTomeWeaponChange={onTomeWeaponChange}
          player={player}
          userRole={userRole}
          currentUserId={currentUserId}
          isAdminAccess={isAdminAccess}
          slotsWithLootEntries={slotsWithLootEntries}
          onNavigateToLootEntry={onNavigateToLootEntry}
        />
      </div>
    );
  }

  // Compact mode - gear icons row
  return (
    <div className="px-3 py-2 border-t border-border-default">
      <div className="flex items-center justify-between gap-1">
        {SLOT_ORDER.map((slotKey) => {
          const slotData = gear.find((g) => g.slot === slotKey);
          if (!slotData) return null;

          const isComplete = slotData.bisSource === 'raid'
            ? slotData.hasItem
            : slotData.hasItem && slotData.isAugmented;

          const hasPartial = slotData.bisSource === 'tome' && slotData.hasItem && !slotData.isAugmented;

          // Use actual item icon if available, otherwise placeholder
          const iconUrl = slotData.itemIcon || GEAR_SLOT_ICONS[slotKey];

          return (
            <div
              key={slotKey}
              className="relative"
              title={`${slotData.slot}: ${isComplete ? 'Complete' : hasPartial ? 'Needs augment' : 'Missing'}`}
            >
              <img
                src={iconUrl}
                alt={slotData.slot}
                className={`w-5 h-5 transition-all ${
                  slotData.itemIcon
                    ? // Actual item icon styling
                      isComplete
                        ? 'opacity-100'
                        : hasPartial
                          ? 'opacity-75'
                          : 'opacity-40 grayscale'
                    : // Placeholder icon styling (invert to white)
                      isComplete
                        ? 'brightness-0 invert opacity-90'
                        : hasPartial
                          ? 'brightness-0 invert opacity-50'
                          : 'opacity-30'
                }`}
              />
              {/* Completion indicator dot */}
              {isComplete && (
                <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-status-success" />
              )}
              {hasPartial && (
                <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-status-warning" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
