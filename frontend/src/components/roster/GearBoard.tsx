/**
 * GearBoard — the Roster Board gear matrix (ring0, F6c Board).
 *
 * The re-homed gearsheet: party-grouped rows × 11 slot columns + a BiS summary
 * column, and the bird's-eye gear-*editing* surface. Reuses the same store
 * derivations legacy GroupViewContent feeds the gear table (`groupPlayersByLightParty`,
 * `bisSlotTotals`, `calculateAverageItemLevel`) — no new aggregation. Clicking a
 * cell cycles obtained state through the shared gear state machine
 * (`getNextGearState` → `computeGearSlotUpdate`) and persists via the per-player
 * `actionsForPlayer(player).onUpdate`. Visual target: `mockups/02-roster-board.html`.
 *
 * Deliberate decisions (documented to pre-empt review false-positives):
 *   - Board ALWAYS groups by light party (separateSubs=true), matching the
 *     always-grouped mockup; it does not read the Cards `groupView`/`subsHidden`
 *     toggles (those are Cards-only, gated off the Board toolbar in Task 7).
 *   - Party-divider rows are rendered fresh here (a `<tr><td colspan>`), NOT by
 *     refining the legacy `player/LightPartyHeader` (byte-for-byte: no legacy
 *     edits; LightPartyHeader is typed groupNumber:1|2 with no Subs variant).
 *   - `need.up` priority highlight (F6d): the optional `priorities` map (from
 *     `computeNextUpgradePriorities`, keyed by playerId → needed slots) marks a
 *     cell as the next-upgrade ●. Omitted → every cell renders plain need.
 *   - Keyboard (R-E1-E): ONE roving tab stop over the interactive cells, moved
 *     by unmodified arrow keys through the pure `nextBoardCell` (gearBoardNav.ts).
 *     The cells keep `role="checkbox"`; the table gains no grid role. The stop
 *     is derived at render from `activeCell` (keyed `{ playerId, slot }`, never
 *     row/col — indices drift when a player above leaves or the OFFH column
 *     toggles), falling back to the first interactive cell in render order.
 */
import { Fragment, useId, useRef, useState } from 'react';
import { PlayerIdentity } from '../ui/PlayerIdentity';
import { GearBoardCell } from './GearBoardCell';
import { nextBoardCell } from './gearBoardNav';
import { equippedAverageIlv } from './rosterIlv';
import {
  groupPlayersByLightParty,
  calculateAverageItemLevel,
  toGearState,
  requiresAugmentation,
  getNextGearState,
  computeGearSlotUpdate,
  fromGearState,
} from '../../utils/calculations';
import { bisSlotTotals } from '../../utils/rosterReadiness';
import { canEditGear } from '../../utils/permissions';
import { getValidRole } from '../../gamedata';
import { isOffhandRelevant, relevantGear } from '../../utils/offhand';
import type { GearSlot, GearSlotStatus, MemberRole, SnapshotPlayer } from '../../types';

// Base column set; the off-hand column joins only when ANY roster player is
// offhand-relevant (PLD, or slot data) — the board's columns are global, so
// the gate is roster-level rather than per-row.
const BASE_SLOT_ORDER: GearSlot[] = [
  'weapon', 'head', 'body', 'hands', 'legs', 'feet',
  'earring', 'necklace', 'bracelet', 'ring1', 'ring2',
];
const BASE_SLOT_HEADS = ['Wpn', 'Head', 'Body', 'Hand', 'Legs', 'Feet', 'Ear', 'Neck', 'Wrst', 'Rng', 'Rng'];
const OFFHAND_SLOT_ORDER: GearSlot[] = ['weapon', 'offhand', ...BASE_SLOT_ORDER.slice(1)];
const OFFHAND_SLOT_HEADS = ['Wpn', 'OffH', ...BASE_SLOT_HEADS.slice(1)];

export interface GearBoardProps {
  players: SnapshotPlayer[];
  tierId?: string;
  /**
   * Per-row gear-edit gate inputs — the exact trio `RosterCards` receives
   * (RosterCards.tsx), fed to `canEditGear(userRole, player, currentUserId,
   * isAdminAccess)` once per player row. Owner/lead/admin rows are all
   * editable; a member's OWN claimed row (`player.userId === currentUserId`)
   * is editable while every other row stays inert; viewers edit nothing.
   * Replaces the old screen-wide `canManage` (the ROSTER-management
   * permission, which wrongly locked members out of their own gear).
   */
  userRole: MemberRole | null | undefined;
  currentUserId: string | null;
  isAdminAccess: boolean;
  actionsForPlayer: (player: SnapshotPlayer) => {
    onUpdate: (updates: Partial<SnapshotPlayer>) => void | Promise<void>;
  };
  /** F6d next-upgrade highlight: playerId → set of slots marked as the next upgrade. */
  priorities?: Map<string, Set<GearSlot>>;
}

/** A cell's identity across renders (R-E1-E) — never a row/col index. */
interface BoardCellKey {
  playerId: string;
  slot: GearSlot;
}

/** One rendered player row: what every cell receives, plus the per-column
 * interactive flags `nextBoardCell` navigates over (editable, has a BiS
 * target, and not folded into the no-BiS spanning row). */
interface BoardRow {
  player: SnapshotPlayer;
  editable: boolean;
  obtained: number;
  total: number;
  cells: Array<GearSlotStatus | undefined>;
  interactive: boolean[];
}

const cellKey = (playerId: string, slot: GearSlot) => `${playerId}/${slot}`;

/** BiS-target slots that have the item / total BiS-target slots, for one player. */
function playerBis(player: SnapshotPlayer): { obtained: number; total: number } {
  return bisSlotTotals([{ ...player, configured: true, isSubstitute: false }]);
}

function summaryColor(obtained: number, total: number): string {
  if (total === 0) return 'text-text-muted';
  if (obtained >= total) return 'text-status-success';
  if (obtained / total < 0.5) return 'text-status-warning';
  return 'text-text-primary';
}

export function GearBoard({ players, tierId, userRole, currentUserId, isAdminAccess, actionsForPlayer, priorities }: GearBoardProps) {
  // Only players that actually render rows drive the column set — an
  // unconfigured PLD must not summon an all-empty OFFH column.
  const showOffhand = players.some((p) => p.configured && isOffhandRelevant(p.job, p.gear));
  const slotOrder = showOffhand ? OFFHAND_SLOT_ORDER : BASE_SLOT_ORDER;
  const slotHeads = showOffhand ? OFFHAND_SLOT_HEADS : BASE_SLOT_HEADS;
  const totalCols = slotOrder.length;
  const grouped = groupPlayersByLightParty(players.filter((p) => p.configured), true);
  const toRow = (player: SnapshotPlayer): BoardRow => {
    // Per-row gear-edit gate (legacy GearTable's per-player canEditGear
    // pattern, adapted to one-row-per-player).
    const editable = canEditGear(userRole, player, currentUserId ?? undefined, isAdminAccess).allowed;
    const { obtained, total } = playerBis(player);
    const cells = slotOrder.map((slot) => player.gear.find((x) => x.slot === slot));
    return { player, editable, obtained, total, cells, interactive: cells.map((g) => editable && total > 0 && !!g?.bisSource) };
  };
  const sections = [
    { label: 'Light Party 1', rows: grouped.group1 },
    { label: 'Light Party 2', rows: grouped.group2 },
    { label: 'Unassigned', rows: grouped.unassigned },
    { label: 'Substitutes', rows: grouped.substitutes },
  ].filter((s) => s.rows.length > 0).map((s) => ({ label: s.label, rows: s.rows.map(toRow) }));
  // Render order == grid row order: dividers are not rows, a no-BiS row is all-false.
  const rows = sections.flatMap((s) => s.rows);
  const grid = rows.map((r) => r.interactive);

  // R-E1-E roving tab stop, DERIVED here at render (no effect, no extra
  // render): the last focused interactive cell while it is still interactive,
  // else the first interactive cell in render order. A read-only board has no
  // interactive cell and therefore no stop.
  const [activeCell, setActiveCell] = useState<BoardCellKey | null>(null);
  const isInteractive = (key: BoardCellKey) => {
    const col = slotOrder.indexOf(key.slot);
    return col >= 0 && (rows.find((r) => r.player.id === key.playerId)?.interactive[col] ?? false);
  };
  const firstInteractive = (): BoardCellKey | null => {
    for (const r of rows) {
      const col = r.interactive.indexOf(true);
      if (col >= 0) return { playerId: r.player.id, slot: slotOrder[col] };
    }
    return null;
  };
  const tabStop = activeCell && isInteractive(activeCell) ? activeCell : firstInteractive();

  // Cell `<td>`s by { playerId, slot }: focus moves through this map, never a
  // document query. Read only from event handlers.
  const cellEls = useRef(new Map<string, HTMLTableCellElement>());
  const focusCell = (playerId: string, slot: GearSlot): boolean => {
    const el = cellEls.current.get(cellKey(playerId, slot))?.querySelector<HTMLElement>('[role="checkbox"]');
    if (!el) return false;
    el.focus();
    // `true` only when focus really moved — that is what lets the cell eat the key.
    return el.ownerDocument.activeElement === el;
  };
  const descriptionId = useId();

  // No permission guard inside `cycle`: it is only reachable via the per-row
  // `onCycle` closures below, which are withheld entirely for non-editable
  // rows (and `GearBoardCell` additionally no-ops while `disabled`).
  const cycle = async (player: SnapshotPlayer, slot: GearSlot) => {
    const g = player.gear.find((x) => x.slot === slot);
    if (!g || !g.bisSource) return;
    const next = getNextGearState(toGearState(g.hasItem, g.isAugmented), g.bisSource, requiresAugmentation(g));
    try {
      await actionsForPlayer(player).onUpdate(computeGearSlotUpdate(player, slot, fromGearState(next)));
    } catch (_error) {
      // Error already handled by api.ts (toast shown)
    }
  };

  return (
    // Flush, non-padded board container (mockup `.board`). A plain card wrapper —
    // not CardShell — because CardShell hardcodes `p-4` (its `.p-4` wins the
    // cascade over a `p-0` override), which would inset the matrix by 16px. The
    // bounded `max-h` makes the scroll container the sticky ancestor so the
    // `sticky top-0` header pins while the body scrolls.
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-border-default bg-surface-card">
      {/* The arrow-key description only where arrows do something: a read-only board has no stop. */}
      <table className="w-full border-collapse text-xs" aria-describedby={tabStop ? descriptionId : undefined}>
        <thead>
          <tr>
            {/* design-system-ignore: board micro-label — dense gearsheet column header (matches mockup 02-roster-board) */}
            <th className="sticky top-0 w-52 bg-surface-raised px-4 py-2.5 text-left font-display text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
              Player
            </th>
            {slotHeads.map((h, i) => (
              <th
                key={`${h}-${i}`}
                // design-system-ignore: board micro-label — dense gearsheet column header (matches mockup 02-roster-board)
                className="sticky top-0 bg-surface-raised px-1 py-2.5 text-center font-display text-[10px] font-bold uppercase tracking-wide text-text-tertiary"
              >
                {h}
              </th>
            ))}
            {/* design-system-ignore: board micro-label — dense gearsheet column header (matches mockup 02-roster-board) */}
            <th className="sticky top-0 w-20 bg-surface-raised px-1 py-2.5 text-center font-display text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
              BiS
            </th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.label}>
              <tr>
                <td
                  colSpan={totalCols + 2}
                  // design-system-ignore: board micro-label — dense gearsheet party-divider label (matches mockup 02-roster-board)
                  className="border-b border-border-default bg-surface-raised px-4 py-1.5 text-left font-display text-[10px] font-bold uppercase tracking-wide text-text-tertiary"
                >
                  {section.label}
                </td>
              </tr>
              {section.rows.map((row) => {
                const { player, editable, obtained, total, cells } = row;
                const rowIndex = rows.indexOf(row);
                const role = getValidRole(player.role);
                // Equipped-first, same expression as the RosterCard headline
                // (C5, director F3) — the two v2 roster views must print the
                // same number for the same player.
                const equippedIlv = equippedAverageIlv(player.gear);
                const iLvl = equippedIlv > 0 ? equippedIlv : calculateAverageItemLevel(player.gear, tierId ?? '', player.job);
                const subtitle = `${player.position ?? player.tankRole ?? role} · ${iLvl > 0 ? iLvl : '—'}`;
                return (
                  <tr key={player.id} className="hover:bg-accent/5">
                    <td
                      className="border-b border-border-subtle py-2 pl-3 pr-2 text-left"
                      style={{ borderLeft: `3px solid var(--color-role-${role}, var(--color-text-muted))` }}
                    >
                      <PlayerIdentity variant="board-cell" name={player.name} job={player.job} role={role} subtitle={subtitle} />
                    </td>
                    {total === 0 ? (
                      <td colSpan={totalCols} className="border-b border-border-subtle border-l border-border-subtle px-3 text-center text-xs font-semibold text-status-warning">
                        No BiS imported — priority can't be calculated
                      </td>
                    ) : (
                      slotOrder.map((slot, col) => {
                        const g = cells[col];
                        const cellInteractive = row.interactive[col];
                        return (
                          <td
                            key={slot}
                            className="h-10 border-b border-l border-border-subtle"
                            ref={(el) => {
                              const key = cellKey(player.id, slot);
                              if (el) cellEls.current.set(key, el);
                              else cellEls.current.delete(key);
                            }}
                          >
                            {g ? (
                              <GearBoardCell
                                slot={g}
                                role={role}
                                priority={priorities?.get(player.id)?.has(slot) ?? false}
                                disabled={!editable}
                                onCycle={editable ? () => void cycle(player, slot) : undefined}
                                isTabStop={tabStop?.playerId === player.id && tabStop.slot === slot}
                                onFocus={cellInteractive
                                  ? () => setActiveCell((prev) => (prev?.playerId === player.id && prev.slot === slot ? prev : { playerId: player.id, slot }))
                                  : undefined}
                                onNavigate={cellInteractive
                                  ? (key) => {
                                    const next = nextBoardCell(grid, { row: rowIndex, col }, key);
                                    return next !== null && focusCell(rows[next.row].player.id, slotOrder[next.col]);
                                  }
                                  : undefined}
                              />
                            ) : null}
                          </td>
                        );
                      })
                    )}
                    <td className={`border-b border-l border-border-default text-center font-display text-[13px] font-extrabold ${summaryColor(obtained, total)}`}>
                      {total === 0 ? '—' : (
                        <>
                          {obtained}
                          {/* design-system-ignore: board micro-label — dense gearsheet summary denominator (matches mockup 02-roster-board) */}
                          <span className="font-sans text-[9.5px] font-semibold text-text-tertiary">/{relevantGear(player.job, player.gear).length || 11}</span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      {tabStop && <span id={descriptionId} className="sr-only">Use arrow keys to move between gear cells.</span>}
    </div>
  );
}
