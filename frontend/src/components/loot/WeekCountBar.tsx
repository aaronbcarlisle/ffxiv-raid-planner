/**
 * WeekCountBar — v2-owned fairness read (D6b, ruling R-D6n).
 *
 * Same boundary semantics as the frozen `history/LootCountBar.tsx`: main
 * roster only, counts scoped to one week, sorted by seat, colored against
 * the roster average, with a per-tile tooltip. Re-expressed rather than
 * imported because the frozen file drops to `text-[10px]`/`text-[9px]` —
 * below the 12px floor this v2 surface (and the grid it sits under) holds
 * everywhere else. Read the frozen file for the semantics; this is a fresh
 * expression of them, not a transcription.
 *
 * Mounted directly under `LogWeekGrid` on the Log view (`Loot.tsx`), fed the
 * DISPLAYED week (`logWeek.week`) — never the clock's `currentWeek` (D6-g)
 * — so the read always matches whatever week the grid above it shows.
 */

import type { SnapshotPlayer, LootLogEntry } from '../../types';
import { getRoleColor, getValidRole } from '../../gamedata';
import { Tooltip } from '../primitives';

export interface WeekCountBarProps {
  players: SnapshotPlayer[];
  lootLog: LootLogEntry[];
  week: number;
}

// Roster seat order for display — a local constant (R-D6n: not imported
// from `history/`, so this file has no runtime dependency on the frozen one).
const SEAT_ORDER = ['T1', 'T2', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];

export function WeekCountBar({ players, lootLog, week }: WeekCountBarProps) {
  const mainRoster = players.filter((p) => !p.isSubstitute);
  if (mainRoster.length === 0) return null;

  const weekEntries = lootLog.filter((e) => e.weekNumber === week);
  const countByPlayer = new Map<string, number>();
  for (const entry of weekEntries) {
    countByPlayer.set(entry.recipientPlayerId, (countByPlayer.get(entry.recipientPlayerId) ?? 0) + 1);
  }

  const seated = [...mainRoster].sort((a, b) => {
    // PR #245 r2 (Copilot round 2): a missing/null position AND a truthy but
    // unrecognized one (corrupt/legacy data — `RaidPosition` doesn't admit
    // this at the type level, but runtime data isn't guaranteed to respect
    // that) both sort LAST. Previously only the missing/null branch got the
    // `SEAT_ORDER.length` sentinel — a garbage truthy value fell through to
    // `indexOf`'s `-1` and sorted FIRST instead, ahead of T1.
    const seatOf = (p: SnapshotPlayer) => {
      if (!p.position) return SEAT_ORDER.length;
      const idx = SEAT_ORDER.indexOf(p.position);
      return idx === -1 ? SEAT_ORDER.length : idx;
    };
    return seatOf(a) - seatOf(b);
  });

  const total = mainRoster.reduce((sum, p) => sum + (countByPlayer.get(p.id) ?? 0), 0);
  const average = total / mainRoster.length;

  return (
    <div className="flex gap-2 overflow-x-auto rounded-lg border border-border-default bg-surface-card p-3">
      {seated.map((player) => {
        const count = countByPlayer.get(player.id) ?? 0;
        const roleColor = getRoleColor(getValidRole(player.role));
        const deviation = count - average;
        const countColor =
          deviation > 1
            ? 'var(--color-status-info)'
            : deviation < -1
              ? 'var(--color-status-warning)'
              : 'var(--color-text-secondary)';
        const deviationLabel =
          deviation === 0 ? 'At average' : `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)} from avg`;

        return (
          <Tooltip
            key={player.id}
            content={
              <div>
                <div className="font-medium">{player.name}</div>
                <div className="mt-0.5 text-xs text-text-secondary">
                  {count} drop{count !== 1 ? 's' : ''} this week
                </div>
                <div className="mt-1 text-xs text-text-muted">{deviationLabel}</div>
              </div>
            }
          >
            <div
              data-testid="week-count-tile"
              data-player-id={player.id}
              className="min-w-[70px] flex-1 cursor-help rounded-lg border border-border-subtle bg-surface-elevated p-2 text-center"
            >
              <div className="mb-0.5 text-xs font-semibold" style={{ color: roleColor }}>
                {player.position || player.role?.slice(0, 2).toUpperCase() || '?'}
              </div>
              <div className="truncate text-xs text-text-muted">{player.name}</div>
              <div data-testid="week-count-value" className="text-xl font-bold" style={{ color: countColor }}>
                {count}
              </div>
              <div className="text-xs uppercase text-text-muted">drops</div>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}
