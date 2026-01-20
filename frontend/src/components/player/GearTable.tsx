/**
 * GearTable - Gear tracking table with BiS source and completion tracking
 *
 * Improvements in Phase 6.4:
 * - Larger slot icons (24x24)
 * - Better row spacing
 * - Clearer "Raid"/"Tome" labels
 * - Radix Tooltip for hover cards
 */

import { useState } from 'react';
import { GearStatusCircle } from '../ui/GearStatusCircle';
import { ItemHoverCard } from '../ui/ItemHoverCard';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { Tooltip, TooltipProvider } from '../primitives';
import { BiSSourceSelector, WeaponBiSSelector } from './BiSSourceSelector';
import type { GearSlotStatus, GearSource, TomeWeaponStatus, GearSlot, SnapshotPlayer } from '../../types';
import { GEAR_SLOTS, GEAR_SLOT_NAMES, GEAR_SLOT_ICONS, GEAR_SOURCE_NAMES, GEAR_SOURCE_COLORS, BIS_SOURCE_FULL_NAMES } from '../../types';
import { requiresAugmentation, toGearState, fromGearState, type GearState } from '../../utils/calculations';
import { canEditGear, type MemberRole } from '../../utils/permissions';
import { toast } from '../../stores/toastStore';
import { getCorrectBisSource } from '../../utils/bisSourceDetection';
import { RefreshCw, FileSearch } from 'lucide-react';

// Reusable slot icon component with optional item icon and hover card
function SlotIcon({
  slot,
  status,
  size = 24,
  showHover = false,
  hasLootEntry = false,
  onNavigateToLootEntry,
}: {
  slot: GearSlot;
  status: GearSlotStatus;
  size?: number;
  showHover?: boolean;
  hasLootEntry?: boolean;
  onNavigateToLootEntry?: (slot: GearSlot) => void;
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    // Only show context menu if there's a loot entry to navigate to
    if (hasLootEntry && onNavigateToLootEntry) {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Alt+Click navigates to loot entry
    if (e.altKey && hasLootEntry && onNavigateToLootEntry) {
      e.preventDefault();
      e.stopPropagation();
      onNavigateToLootEntry(slot);
    }
  };

  const contextMenuItems: ContextMenuItem[] = hasLootEntry && onNavigateToLootEntry
    ? [{
        label: 'Jump to Loot Entry',
        icon: <FileSearch className="w-4 h-4" />,
        onClick: () => onNavigateToLootEntry(slot),
      }]
    : [];
  const hasItem = status.hasItem;
  const bisSource = status.bisSource;
  const isAugmented = status.isAugmented;
  const hasItemData = status.itemName && status.itemLevel;

  // Use actual item icon if available, otherwise use placeholder
  const iconUrl = status.itemIcon || GEAR_SLOT_ICONS[slot];
  const isActualItemIcon = !!status.itemIcon;

  // Determine the icon style based on completion state
  let iconClass = '';

  if (isActualItemIcon) {
    // Actual item icons - just adjust opacity based on state
    if (!hasItem) {
      iconClass = 'opacity-50 grayscale';
    } else if (bisSource === 'tome' && !isAugmented) {
      iconClass = 'opacity-75';
    } else {
      iconClass = '';
    }
  } else {
    // Placeholder icons - use brightness inversion
    iconClass = 'opacity-50'; // Default: empty/grey

    if (hasItem) {
      if (bisSource === 'raid' || bisSource === 'base_tome') {
        iconClass = 'brightness-0 invert opacity-90';
      } else if (bisSource === 'tome') {
        iconClass = isAugmented
          ? 'brightness-0 invert opacity-90'
          : 'brightness-0 invert opacity-50';
      } else if (bisSource === 'crafted') {
        iconClass = 'brightness-0 invert opacity-90';
      }
    }
  }

  const iconElement = (
    <img
      src={iconUrl}
      alt={status.itemName || GEAR_SLOT_NAMES[slot]}
      width={size}
      height={size}
      className={`${iconClass} ${isActualItemIcon ? 'rounded' : ''}`}
    />
  );

  // Wrap with Tooltip if we have item data and hover is enabled
  if (showHover && hasItemData) {
    return (
      <>
        <Tooltip
          delayDuration={200}
          content={
            hasLootEntry ? (
              <div>
                <ItemHoverCard
                  itemName={status.itemName!}
                  itemLevel={status.itemLevel!}
                  itemIcon={status.itemIcon}
                  itemStats={status.itemStats}
                  bisSource={bisSource}
                  hasItem={hasItem}
                  isAugmented={isAugmented}
                />
                <div className="mt-2 pt-2 border-t border-border-subtle text-xs text-text-muted">
                  <kbd className="px-1 py-0.5 bg-surface-base rounded border border-border-default">Alt</kbd>+Click to jump to loot entry
                </div>
              </div>
            ) : (
              <ItemHoverCard
                itemName={status.itemName!}
                itemLevel={status.itemLevel!}
                itemIcon={status.itemIcon}
                itemStats={status.itemStats}
                bisSource={bisSource}
                hasItem={hasItem}
                isAugmented={isAugmented}
              />
            )
          }
          side="right"
          sideOffset={8}
        >
          <div
            className={`cursor-pointer ${hasLootEntry && onNavigateToLootEntry ? 'hover:ring-1 hover:ring-accent/50 rounded' : ''}`}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
          >
            {iconElement}
          </div>
        </Tooltip>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenuItems}
            onClose={() => setContextMenu(null)}
          />
        )}
      </>
    );
  }

  const slotElement = (
    <div
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={hasLootEntry && onNavigateToLootEntry ? 'cursor-pointer hover:ring-1 hover:ring-accent/50 rounded' : ''}
    >
      {iconElement}
    </div>
  );

  return (
    <>
      {hasLootEntry ? (
        <Tooltip
          content={
            <span className="text-xs">
              <kbd className="px-1 py-0.5 bg-surface-base rounded border border-border-default">Alt</kbd>+Click to jump to loot entry
            </span>
          }
        >
          {slotElement}
        </Tooltip>
      ) : (
        slotElement
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

// Special weapon row with optional tome weapon sub-row
interface WeaponSlotRowProps {
  status: GearSlotStatus;
  tomeWeapon: TomeWeaponStatus;
  onTomeWeaponChange: (updates: Partial<TomeWeaponStatus>) => void;
  onGearStateChange: (newState: GearState) => void;
  disabled?: boolean;
  disabledTooltip?: string;
  hasLootEntry?: boolean;
  onNavigateToLootEntry?: (slot: GearSlot) => void;
}

function WeaponSlotRow({
  status,
  tomeWeapon,
  onTomeWeaponChange,
  onGearStateChange,
  disabled = false,
  disabledTooltip,
  hasLootEntry = false,
  onNavigateToLootEntry,
}: WeaponSlotRowProps) {
  // Handle tome weapon state change (3-state cycle: missing → have → augmented)
  const handleTomeWeaponStateChange = (newState: GearState) => {
    const { hasItem, isAugmented } = fromGearState(newState);
    onTomeWeaponChange({ hasItem, isAugmented });
  };

  return (
    <>
      {/* Main weapon row */}
      <tr className="border-t border-border-default/50">
        <td className="py-1 text-text-secondary">
          <div className="flex items-center gap-3">
            <SlotIcon
              slot="weapon"
              status={status}
              size={24}
              showHover
              hasLootEntry={hasLootEntry}
              onNavigateToLootEntry={onNavigateToLootEntry}
            />
            <span className="font-medium">{GEAR_SLOT_NAMES.weapon}</span>
          </div>
        </td>
        {/* CurrentSource column hidden for now */}
        <td className="py-1 hidden text-center">
          {status.currentSource && status.currentSource !== 'unknown' ? (
            <span className={`text-xs ${GEAR_SOURCE_COLORS[status.currentSource]}`}>
              {GEAR_SOURCE_NAMES[status.currentSource]}
            </span>
          ) : (
            <span className="text-xs text-text-muted">—</span>
          )}
        </td>
        <td className="py-1 text-center">
          <WeaponBiSSelector
            tomeWeapon={tomeWeapon}
            onTomeWeaponChange={onTomeWeaponChange}
            disabled={disabled}
            disabledReason={disabledTooltip}
          />
        </td>
        <td className="py-1">
          <div className="flex justify-center">
            <GearStatusCircle
              state={toGearState(status.hasItem, status.isAugmented)}
              bisSource="raid"
              requiresAugmentation={false}
              disabled={disabled}
              onChange={onGearStateChange}
            />
          </div>
        </td>
      </tr>

      {/* Tome weapon sub-row - only shown when +Tome is enabled */}
      {tomeWeapon.pursuing && (
        <tr className="border-t border-border-default/30 bg-surface-elevated/30">
          <td
            className={`py-1 pl-6 text-sm ${
              tomeWeapon.hasItem
                ? tomeWeapon.isAugmented
                  ? 'text-text-primary'
                  : 'text-text-secondary'
                : 'text-text-muted'
            }`}
          >
            └ Tome Weapon
          </td>
          {/* CurrentSource column hidden for now */}
          <td className="py-1 hidden">
            {/* Empty cell for Current column alignment */}
          </td>
          <td className="py-1 text-center">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs text-gear-tome font-bold ${disabled ? 'opacity-50' : ''}`}>T</span>
          </td>
          <td className="py-1">
            <div className="flex justify-center">
              <GearStatusCircle
                state={toGearState(tomeWeapon.hasItem, tomeWeapon.isAugmented)}
                bisSource="tome"
                requiresAugmentation={true}
                disabled={disabled}
                onChange={handleTomeWeaponStateChange}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

interface GearTableProps {
  gear: GearSlotStatus[];
  tomeWeapon: TomeWeaponStatus;
  onGearChange: (slot: string, updates: Partial<GearSlotStatus>) => void;
  onTomeWeaponChange: (updates: Partial<TomeWeaponStatus>) => void;
  compact?: boolean;
  player: SnapshotPlayer;
  userRole?: MemberRole | null;
  currentUserId?: string;
  isAdmin?: boolean;
  isAdminAccess?: boolean; // Admin mode active (from Admin Dashboard)
  /** Slots that have loot entries (for "Go to Loot Entry" feature) */
  slotsWithLootEntries?: Set<GearSlot>;
  /** Navigate to loot entry for a slot */
  onNavigateToLootEntry?: (slot: GearSlot) => void;
}

export function GearTable({
  gear,
  tomeWeapon,
  onGearChange,
  onTomeWeaponChange,
  compact = false,
  player,
  userRole,
  currentUserId,
  isAdminAccess,
  slotsWithLootEntries,
  onNavigateToLootEntry,
}: GearTableProps) {
  // Check gear edit permission - use isAdminAccess to respect View As context
  const gearPermission = canEditGear(userRole, player, currentUserId, isAdminAccess);
  const getSlotStatus = (slot: string): GearSlotStatus => {
    return gear.find((g) => g.slot === slot) ?? {
      slot: slot as GearSlotStatus['slot'],
      bisSource: 'raid',
      hasItem: false,
      isAugmented: false,
    };
  };

  const handleSourceChange = (slot: string, newSource: GearSource | null) => {
    if (!gearPermission.allowed) {
      toast.warning(gearPermission.reason || 'You do not have permission to edit gear');
      return;
    }

    const currentStatus = getSlotStatus(slot);
    const isSourceChanging = newSource !== currentStatus.bisSource;

    // When clearing or changing source, reset progress and item metadata
    // This ensures consistent state (e.g., switching to Tome starts unchecked, not half-checked)
    if (newSource === null || isSourceChanging) {
      onGearChange(slot, {
        bisSource: newSource,
        hasItem: false,
        isAugmented: false,
        currentSource: undefined,
        itemName: undefined,
        itemLevel: undefined,
        itemIcon: undefined,
        itemStats: undefined,
      });
    } else {
      onGearChange(slot, { bisSource: newSource });
    }
  };

  // Handler for fixing BiS source without resetting progress or item metadata
  // Used by the inline warning buttons to correct miscategorized items
  const handleBisSourceFix = (slot: string, newSource: GearSource) => {
    if (!gearPermission.allowed) {
      toast.warning(gearPermission.reason || 'You do not have permission to edit gear');
      return;
    }
    // Only update bisSource - preserve hasItem, isAugmented, and item metadata
    onGearChange(slot, { bisSource: newSource });
  };

  const handleGearStateChange = (slot: string, newState: GearState) => {
    if (!gearPermission.allowed) {
      toast.warning(gearPermission.reason || 'You do not have permission to edit gear');
      return;
    }
    const { hasItem, isAugmented } = fromGearState(newState);
    onGearChange(slot, { hasItem, isAugmented });
  };

  const handleTomeWeaponUpdate = (updates: Partial<TomeWeaponStatus>) => {
    if (!gearPermission.allowed) {
      toast.warning(gearPermission.reason || 'You do not have permission to edit gear');
      return;
    }
    onTomeWeaponChange(updates);
  };

  if (compact) {
    return (
      <div className="grid grid-cols-11 gap-1 text-xs">
        {GEAR_SLOTS.map((slot) => {
          const status = getSlotStatus(slot);
          // Slot is complete if: has item AND (raid/base_tome/crafted OR (tome AND (augmented OR aug not required)))
          const needsAug = requiresAugmentation(status);
          const isComplete = status.bisSource !== null && status.hasItem && (
            status.bisSource === 'raid' ||
            status.bisSource === 'base_tome' ||
            status.bisSource === 'crafted' ||
            (status.bisSource === 'tome' && (!needsAug || status.isAugmented))
          );

          // Use actual item icon if available, otherwise placeholder
          const iconUrl = status.itemIcon || GEAR_SLOT_ICONS[slot];
          const isActualItemIcon = !!status.itemIcon;

          // Determine icon class based on completion state and icon type
          let iconClass = '';
          if (isActualItemIcon) {
            // Actual item icons - adjust opacity based on state
            if (!status.hasItem) {
              iconClass = 'opacity-50 grayscale';
            } else if (status.bisSource === 'tome' && needsAug && !status.isAugmented) {
              iconClass = 'opacity-75';
            }
          } else {
            // Placeholder icons - use brightness inversion
            iconClass = 'opacity-40'; // Default: empty/grey
            if (status.hasItem) {
              if (status.bisSource === 'raid' || status.bisSource === 'base_tome' || status.bisSource === 'crafted') {
                iconClass = 'brightness-0 invert opacity-90';
              } else if (status.bisSource === 'tome') {
                // Tome: check if augmentation is needed
                iconClass = (!needsAug || status.isAugmented)
                  ? 'brightness-0 invert opacity-90'
                  : 'brightness-0 invert opacity-50';
              }
            }
          }

          // Build title with item name if available
          const itemInfo = status.itemName ? `${status.itemName} (iLvl ${status.itemLevel})` : GEAR_SLOT_NAMES[slot];
          const sourceInfo = status.bisSource ? BIS_SOURCE_FULL_NAMES[status.bisSource] : 'Unset';
          const augInfo = status.bisSource === 'tome' && needsAug ? (status.isAugmented ? ' Aug' : ' (needs Aug)') : '';
          const stateInfo = `${status.hasItem ? ' ✓' : ''}${augInfo}`;

          return (
            <Tooltip key={slot} content={`${itemInfo}: ${sourceInfo}${stateInfo}`}>
              <div
                className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
                  !status.bisSource
                    ? 'bg-surface-interactive opacity-50'
                    : isComplete
                      ? 'bg-status-success/30'
                      : status.hasItem
                        ? 'bg-status-warning/30'
                        : 'bg-surface-interactive'
                }`}
              >
                <img
                  src={iconUrl}
                  alt={status.itemName || GEAR_SLOT_NAMES[slot]}
                  width={18}
                  height={18}
                  className={`${iconClass} ${isActualItemIcon ? 'rounded' : ''}`}
                />
              </div>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-muted text-xs">
            <th className="text-left py-1 font-medium">Slot</th>
            {/* CurrentSource column hidden for now - change to "hidden md:table-cell" to re-enable */}
            <th className="text-center py-1 font-medium hidden">Current</th>
            <th className="text-center py-1 font-medium w-16">BiS</th>
            <th className="text-center py-1 font-medium w-16">
              <Tooltip content="Click to cycle: missing → have → augmented (for tome)">
                <span className="cursor-help">Status</span>
              </Tooltip>
            </th>
          </tr>
        </thead>
        <tbody>
          {GEAR_SLOTS.map((slot) => {
            const status = getSlotStatus(slot);
            const isWeapon = slot === 'weapon';

            // For weapon slot, use special handling
            if (isWeapon) {
              return (
                <WeaponSlotRow
                  key={slot}
                  status={status}
                  tomeWeapon={tomeWeapon}
                  onTomeWeaponChange={handleTomeWeaponUpdate}
                  onGearStateChange={(newState) => handleGearStateChange(slot, newState)}
                  disabled={!gearPermission.allowed}
                  disabledTooltip={gearPermission.reason}
                  hasLootEntry={slotsWithLootEntries?.has('weapon')}
                  onNavigateToLootEntry={onNavigateToLootEntry}
                />
              );
            }

            // Check if this tome slot requires augmentation
            const needsAug = requiresAugmentation(status);

            return (
              <tr key={slot} className="border-t border-border-default/50">
                <td className="py-1 text-text-secondary">
                  <div className="flex items-center gap-3">
                    <SlotIcon
                      slot={slot}
                      status={status}
                      size={24}
                      showHover
                      hasLootEntry={slotsWithLootEntries?.has(slot) && status.bisSource === 'raid'}
                      onNavigateToLootEntry={onNavigateToLootEntry}
                    />
                    <span className="font-medium">{GEAR_SLOT_NAMES[slot]}</span>
                  </div>
                </td>
                {/* CurrentSource column hidden for now */}
                <td className="py-1 hidden text-center">
                  {status.currentSource && status.currentSource !== 'unknown' ? (
                    <span className={`text-xs ${GEAR_SOURCE_COLORS[status.currentSource]}`}>
                      {GEAR_SOURCE_NAMES[status.currentSource]}
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </td>
                <td className="py-1 text-center">
                  {(() => {
                    const correctSource = getCorrectBisSource(status);
                    return (
                      <div className="relative flex justify-center items-center">
                        {/* Fix button positioned to left, doesn't affect BiS selector position */}
                        {correctSource && gearPermission.allowed && (
                          <div className="absolute right-full mr-0.5">
                            <Tooltip content={`Fix: Set to ${BIS_SOURCE_FULL_NAMES[correctSource]}`}>
                              <button
                                aria-label={`Fix BiS source to ${BIS_SOURCE_FULL_NAMES[correctSource]}`}
                                className="w-6 h-6 flex items-center justify-center rounded border bg-status-warning/20 text-status-warning border-status-warning/40 hover:bg-status-warning/30 transition-colors"
                                onClick={() => handleBisSourceFix(slot, correctSource)}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>
                          </div>
                        )}
                        <BiSSourceSelector
                          bisSource={status.bisSource}
                          onSelect={(source) => handleSourceChange(slot, source)}
                          disabled={!gearPermission.allowed}
                          disabledReason={gearPermission.reason}
                          hasItemData={!!status.itemName}
                          itemName={status.itemName}
                          itemIcon={status.itemIcon}
                          slotIcon={GEAR_SLOT_ICONS[slot]}
                          itemLevel={status.itemLevel}
                          itemStats={status.itemStats}
                          hasItem={status.hasItem}
                          isAugmented={status.isAugmented}
                        />
                      </div>
                    );
                  })()}
                </td>
                <td className="py-1">
                  <div className="flex justify-center">
                    <GearStatusCircle
                      state={toGearState(status.hasItem, status.isAugmented)}
                      bisSource={status.bisSource}
                      requiresAugmentation={needsAug}
                      disabled={!gearPermission.allowed}
                      onChange={(newState) => handleGearStateChange(slot, newState)}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TooltipProvider>
  );
}
