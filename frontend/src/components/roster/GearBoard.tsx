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
 *   - `need.up` priority highlight is F6d's — cells render plain need (priority
 *     prop left at its default).
 */
import { Fragment } from 'react';
import { CardShell } from '../ui';
import { PlayerIdentity } from '../ui/PlayerIdentity';
import { GearBoardCell } from './GearBoardCell';
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
import { getRoleColor, getValidRole } from '../../gamedata';
import type { GearSlot, SnapshotPlayer } from '../../types';

const SLOT_ORDER: GearSlot[] = [
  'weapon', 'head', 'body', 'hands', 'legs', 'feet',
  'earring', 'necklace', 'bracelet', 'ring1', 'ring2',
];
const SLOT_HEADS = ['Wpn', 'Head', 'Body', 'Hand', 'Legs', 'Feet', 'Ear', 'Neck', 'Wrst', 'Rng', 'Rng'];
const TOTAL = 11;

export interface GearBoardProps {
  players: SnapshotPlayer[];
  tierId?: string;
  canManage: boolean;
  actionsForPlayer: (player: SnapshotPlayer) => {
    onUpdate: (updates: Partial<SnapshotPlayer>) => void | Promise<void>;
  };
}

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

export function GearBoard({ players, tierId, canManage, actionsForPlayer }: GearBoardProps) {
  const grouped = groupPlayersByLightParty(players.filter((p) => p.configured), true);
  const sections: Array<{ label: string; rows: SnapshotPlayer[] }> = [
    { label: 'Light Party 1', rows: grouped.group1 },
    { label: 'Light Party 2', rows: grouped.group2 },
    { label: 'Unassigned', rows: grouped.unassigned },
    { label: 'Substitutes', rows: grouped.substitutes },
  ].filter((s) => s.rows.length > 0);

  const cycle = (player: SnapshotPlayer, slot: GearSlot) => {
    if (!canManage) return;
    const g = player.gear.find((x) => x.slot === slot);
    if (!g || !g.bisSource) return;
    const next = getNextGearState(toGearState(g.hasItem, g.isAugmented), g.bisSource, requiresAugmentation(g));
    void actionsForPlayer(player).onUpdate(computeGearSlotUpdate(player, slot, fromGearState(next)));
  };

  return (
    <CardShell as="div" className="overflow-x-auto p-0">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {/* design-system-ignore: board micro-label — dense gearsheet column header (matches mockup 02-roster-board) */}
            <th className="sticky top-0 w-52 bg-surface-raised px-4 py-2.5 text-left font-display text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
              Player
            </th>
            {SLOT_HEADS.map((h, i) => (
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
                  colSpan={TOTAL + 2}
                  // design-system-ignore: board micro-label — dense gearsheet party-divider label (matches mockup 02-roster-board)
                  className="border-b border-border-default bg-surface-raised px-4 py-1.5 text-left font-display text-[10px] font-bold uppercase tracking-wide text-text-tertiary"
                >
                  {section.label}
                </td>
              </tr>
              {section.rows.map((player) => {
                const role = getValidRole(player.role);
                const { obtained, total } = playerBis(player);
                const iLvl = calculateAverageItemLevel(player.gear, tierId ?? '');
                const subtitle = `${player.position ?? player.tankRole ?? role} · ${iLvl > 0 ? iLvl : '—'}`;
                return (
                  <tr key={player.id} className="hover:bg-accent/5">
                    <td
                      className="border-b border-border-subtle py-2 pl-3 pr-2 text-left"
                      style={{ borderLeft: `3px solid ${getRoleColor(role)}` }}
                    >
                      <PlayerIdentity variant="board-cell" name={player.name} job={player.job} role={role} subtitle={subtitle} />
                    </td>
                    {total === 0 ? (
                      <td colSpan={TOTAL} className="border-b border-border-subtle border-l border-border-subtle px-3 text-center text-xs font-semibold text-status-warning">
                        No BiS imported — priority can't be calculated
                      </td>
                    ) : (
                      SLOT_ORDER.map((slot) => {
                        const g = player.gear.find((x) => x.slot === slot);
                        return (
                          <td key={slot} className="h-10 border-b border-l border-border-subtle">
                            {g ? (
                              <GearBoardCell slot={g} disabled={!canManage} onCycle={canManage ? () => cycle(player, slot) : undefined} />
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
                          <span className="font-sans text-[9.5px] font-semibold text-text-tertiary">/{TOTAL}</span>
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
    </CardShell>
  );
}
