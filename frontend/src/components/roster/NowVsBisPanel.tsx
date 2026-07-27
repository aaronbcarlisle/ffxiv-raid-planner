/**
 * Now-vs-BiS breakdown panel (C5, D-10 remainder / legacy R-075).
 *
 * Tooltip content behind the roster card's iLvl readout: per-slot BiS-target
 * iLv, with the equipped ("Now") column when Lodestone/Tomestone sync data
 * covers enough slots. Forked from the byte-frozen legacy PlayerCardHeader
 * breakdown and restyled to the v2 12px text floor (the legacy column header
 * ran at 10px).
 */
import { GEAR_SLOT_NAMES, GEAR_SLOTS } from '../../types';
import type { GearSlotStatus } from '../../types';
import { getEffectiveCurrentSource } from '../../utils/calculations';
import { getItemLevelForCategory } from '../../gamedata/raid-tiers';

/**
 * Per-slot BiS-target iLv, mirroring `calculateAverageItemLevel`'s slot logic:
 * un-augmented tome / base-tome / crafted pieces price at their category level,
 * owned imports use the imported itemLevel, everything else infers from the
 * effective current source.
 */
function getSlotBisItemLevel(slot: GearSlotStatus, tierId: string): number {
  const isWeapon = slot.slot === 'weapon';
  if (slot.hasItem) {
    if (slot.bisSource === 'tome' && !slot.isAugmented) {
      return getItemLevelForCategory(tierId, 'tome', isWeapon);
    }
    if (slot.bisSource === 'base_tome') return getItemLevelForCategory(tierId, 'tome', isWeapon);
    if (slot.bisSource === 'crafted') return getItemLevelForCategory(tierId, 'crafted', isWeapon);
    if (slot.itemLevel && slot.itemLevel > 0) return slot.itemLevel;
  }
  const source = getEffectiveCurrentSource(slot);
  return getItemLevelForCategory(tierId, source === 'unknown' ? 'crafted' : source, isWeapon);
}

interface NowVsBisPanelProps {
  gear: GearSlotStatus[];
  tierId: string;
  /** Rounded equipped average; 0 when sync data covers under half the slots. */
  equippedAvgIlv: number;
  /** BiS-target average from `calculateAverageItemLevel`. */
  bisAvgIlv: number;
}

export function NowVsBisPanel({ gear, tierId, equippedAvgIlv, bisAvgIlv }: NowVsBisPanelProps) {
  const hasNow = equippedAvgIlv > 0;
  return (
    <div className={hasNow ? 'min-w-[200px]' : 'min-w-[140px]'}>
      <div className="mb-1.5 font-medium">Average Item Level</div>
      <div className="space-y-0.5 text-xs">
        {hasNow && (
          <div className="mb-1 flex justify-between gap-3 text-xs text-text-muted">
            <span className="w-16" />
            <span className="w-8 text-right">Now</span>
            <span className="w-8 text-right">BiS</span>
          </div>
        )}
        {GEAR_SLOTS.map((slotKey) => {
          const slot = gear.find((g) => g.slot === slotKey);
          if (!slot) return null;
          const bis = getSlotBisItemLevel(slot, tierId);
          const now = slot.equippedItemLevel ?? 0;
          const behind = hasNow && now > 0 && now < bis;
          return (
            <div key={slotKey} className="flex justify-between gap-3">
              <span className="text-text-secondary">{GEAR_SLOT_NAMES[slotKey]}</span>
              {hasNow && (
                <span
                  className={
                    now > 0
                      ? now >= bis
                        ? 'text-status-success'
                        : 'text-status-warning'
                      : 'text-text-muted'
                  }
                >
                  {now > 0 ? now : '—'}
                </span>
              )}
              <span className={slot.hasItem ? 'text-status-success' : 'text-text-muted'}>
                {bis}
                {behind && <span className="ml-0.5 text-status-warning">({now - bis})</span>}
              </span>
            </div>
          );
        })}
        <div className="mt-1.5 space-y-0.5 border-t border-border-subtle pt-1.5">
          {hasNow ? (
            <>
              <div className="flex justify-between font-medium">
                <span className="text-text-muted">Equipped avg</span>
                <span className="text-accent">i{equippedAvgIlv}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">BiS target avg</span>
                <span className="text-text-secondary">i{bisAvgIlv}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between font-medium">
              <span>Average</span>
              <span className="text-accent">i{bisAvgIlv}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
