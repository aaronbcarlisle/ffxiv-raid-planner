/**
 * RosterGearTable — v2 gear-table shell (Phase C, D-01 chassis + D-02 editing).
 *
 * The expanded card body: LAYOUT forked from legacy `player/GearTable.tsx`
 * (R-066, the D-01 restore target) and restyled with v2 tokens; interactive
 * leaves stay SHARED (`GearStatusCircle`, `ItemHoverCard`, tooltip primitives)
 * per plan §2.1's fork-shells/share-leaves rule (jscpd gate).
 *
 * C2 (D-02) wires the editing interactions ON these rows: the shared status
 * circle cycles through `getNextGearState` (click / Enter / Space — the circle
 * owns keyboard + announcement), the slot cell shows the item hover card, and
 * the Status column carries its cycle-hint tooltips. All of it only when
 * `editable` — the table itself stays presentational: the parent card decides
 * permission (`canEditGear`) and owns the mutation (`computeGearSlotUpdate` →
 * `actions.onUpdate`, one shared path with legacy and the Board).
 * Later slices continue here: BiS-source selector/Fix/banner (C3), the
 * tome-weapon sub-row (C4), ledger jumps (C7).
 */

import type { ReactNode } from 'react';
import { GearStatusCircle } from '../ui/GearStatusCircle';
import { ItemHoverCard } from '../ui/ItemHoverCard';
import { LongPressTooltip, Tooltip } from '../primitives';
import type { GearSlot, GearSlotStatus, GearSource, TomeWeaponStatus } from '../../types';
import {
  BIS_SOURCE_COLORS,
  BIS_SOURCE_FULL_NAMES,
  BIS_SOURCE_NAMES,
  GEAR_SLOTS,
  GEAR_SLOT_ICONS,
  GEAR_SLOT_NAMES,
} from '../../types';
import { requiresAugmentation, toGearState, type GearState } from '../../utils/calculations';
import { hasHoverData } from './gearHoverData';

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

/**
 * Cycle-hint tooltip for an editable status circle (v2 wording of the legacy
 * GearTable hint; shown only where the user can actually toggle).
 */
function cycleHint(bisSource: GearSource, requiresAug: boolean): ReactNode {
  const threeStep = bisSource === 'tome' && requiresAug;
  return (
    <div className="max-w-[15rem]">
      <div className="font-medium">{BIS_SOURCE_FULL_NAMES[bisSource]} status</div>
      <div className="mt-1 text-xs text-text-secondary">
        {threeStep
          ? 'Click cycles: empty → base obtained (ring) → augmented (filled).'
          : 'Click toggles: empty ↔ obtained (filled).'}
      </div>
    </div>
  );
}

export interface RosterGearTableProps {
  gear: GearSlotStatus[];
  tomeWeapon: TomeWeaponStatus;
  /**
   * C2 (D-02): when true the status circles cycle and the editing affordances
   * (cycle-hint tooltips) appear. The parent card gates this on `canEditGear`.
   * Absent/false = the C1 read-only rendering.
   */
  editable?: boolean;
  /**
   * Receives the slot and the cycled state (the shared `GearStatusCircle` →
   * `getNextGearState` machine computes it). The parent owns the mutation.
   */
  onSlotChange?: (slot: GearSlot, next: GearState) => void;
}

export function RosterGearTable({ gear, tomeWeapon, editable = false, onSlotChange }: RosterGearTableProps) {
  const bySlot = new Map(gear.map((g) => [g.slot, g]));
  // Affordances track ACTUAL interactivity: `editable` without a handler
  // would advertise a cycle that persists nothing.
  const interactive = editable && !!onSlotChange;

  return (
    // table-fixed: the header row's w-12/w-14 pin the BiS/Status columns and the
    // slot column absorbs the rest, so a long nowrap item name truncates instead
    // of inflating its column and clipping the headers off the card edge.
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="text-xs text-text-muted">
          <th className="py-1 text-left font-medium">Slot</th>
          <th className="w-12 px-1.5 py-1 text-center font-medium">BiS</th>
          <th className="w-14 px-1.5 py-1 text-center font-medium">
            {interactive ? (
              // Column-level cycle hint (legacy GearTable's Status-header
              // tooltip). RECORDED DELTA vs legacy (R-097 showed it to all
              // roles): shown only when the circles actually cycle — don't
              // teach an action the viewer can't perform. Matrix D-02 note.
              <Tooltip content="Click a circle to cycle: missing → have → augmented (tome)">
                <span className="cursor-help">Status</span>
              </Tooltip>
            ) : (
              'Status'
            )}
          </th>
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
          const iconUrl = status.itemIcon || GEAR_SLOT_ICONS[slot];
          // The weapon's main row is always the raid weapon (tome interim is
          // the C4 sub-row): 2-state cycle, no augment step.
          const circleSource = isWeapon ? 'raid' : status.bisSource;
          const circleRequiresAug = isWeapon ? false : requiresAugmentation(status);
          const hasItemData = hasHoverData(status);
          // Accessible row name mirrors the full visible content (slot + item
          // detail) — jsx-a11y's label traversal can't see the nested text.
          const rowLabel = status.itemName
            ? `${GEAR_SLOT_NAMES[slot]}, ${status.itemName}${status.itemLevel ? ` i${status.itemLevel}` : ''}`
            : GEAR_SLOT_NAMES[slot];

          const slotCell = (
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
          );

          return (
            <tr key={slot} className="border-t border-border-subtle">
              <th scope="row" aria-label={rowLabel} className="py-1.5 pr-2 text-left font-normal">
                {hasItemData ? (
                  // Hover item card (D-02): the legacy detailed gear tooltip,
                  // via the SHARED ItemHoverCard leaf. Ledger-jump affordances
                  // (Alt+Click / context menu) are C7, not here.
                  <LongPressTooltip
                    delayDuration={200}
                    side="right"
                    sideOffset={8}
                    content={
                      <ItemHoverCard
                        itemName={status.itemName}
                        itemLevel={status.itemLevel}
                        itemId={status.itemId}
                        itemIcon={status.itemIcon}
                        itemStats={status.itemStats}
                        bisSource={status.bisSource}
                        hasItem={status.hasItem}
                        isAugmented={status.isAugmented}
                        materia={status.materia}
                        equippedItemId={status.equippedItemId}
                        equippedItemName={status.equippedItemName}
                        equippedItemLevel={status.equippedItemLevel}
                        equippedItemIcon={status.equippedItemIcon}
                      />
                    }
                  >
                    {slotCell}
                  </LongPressTooltip>
                ) : (
                  slotCell
                )}
              </th>
              <td className="py-1.5 text-center">
                {isWeapon ? (
                  // BiS weapon is ALWAYS raid; "+T" marks an interim tome
                  // weapon being tracked (the sub-row itself is C4).
                  <span className="text-xs font-bold">
                    <span className={BIS_SOURCE_COLORS.raid}>{BIS_SOURCE_NAMES.raid}</span>
                    {tomeWeapon.pursuing && (
                      <>
                        <span className="font-normal text-text-muted">+</span>
                        <span className={BIS_SOURCE_COLORS.tome}>{BIS_SOURCE_NAMES.tome}</span>
                      </>
                    )}
                  </span>
                ) : status.bisSource ? (
                  <span className={`text-xs font-bold ${BIS_SOURCE_COLORS[status.bisSource]}`}>
                    {BIS_SOURCE_NAMES[status.bisSource]}
                  </span>
                ) : (
                  <span className="text-xs text-text-muted">—</span>
                )}
              </td>
              <td className="py-1.5">
                <div className="flex justify-center">
                  <GearStatusCircle
                    state={toGearState(status.hasItem, status.isAugmented)}
                    bisSource={circleSource}
                    requiresAugmentation={circleRequiresAug}
                    onChange={(next) => onSlotChange?.(slot, next)}
                    disabled={!interactive}
                    tooltip={interactive && circleSource ? cycleHint(circleSource, circleRequiresAug) : undefined}
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
