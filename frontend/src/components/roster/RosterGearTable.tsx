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
 * C4 (D-04) restores the tome-weapon story on the weapon row: the shared
 * `WeaponBiSSelector` in the BiS cell (R fixed + "+" interim-tome toggle) and,
 * while pursuing, the sub-row with its OWN 3-state circle and the Alt+Click
 * material-entry jump. Later slices continue here: ledger jumps (C7).
 */

import { Fragment, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { GearStatusCircle } from '../ui/GearStatusCircle';
import { ItemHoverCard } from '../ui/ItemHoverCard';
import { BiSSourceSelector, WeaponBiSSelector } from '../player/BiSSourceSelector';
import { Button, LongPressTooltip, Tooltip } from '../primitives';
import { getCorrectBisSource } from '../../utils/bisSourceDetection';
import type { GearSlot, GearSlotStatus, GearSource, TomeWeaponStatus } from '../../types';
import {
  BIS_SOURCE_FULL_NAMES,
  GEAR_SLOTS,
  GEAR_SLOT_ICONS,
  GEAR_SLOT_NAMES,
} from '../../types';
import { fromGearState, requiresAugmentation, toGearState, type GearState } from '../../utils/calculations';
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
          ? 'Click or press Enter/Space to cycle: empty → base obtained (ring) → augmented (filled).'
          : 'Click or press Enter/Space to toggle: empty ↔ obtained (filled).'}
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
  /**
   * C3 (D-03): a BiS-source selection from the shared selector popover (null =
   * Clear Slot). The reset-warning confirm lives inside the shared leaf; the
   * parent owns the reset-shaped mutation.
   */
  onSourceChange?: (slot: GearSlot, source: GearSource | null) => void;
  /**
   * C3 (D-03): the per-slot Fix button — corrects a miscategorized
   * `bisSource` while PRESERVING progress and item metadata.
   */
  onSourceFix?: (slot: GearSlot, source: GearSource) => void;
  /**
   * C4 (D-04): tome-weapon updates from the weapon row — the "+" toggle sends
   * `{ pursuing }`, the sub-row circle `{ hasItem, isAugmented }` (via the
   * shared `fromGearState`, as legacy `WeaponSlotRow` does). The parent owns
   * the mutation: the LEGACY `tomeWeapon` spread — tomeWeapon is its own
   * player field, never a gear slot through `computeGearSlotUpdate`.
   */
  onTomeWeaponChange?: (updates: Partial<TomeWeaponStatus>) => void;
  /** C4: whether this player has a tome-weapon material-log entry to jump to. */
  hasTomeMaterialEntry?: boolean;
  /** C4: the Alt+Click jump from the sub-row label to that material entry. */
  onTomeMaterialJump?: () => void;
  /** Why editing is unavailable (shown by the disabled selector). */
  disabledReason?: string;
}

export function RosterGearTable({
  gear,
  tomeWeapon,
  editable = false,
  onSlotChange,
  onSourceChange,
  onSourceFix,
  onTomeWeaponChange,
  hasTomeMaterialEntry = false,
  onTomeMaterialJump,
  disabledReason,
}: RosterGearTableProps) {
  const bySlot = new Map(gear.map((g) => [g.slot, g]));
  // Affordances track ACTUAL interactivity: `editable` without a handler
  // would advertise an action that persists nothing (one flag per handler).
  const interactive = editable && !!onSlotChange;
  const sourceInteractive = editable && !!onSourceChange;
  const fixInteractive = editable && !!onSourceFix;
  const tomeInteractive = editable && !!onTomeWeaponChange;
  // Sub-row label tint tracks tome progress (legacy WeaponSlotRow treatment):
  // muted → secondary (base obtained) → primary (augmented).
  const tomeLabelClass = tomeWeapon.hasItem
    ? tomeWeapon.isAugmented
      ? 'text-text-primary'
      : 'text-text-secondary'
    : 'text-text-muted';

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
              <Tooltip content="Click or press Enter/Space on a circle to cycle: missing → have → augmented (tome)">
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
          // the sub-row below): 2-state cycle, no augment step.
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

          const mainRow = (
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
                  // C4 (D-04): the SHARED weapon selector — BiS weapon is
                  // ALWAYS raid (fixed R), the "+" toggles interim tome
                  // tracking and reveals the sub-row below. Replaces C1's
                  // static R/+T glyph: that placeholder was the pre-restore
                  // rendering of this same cell, so this is the restore, not
                  // a delta.
                  <WeaponBiSSelector
                    tomeWeapon={tomeWeapon}
                    onTomeWeaponChange={(updates) => onTomeWeaponChange?.(updates)}
                    disabled={!tomeInteractive}
                    disabledReason={disabledReason}
                  />
                ) : (
                  // C3 (D-03): the shared R/T/C/BT selector popover (its
                  // reset-warning confirm lives inside the leaf) + the
                  // per-slot Fix for miscategorized imports. Layout forked
                  // from legacy GearTable's BiS cell: Fix hangs off the
                  // selector's left so the selector's position never shifts.
                  (() => {
                    const correctSource = fixInteractive ? getCorrectBisSource(status) : null;
                    return (
                      <div className="relative flex items-center justify-center">
                        {correctSource && (
                          <div className="absolute right-full mr-0.5">
                            <Tooltip content={`Fix: Set to ${BIS_SOURCE_FULL_NAMES[correctSource]}`}>
                              {/* Button-not-IconButton is deliberate: IconButton has no
                                  warning variant and forces a 44px mobile min-size.
                                  Same warning tokens as legacy's raw button; geometry
                                  differs (xs pill vs legacy's 24px square) — recorded
                                  delta, matrix D-03. */}
                              <Button
                                variant="warning"
                                size="xs"
                                aria-label={`Fix BiS source to ${BIS_SOURCE_FULL_NAMES[correctSource]}`}
                                onClick={() => onSourceFix?.(slot, correctSource)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </Tooltip>
                          </div>
                        )}
                        <BiSSourceSelector
                          bisSource={status.bisSource}
                          onSelect={(source) => onSourceChange?.(slot, source)}
                          disabled={!sourceInteractive}
                          disabledReason={disabledReason}
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
                  })()
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

          // ── Tome-weapon sub-row (C4, D-04 restore; legacy R-094/R-095) ──
          // Its OWN 3-state circle (tome + augment step) reporting through the
          // same onTomeWeaponChange as the "+" toggle. The label carries the
          // material jump ONLY when an entry exists — a navigation, not an
          // edit, so it is deliberately NOT gated on `editable` (legacy
          // parity: viewers can follow the record). Unlike legacy's mouse-only
          // Alt+Click span, the v2 label announces itself (role=link), Enter
          // follows it, and plain click activates it — an announced link that
          // rejects plain activation would be dead to AT browse-mode users,
          // whose activation arrives as a synthetic plain click (director F3;
          // recorded matrix delta with a ruling request). Alt+Click still
          // works: it is a click.
          //
          // The row list ALWAYS returns this Fragment (sub-row conditional
          // INSIDE it): flipping `pursuing` must not change the element type
          // at this array index, or React remounts the subtree and drops
          // keyboard focus from the "+" toggle that caused the flip
          // (director F1).
          return (
            <Fragment key={slot}>
              {mainRow}
              {isWeapon && tomeWeapon.pursuing && (
              <tr className="border-t border-border-subtle/60 bg-surface-elevated/40">
                <th
                  scope="row"
                  aria-label="Tome Weapon (interim)"
                  className="py-1.5 pl-8 pr-2 text-left text-xs font-normal"
                >
                  {hasTomeMaterialEntry && onTomeMaterialJump ? (
                    <Tooltip
                      content={
                        <span className="text-xs">
                          Click (or press Enter) to jump to the material entry
                        </span>
                      }
                    >
                      {/* design-system-ignore: hand-rolled role=link — LinkText cannot serve here: its event-less onClick and hardcoded text-accent would erase the progress tint this label encodes (muted→secondary→primary); full keyboard + announcement provided inline */}
                      <span
                        role="link"
                        tabIndex={0}
                        aria-label="Tome Weapon — jump to its material entry"
                        className={`cursor-pointer transition-colors hover:text-accent focus-visible:text-accent ${tomeLabelClass}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onTomeMaterialJump();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            onTomeMaterialJump();
                          }
                        }}
                      >
                        └ Tome Weapon
                      </span>
                    </Tooltip>
                  ) : (
                    <span className={tomeLabelClass}>└ Tome Weapon</span>
                  )}
                </th>
                <td className="py-1.5 text-center">
                  <span
                    className={`inline-flex w-7 items-center justify-center rounded py-0.5 text-xs font-bold text-gear-tome ${tomeInteractive ? '' : 'opacity-50'}`}
                  >
                    T
                  </span>
                </td>
                <td className="py-1.5">
                  <div className="flex justify-center">
                    <GearStatusCircle
                      state={toGearState(tomeWeapon.hasItem, tomeWeapon.isAugmented)}
                      bisSource="tome"
                      requiresAugmentation
                      disabled={!tomeInteractive}
                      onChange={(next) => onTomeWeaponChange?.(fromGearState(next))}
                      tooltip={tomeInteractive ? cycleHint('tome', true) : undefined}
                    />
                  </div>
                </td>
              </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
