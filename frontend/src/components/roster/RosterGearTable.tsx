/**
 * RosterGearTable — v2 read-only gear-table shell (Phase C slice C1, D-01).
 *
 * The expanded card body: LAYOUT forked from legacy `player/GearTable.tsx`
 * (R-066, the D-01 restore target) and restyled with v2 tokens; interactive
 * leaves stay SHARED (`GearStatusCircle`) per plan §2.1's fork-shells/
 * share-leaves rule (jscpd gate). READ-ONLY in C1 — later slices wire the
 * interactions onto these rows: click-to-cycle + hover item card (C2), the
 * BiS-source selector/Fix/banner (C3), the tome-weapon sub-row (C4), and the
 * ledger jumps (C7). What C1 shows per slot: real item icon (placeholder
 * fallback with the legacy state treatment), slot name, item name + iLv
 * detail, the BiS-source glyph (R/T/BT/C), and the shared status circle.
 */

import { GearStatusCircle } from '../ui/GearStatusCircle';
import type { GearSlotStatus, GearSource, TomeWeaponStatus } from '../../types';
import { GEAR_SLOTS, GEAR_SLOT_ICONS, GEAR_SLOT_NAMES } from '../../types';
import { requiresAugmentation, toGearState } from '../../utils/calculations';

/** Read-only BiS-source glyphs (C3 replaces these with the shared selector). */
const SOURCE_GLYPHS: Record<GearSource, { label: string; className: string }> = {
  raid: { label: 'R', className: 'text-gear-raid' },
  tome: { label: 'T', className: 'text-gear-tome' },
  base_tome: { label: 'BT', className: 'text-gear-base-tome' },
  crafted: { label: 'C', className: 'text-gear-crafted' },
};

/**
 * Icon state treatment, condensed from legacy `GearTable` SlotIcon: real item
 * icons dim/desaturate by progress; placeholder glyphs invert to read on the
 * dark surface and dim the same way.
 */
function slotIconClass(status: GearSlotStatus, isItemIcon: boolean): string {
  const incomplete =
    !status.hasItem || (status.bisSource === 'tome' && requiresAugmentation(status) && !status.isAugmented);
  if (isItemIcon) {
    if (!status.hasItem) return 'rounded opacity-50 grayscale';
    return incomplete ? 'rounded opacity-75' : 'rounded';
  }
  if (!status.hasItem) return 'opacity-50';
  return incomplete ? 'brightness-0 invert opacity-50' : 'brightness-0 invert opacity-90';
}

export interface RosterGearTableProps {
  gear: GearSlotStatus[];
  tomeWeapon: TomeWeaponStatus;
}

export function RosterGearTable({ gear, tomeWeapon }: RosterGearTableProps) {
  const bySlot = new Map(gear.map((g) => [g.slot, g]));

  return (
    // table-fixed: the header row's w-12/w-14 pin the BiS/Status columns and the
    // slot column absorbs the rest, so a long nowrap item name truncates instead
    // of inflating its column and clipping the headers off the card edge.
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="text-xs text-text-muted">
          <th className="py-1 text-left font-medium">Slot</th>
          <th className="w-12 px-1.5 py-1 text-center font-medium">BiS</th>
          <th className="w-14 px-1.5 py-1 text-center font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {GEAR_SLOTS.map((slot) => {
          const status: GearSlotStatus = bySlot.get(slot) ?? {
            slot,
            bisSource: 'raid',
            hasItem: false,
            isAugmented: false,
          };
          const isWeapon = slot === 'weapon';
          const glyph = status.bisSource ? SOURCE_GLYPHS[status.bisSource] : null;
          const iconUrl = status.itemIcon || GEAR_SLOT_ICONS[slot];

          return (
            <tr key={slot} className="border-t border-border-subtle">
              {/* aria-label: the rowheader's name is the slot; the visible
                  item-name detail sits below jsx-a11y's traversal depth. */}
              <th scope="row" aria-label={GEAR_SLOT_NAMES[slot]} className="py-1.5 pr-2 text-left font-normal">
                <div className="flex min-w-0 items-center gap-2.5">
                  <img
                    src={iconUrl}
                    alt=""
                    aria-hidden="true"
                    width={24}
                    height={24}
                    className={`shrink-0 ${slotIconClass(status, !!status.itemIcon)}`}
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-text-secondary">{GEAR_SLOT_NAMES[slot]}</div>
                    {status.itemName && (
                      <div className="truncate text-xs text-text-muted">
                        {status.itemName}
                        {status.itemLevel ? ` · i${status.itemLevel}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </th>
              <td className="py-1.5 text-center">
                {isWeapon ? (
                  // BiS weapon is ALWAYS raid; "+T" marks an interim tome
                  // weapon being tracked (the sub-row itself is C4).
                  <span className="text-xs font-bold">
                    <span className="text-gear-raid">R</span>
                    {tomeWeapon.pursuing && (
                      <>
                        <span className="font-normal text-text-muted">+</span>
                        <span className="text-gear-tome">T</span>
                      </>
                    )}
                  </span>
                ) : glyph ? (
                  <span className={`text-xs font-bold ${glyph.className}`}>{glyph.label}</span>
                ) : (
                  <span className="text-xs text-text-muted">—</span>
                )}
              </td>
              <td className="py-1.5">
                <div className="flex justify-center">
                  <GearStatusCircle
                    state={toGearState(status.hasItem, status.isAugmented)}
                    bisSource={isWeapon ? 'raid' : status.bisSource}
                    requiresAugmentation={isWeapon ? false : requiresAugmentation(status)}
                    onChange={() => {}}
                    disabled
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
