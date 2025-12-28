import { useState, useRef } from 'react';
import { Checkbox } from '../ui/Checkbox';
import { ItemHoverCard } from '../ui/ItemHoverCard';
import type { GearSlotStatus, GearSource, TomeWeaponStatus, GearSlot } from '../../types';
import { GEAR_SLOTS, GEAR_SLOT_NAMES, GEAR_SLOT_ICONS } from '../../types';

// Reusable slot icon component with optional item icon and hover card
// - Shows actual item icon if available, otherwise placeholder
// - Empty: grey (opacity-50)
// - Raid + Have: white (100%)
// - Tome + Have: half-white (50%) - not complete until augmented
// - Tome + Have + Aug: white (100%)
function SlotIcon({
  slot,
  status,
  size = 16,
  showHover = false,
}: {
  slot: GearSlot;
  status: GearSlotStatus;
  size?: number;
  showHover?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={iconRef}
      className={`relative ${showHover && hasItemData ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => showHover && hasItemData && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={iconUrl}
        alt={status.itemName || GEAR_SLOT_NAMES[slot]}
        width={size}
        height={size}
        className={`${iconClass} ${isActualItemIcon ? 'rounded' : ''}`}
      />

      {/* Hover card */}
      {showHover && isHovered && hasItemData && (
        <div className="absolute z-50 left-full ml-2 top-1/2 -translate-y-1/2">
          <ItemHoverCard
            itemName={status.itemName!}
            itemLevel={status.itemLevel!}
            itemIcon={status.itemIcon}
            itemStats={status.itemStats}
            bisSource={bisSource}
          />
        </div>
      )}
    </div>
  );
}

// Special weapon row with optional tome weapon sub-row
interface WeaponSlotRowProps {
  status: GearSlotStatus;
  tomeWeapon: TomeWeaponStatus;
  onGearChange: (updates: Partial<GearSlotStatus>) => void;
  onTomeWeaponChange: (updates: Partial<TomeWeaponStatus>) => void;
}

function WeaponSlotRow({
  status,
  tomeWeapon,
  onGearChange,
  onTomeWeaponChange,
}: WeaponSlotRowProps) {
  return (
    <>
      {/* Main weapon row */}
      <tr className="border-t border-border-default/50">
        <td className="py-1.5 text-text-secondary">
          <div className="flex items-center gap-2">
            <SlotIcon slot="weapon" status={status} showHover />
            <span>{GEAR_SLOT_NAMES.weapon}</span>
          </div>
        </td>
        <td className="py-1.5 text-center">
          <div className="flex justify-center gap-1">
            {/* Raid is always on for weapon */}
            <span className="px-2 py-0.5 rounded text-xs bg-source-raid/30 text-source-raid">
              R
            </span>
            {/* +T is a toggle for interim tome weapon */}
            <button
              onClick={() => onTomeWeaponChange({ pursuing: !tomeWeapon.pursuing })}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                tomeWeapon.pursuing
                  ? 'bg-source-tome/30 text-source-tome'
                  : 'bg-bg-hover text-text-muted hover:text-text-secondary'
              }`}
              title={tomeWeapon.pursuing ? 'Stop tracking tome weapon' : 'Track interim tome weapon'}
            >
              +T
            </button>
          </div>
        </td>
        <td className="py-1.5">
          <div className="flex justify-center">
            <Checkbox
              checked={status.hasItem}
              onChange={(checked) => onGearChange({ hasItem: checked })}
            />
          </div>
        </td>
        <td className="py-1.5">
          <div className="flex justify-center text-text-muted">
            {/* Raid weapon can't be augmented */}
            —
          </div>
        </td>
      </tr>

      {/* Tome weapon sub-row (only shown when pursuing) */}
      {tomeWeapon.pursuing && (
        <tr className="border-t border-border-default/30 bg-bg-secondary/30">
          <td
            className={`py-1 pl-4 text-xs ${
              tomeWeapon.hasItem
                ? tomeWeapon.isAugmented
                  ? 'text-text-primary'
                  : 'text-text-secondary'
                : 'text-text-muted'
            }`}
          >
            └ Tome Wep
          </td>
          <td className="py-1 text-center">
            <span className="text-xs text-source-tome">T</span>
          </td>
          <td className="py-1">
            <div className="flex justify-center">
              <Checkbox
                checked={tomeWeapon.hasItem}
                onChange={(checked) => onTomeWeaponChange({ hasItem: checked })}
              />
            </div>
          </td>
          <td className="py-1">
            <div className="flex justify-center">
              <Checkbox
                checked={tomeWeapon.isAugmented}
                onChange={(checked) => onTomeWeaponChange({ isAugmented: checked })}
                disabled={!tomeWeapon.hasItem}
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
}

export function GearTable({
  gear,
  tomeWeapon,
  onGearChange,
  onTomeWeaponChange,
  compact = false,
}: GearTableProps) {
  const getSlotStatus = (slot: string): GearSlotStatus => {
    return gear.find((g) => g.slot === slot) ?? {
      slot: slot as GearSlotStatus['slot'],
      bisSource: 'raid',
      hasItem: false,
      isAugmented: false,
    };
  };

  const handleSourceChange = (slot: string, source: GearSource) => {
    onGearChange(slot, { bisSource: source });
  };

  const handleHasItemChange = (slot: string, hasItem: boolean) => {
    onGearChange(slot, { hasItem });
  };

  const handleAugmentedChange = (slot: string, isAugmented: boolean) => {
    onGearChange(slot, { isAugmented });
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
                    : 'bg-bg-hover'
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
    <table className="w-full text-sm">
      <thead>
        <tr className="text-text-muted text-xs">
          <th className="text-left py-1 font-normal">Slot</th>
          <th className="text-center py-1 font-normal w-20">BiS</th>
          <th className="text-center py-1 font-normal w-16">Have</th>
          <th className="text-center py-1 font-normal w-16">Aug</th>
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
                onTomeWeaponChange={onTomeWeaponChange}
              />
            );
          }

          const canAugment = status.bisSource === 'tome' && status.hasItem;

          return (
            <tr key={slot} className="border-t border-border-default/50">
              <td className="py-1.5 text-text-secondary">
                <div className="flex items-center gap-2">
                  <SlotIcon slot={slot} status={status} showHover />
                  <span>{GEAR_SLOT_NAMES[slot]}</span>
                </div>
              </td>
              <td className="py-1.5 text-center">
                <div className="flex justify-center gap-1">
                  <button
                    onClick={() => handleSourceChange(slot, 'raid')}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      status.bisSource === 'raid'
                        ? 'bg-source-raid/30 text-source-raid'
                        : 'bg-bg-hover text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    R
                  </button>
                  <button
                    onClick={() => handleSourceChange(slot, 'tome')}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      status.bisSource === 'tome'
                        ? 'bg-source-tome/30 text-source-tome'
                        : 'bg-bg-hover text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    T
                  </button>
                </div>
              </td>
              <td className="py-1.5">
                <div className="flex justify-center">
                  <Checkbox
                    checked={status.hasItem}
                    onChange={(checked) => handleHasItemChange(slot, checked)}
                  />
                </div>
              </td>
              <td className="py-1.5">
                <div className="flex justify-center">
                  <Checkbox
                    checked={status.isAugmented}
                    onChange={(checked) => handleAugmentedChange(slot, checked)}
                    disabled={!canAugment}
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
