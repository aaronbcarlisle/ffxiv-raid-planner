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
import { Checkbox } from '../ui/Checkbox';
import { ItemHoverCard } from '../ui/ItemHoverCard';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { Tooltip, TooltipProvider } from '../primitives';
import type { GearSlotStatus, GearSource, TomeWeaponStatus, GearSlot, SnapshotPlayer } from '../../types';
import { GEAR_SLOTS, GEAR_SLOT_NAMES, GEAR_SLOT_ICONS, GEAR_SOURCE_NAMES, GEAR_SOURCE_COLORS } from '../../types';
import { canEditGear, type MemberRole } from '../../utils/permissions';
import { toast } from '../../stores/toastStore';
import { FileSearch } from 'lucide-react';

// Helper function to get upgrade material tooltip based on gear slot
function getUpgradeMaterialTooltip(slot: GearSlot): string {
  // Accessories need Glaze
  if (['earring', 'necklace', 'bracelet', 'ring1', 'ring2'].includes(slot)) {
    return 'Get Glaze from Floor 1 (M9S) or Floor 2 (M10S)';
  }

  // Left-side armor needs Twine
  if (['head', 'body', 'hands', 'legs', 'feet'].includes(slot)) {
    return 'Get Twine from Floor 3 (M11S)';
  }

  // Weapon needs Solvent
  if (slot === 'weapon') {
    return 'Get Solvent from Floor 3 (M11S)';
  }

  return 'Augmentation needed';
}

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
        label: 'Go to Loot Entry',
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
      if (bisSource === 'raid') {
        iconClass = 'brightness-0 invert opacity-90';
      } else {
        iconClass = isAugmented
          ? 'brightness-0 invert opacity-90'
          : 'brightness-0 invert opacity-50';
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
          content={
            <ItemHoverCard
              itemName={status.itemName!}
              itemLevel={status.itemLevel!}
              itemIcon={status.itemIcon}
              itemStats={status.itemStats}
              bisSource={bisSource}
            />
          }
          side="right"
          sideOffset={8}
        >
          <div
            className={`cursor-pointer ${hasLootEntry && onNavigateToLootEntry ? 'hover:ring-1 hover:ring-accent/50 rounded' : ''}`}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            title={hasLootEntry ? 'Alt+Click to go to loot entry' : undefined}
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

  return (
    <>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={hasLootEntry && onNavigateToLootEntry ? 'cursor-pointer hover:ring-1 hover:ring-accent/50 rounded' : ''}
        title={hasLootEntry ? 'Alt+Click to go to loot entry' : undefined}
      >
        {iconElement}
      </div>
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
  onGearChange: (updates: Partial<GearSlotStatus>) => void;
  onTomeWeaponChange: (updates: Partial<TomeWeaponStatus>) => void;
  disabled?: boolean;
  disabledTooltip?: string;
  hasLootEntry?: boolean;
  onNavigateToLootEntry?: (slot: GearSlot) => void;
}

function WeaponSlotRow({
  status,
  tomeWeapon,
  onGearChange,
  onTomeWeaponChange,
  disabled = false,
  disabledTooltip,
  hasLootEntry = false,
  onNavigateToLootEntry,
}: WeaponSlotRowProps) {
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
          <div className="flex justify-center gap-1">
            {/* Raid is always on for weapon */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs bg-gear-raid/20 text-gear-raid font-medium ${disabled ? 'opacity-50' : ''}`}>
              Raid
            </span>
            {/* + is a toggle for interim tome weapon */}
            <button
              onClick={() => onTomeWeaponChange({ pursuing: !tomeWeapon.pursuing })}
              className={`inline-flex items-center justify-center w-6 h-5 rounded text-xs font-medium transition-colors ${
                tomeWeapon.pursuing
                  ? 'bg-gear-tome/20 text-gear-tome'
                  : `bg-surface-interactive text-text-muted ${!disabled ? 'hover:text-text-secondary' : ''}`
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={disabled ? disabledTooltip : (tomeWeapon.pursuing ? 'Stop tracking tome weapon' : 'Track interim tome weapon')}
              disabled={disabled}
            >
              +
            </button>
          </div>
        </td>
        <td className="py-1">
          <div className="flex justify-center" title={disabled ? disabledTooltip : undefined}>
            <Checkbox
              checked={status.hasItem}
              onChange={(checked) => onGearChange({ hasItem: checked })}
              disabled={disabled}
            />
          </div>
        </td>
        <td className="py-1">
          <div className="flex justify-center text-text-muted">
            {/* Show + when tome weapon tracking enabled, otherwise — */}
            {tomeWeapon.pursuing ? '+' : '—'}
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
            <span className={`inline-flex items-center text-xs text-gear-tome font-medium ${disabled ? 'opacity-50' : ''}`}>Tome</span>
          </td>
          <td className="py-1">
            <div className="flex justify-center" title={disabled ? disabledTooltip : undefined}>
              <Checkbox
                checked={tomeWeapon.hasItem}
                onChange={(checked) => {
                  // When unchecking "Have", also uncheck "Augmented"
                  if (!checked) {
                    onTomeWeaponChange({ hasItem: checked, isAugmented: false });
                  } else {
                    onTomeWeaponChange({ hasItem: checked });
                  }
                }}
                disabled={disabled}
              />
            </div>
          </td>
          <td className="py-1">
            <div
              className="flex justify-center"
              title={
                disabled
                  ? disabledTooltip || 'Get the tome weapon first'
                  : tomeWeapon.hasItem && !tomeWeapon.isAugmented
                    ? 'Get Solvent from Floor 3 (M11S)'
                    : undefined
              }
            >
              <Checkbox
                checked={tomeWeapon.isAugmented}
                onChange={(checked) => onTomeWeaponChange({ isAugmented: checked })}
                disabled={disabled || !tomeWeapon.hasItem}
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
  isAdmin,
  slotsWithLootEntries,
  onNavigateToLootEntry,
}: GearTableProps) {
  // Check gear edit permission
  const gearPermission = canEditGear(userRole, player, currentUserId, isAdmin);
  const getSlotStatus = (slot: string): GearSlotStatus => {
    return gear.find((g) => g.slot === slot) ?? {
      slot: slot as GearSlotStatus['slot'],
      bisSource: 'raid',
      hasItem: false,
      isAugmented: false,
    };
  };

  const handleSourceChange = (slot: string, source: GearSource) => {
    if (!gearPermission.allowed) {
      toast.warning(gearPermission.reason || 'You do not have permission to edit gear');
      return;
    }
    onGearChange(slot, { bisSource: source });
  };

  const handleHasItemChange = (slot: string, hasItem: boolean) => {
    if (!gearPermission.allowed) {
      toast.warning(gearPermission.reason || 'You do not have permission to edit gear');
      return;
    }
    // When unchecking "Have", also uncheck "Augmented" to keep state consistent
    if (!hasItem) {
      onGearChange(slot, { hasItem, isAugmented: false });
    } else {
      onGearChange(slot, { hasItem });
    }
  };

  const handleAugmentedChange = (slot: string, isAugmented: boolean) => {
    if (!gearPermission.allowed) {
      toast.warning(gearPermission.reason || 'You do not have permission to edit gear');
      return;
    }
    onGearChange(slot, { isAugmented });
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
          const isComplete = status.hasItem && (status.bisSource === 'raid' || status.isAugmented);

          // Use actual item icon if available, otherwise placeholder
          const iconUrl = status.itemIcon || GEAR_SLOT_ICONS[slot];
          const isActualItemIcon = !!status.itemIcon;

          // Determine icon class based on completion state and icon type
          let iconClass = '';
          if (isActualItemIcon) {
            // Actual item icons - adjust opacity based on state
            if (!status.hasItem) {
              iconClass = 'opacity-50 grayscale';
            } else if (status.bisSource === 'tome' && !status.isAugmented) {
              iconClass = 'opacity-75';
            }
          } else {
            // Placeholder icons - use brightness inversion
            iconClass = 'opacity-40'; // Default: empty/grey
            if (status.hasItem) {
              if (status.bisSource === 'raid') {
                iconClass = 'brightness-0 invert opacity-90';
              } else {
                iconClass = status.isAugmented
                  ? 'brightness-0 invert opacity-90'
                  : 'brightness-0 invert opacity-50';
              }
            }
          }

          // Build title with item name if available
          const itemInfo = status.itemName ? `${status.itemName} (iLvl ${status.itemLevel})` : GEAR_SLOT_NAMES[slot];
          const sourceInfo = status.bisSource === 'raid' ? 'Raid' : 'Tome';
          const stateInfo = `${status.hasItem ? ' ✓' : ''}${status.isAugmented ? ' Aug' : ''}`;

          return (
            <div
              key={slot}
              className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
                isComplete
                  ? 'bg-status-success/30'
                  : status.hasItem
                    ? 'bg-status-warning/30'
                    : 'bg-surface-interactive'
              }`}
              title={`${itemInfo}: ${sourceInfo}${stateInfo}`}
            >
              <img
                src={iconUrl}
                alt={status.itemName || GEAR_SLOT_NAMES[slot]}
                width={18}
                height={18}
                className={`${iconClass} ${isActualItemIcon ? 'rounded' : ''}`}
              />
            </div>
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
            <th className="text-center py-1 font-medium w-16">Have</th>
            <th className="text-center py-1 font-medium w-16">Aug</th>
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
                  onGearChange={(updates) => onGearChange(slot, updates)}
                  onTomeWeaponChange={handleTomeWeaponUpdate}
                  disabled={!gearPermission.allowed}
                  disabledTooltip={gearPermission.reason}
                  hasLootEntry={slotsWithLootEntries?.has('weapon')}
                  onNavigateToLootEntry={onNavigateToLootEntry}
                />
              );
            }

            const canAugment = status.bisSource === 'tome' && status.hasItem;

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
                  <div className="flex justify-center">
                    <button
                      onClick={() => handleSourceChange(slot, status.bisSource === 'raid' ? 'tome' : 'raid')}
                      className={`inline-flex items-center justify-center gap-1 w-14 py-0.5 rounded text-xs font-medium transition-colors ${
                        status.bisSource === 'raid'
                          ? 'bg-gear-raid/20 text-gear-raid'
                          : 'bg-gear-tome/20 text-gear-tome'
                      } ${!gearPermission.allowed ? 'opacity-50 cursor-not-allowed' : 'hover:ring-1 hover:ring-white/20'}`}
                      disabled={!gearPermission.allowed}
                      title={!gearPermission.allowed ? gearPermission.reason : 'Click to toggle BiS source'}
                    >
                      {status.bisSource === 'raid' ? 'Raid' : 'Tome'}
                      <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                      </svg>
                    </button>
                  </div>
                </td>
                <td className="py-1">
                  <div className="flex justify-center" title={!gearPermission.allowed ? gearPermission.reason : undefined}>
                    <Checkbox
                      checked={status.hasItem}
                      onChange={(checked) => handleHasItemChange(slot, checked)}
                      disabled={!gearPermission.allowed}
                    />
                  </div>
                </td>
                <td className="py-1">
                  {status.bisSource === 'raid' ? (
                    <div className="flex justify-center">
                      {/* Raid gear can't be augmented - empty cell */}
                    </div>
                  ) : (
                    <div
                      className="flex justify-center"
                      title={
                        !gearPermission.allowed
                          ? gearPermission.reason
                          : status.bisSource === 'tome' && !status.hasItem
                            ? 'Get tome gear first'
                            : status.bisSource === 'tome' && status.hasItem && !status.isAugmented
                              ? getUpgradeMaterialTooltip(status.slot)
                              : undefined
                      }
                    >
                      <Checkbox
                        checked={status.isAugmented}
                        onChange={(checked) => handleAugmentedChange(slot, checked)}
                        disabled={!gearPermission.allowed || !canAugment}
                      />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TooltipProvider>
  );
}
