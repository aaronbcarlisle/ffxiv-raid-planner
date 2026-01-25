/**
 * PlayerCard Gear - Compact icons or expanded GearTable
 *
 * Compact mode: Shows 11 gear slot icons in a row with completion visual
 * Expanded mode: Shows full GearTable for editing
 */

import { GearTable } from './GearTable';
import { ItemHoverCard } from '../ui/ItemHoverCard';
import { Tooltip, TooltipProvider } from '../primitives';
import type { GearSlotStatus, TomeWeaponStatus, SnapshotPlayer, GearSlot } from '../../types';
import { GEAR_SLOT_ICONS, GEAR_SLOT_NAMES, BIS_SOURCE_NAMES } from '../../types';
import type { MemberRole } from '../../utils/permissions';
import { requiresAugmentation } from '../../utils/calculations';

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
    <TooltipProvider>
      <div className="px-3 py-2 sm:py-2 border-t border-border-default">
        <div className="flex items-center justify-between gap-1.5 sm:gap-1">
          {SLOT_ORDER.map((slotKey) => {
            const slotData = gear.find((g) => g.slot === slotKey);
            if (!slotData) return null;

            // Check if this tome slot requires augmentation
            const needsAug = requiresAugmentation(slotData);
            // Complete: has item AND (raid/crafted/base_tome OR (tome AND (augmented OR aug not required)))
            const isComplete = slotData.hasItem && (
              slotData.bisSource === 'raid' ||
              slotData.bisSource === 'crafted' ||
              slotData.bisSource === 'base_tome' ||
              (slotData.bisSource === 'tome' && (!needsAug || slotData.isAugmented))
            );

            // Partial: tome BiS, has item, needs augmentation but not yet augmented
            const hasPartial = slotData.bisSource === 'tome' && slotData.hasItem && needsAug && !slotData.isAugmented;

            // Use actual item icon if available, otherwise placeholder
            const iconUrl = slotData.itemIcon || GEAR_SLOT_ICONS[slotKey];

            // Build tooltip content - use ItemHoverCard if we have item metadata, otherwise simple text
            const hasItemData = slotData.itemName && slotData.itemLevel;
            const slotName = GEAR_SLOT_NAMES[slotKey] || slotKey;

            const tooltipContent = hasItemData ? (
              <ItemHoverCard
                itemName={slotData.itemName!}
                itemLevel={slotData.itemLevel!}
                itemIcon={slotData.itemIcon}
                itemStats={slotData.itemStats}
                bisSource={slotData.bisSource}
                hasItem={slotData.hasItem}
                isAugmented={slotData.isAugmented}
              />
            ) : (
              // Fallback for items without metadata
              <div className="text-sm">
                <span className="font-medium">{slotName}</span>
                <span className="text-text-muted ml-1">
                  ({slotData.bisSource ? BIS_SOURCE_NAMES[slotData.bisSource] : '--'})
                </span>
                {!slotData.hasItem && (
                  <span className="text-text-muted ml-1">(missing)</span>
                )}
                {hasPartial && (
                  <span className="text-text-muted ml-1">(needs augment)</span>
                )}
              </div>
            );

            return (
              <Tooltip
                key={slotKey}
                content={tooltipContent}
                side="top"
                sideOffset={4}
              >
                <div className="relative cursor-pointer">
                  <img
                    src={iconUrl}
                    alt={slotData.slot}
                    className={`w-6 h-6 sm:w-5 sm:h-5 transition-all ${
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
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
