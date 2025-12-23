import { Checkbox } from '../ui/Checkbox';
import type { GearSlotStatus, GearSource, TomeWeaponStatus, GearSlot } from '../../types';
import { GEAR_SLOTS, GEAR_SLOT_NAMES, GEAR_SLOT_ICONS } from '../../types';

// Reusable slot icon component
// - Empty: grey (opacity-50)
// - Raid + Have: white (100%)
// - Tome + Have: half-white (50%) - not complete until augmented
// - Tome + Have + Aug: white (100%)
function SlotIcon({
  slot,
  size = 16,
  hasItem = false,
  bisSource = 'raid',
  isAugmented = false,
}: {
  slot: GearSlot;
  size?: number;
  hasItem?: boolean;
  bisSource?: 'raid' | 'tome';
  isAugmented?: boolean;
}) {
  // Determine the icon style based on completion state
  let iconClass = 'opacity-50'; // Default: empty/grey

  if (hasItem) {
    if (bisSource === 'raid') {
      // Raid gear is complete when you have it
      iconClass = 'brightness-0 invert opacity-90';
    } else {
      // Tome gear: 50% when have, 100% when augmented
      iconClass = isAugmented
        ? 'brightness-0 invert opacity-90'
        : 'brightness-0 invert opacity-50';
    }
  }

  return (
    <img
      src={GEAR_SLOT_ICONS[slot]}
      alt={GEAR_SLOT_NAMES[slot]}
      width={size}
      height={size}
      className={iconClass}
    />
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
            <SlotIcon slot="weapon" hasItem={status.hasItem} bisSource="raid" />
            <span>{GEAR_SLOT_NAMES.weapon}</span>
          </div>
        </td>
        <td className="py-1.5 text-center">
          <div className="flex justify-center gap-1">
            {/* Raid is always on for weapon */}
            <span className="px-2 py-0.5 rounded text-xs bg-source-raid/30 text-source-raid">
              Raid
            </span>
            {/* +Tome is a toggle */}
            <button
              onClick={() => onTomeWeaponChange({ pursuing: !tomeWeapon.pursuing })}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                tomeWeapon.pursuing
                  ? 'bg-source-tome/30 text-source-tome'
                  : 'bg-bg-hover text-text-muted hover:text-text-secondary'
              }`}
              title={tomeWeapon.pursuing ? 'Stop tracking tome weapon' : 'Track interim tome weapon'}
            >
              +Tome
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
            <span className="text-xs text-source-tome">Tome</span>
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

          // Determine icon class based on completion state
          let iconClass = 'opacity-40'; // Default: empty/grey
          if (status.hasItem) {
            if (status.bisSource === 'raid') {
              iconClass = 'brightness-0 invert opacity-90';
            } else {
              // Tome: 50% when have, 100% when augmented
              iconClass = status.isAugmented
                ? 'brightness-0 invert opacity-90'
                : 'brightness-0 invert opacity-50';
            }
          }

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
              title={`${GEAR_SLOT_NAMES[slot]}: ${status.bisSource === 'raid' ? 'Raid' : 'Tome'}${status.hasItem ? ' (Have)' : ''}${status.isAugmented ? ' (Aug)' : ''}`}
            >
              <img
                src={GEAR_SLOT_ICONS[slot]}
                alt={GEAR_SLOT_NAMES[slot]}
                width={18}
                height={18}
                className={iconClass}
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
                  <SlotIcon
                    slot={slot}
                    hasItem={status.hasItem}
                    bisSource={status.bisSource}
                    isAugmented={status.isAugmented}
                  />
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
