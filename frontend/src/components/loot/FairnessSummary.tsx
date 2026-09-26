/**
 * FairnessSummary — 2×2 fairness strip (via the shared `StatCell` idiom) at
 * the top of static Home's side column (F6d, spec §5.5; moved off Loot ▸
 * History in D14, R-40). Presentational: rolls up `computeTierFairness`
 * (Task 1) over the store slices `Home` now holds and renders the result.
 * Home is its only mount.
 */
import { useMemo } from 'react';
import { computeTierFairness } from '../../utils/lootFairness';
import { StatCell } from '../ui/StatCell';
import type { SnapshotPlayer, StaticSettings, LootLogEntry, MaterialLogEntry, PageLedgerEntry } from '../../types';

export interface FairnessSummaryProps {
  players: SnapshotPlayer[]; settings: StaticSettings;
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; pageLedger: PageLedgerEntry[];
  currentWeek: number; floors: string[];
}

export function FairnessSummary({
  players, settings, lootLog, materialLog, pageLedger, currentWeek, floors,
}: FairnessSummaryProps) {
  const fairness = useMemo(
    () => computeTierFairness({ players, settings, lootLog, materialLog, pageLedger, currentWeek, floors }),
    [players, settings, lootLog, materialLog, pageLedger, currentWeek, floors],
  );
  const { dropsThisTier, weeksSpanned, most, fewest, spread, even, thisWeekCount, thisWeekPending } = fairness;

  const mostFewestDetail = most && fewest ? (
    <>
      <div>Most: {most.names.join(', ')}</div>
      <div>Fewest: {fewest.names.join(', ')}</div>
    </>
  ) : null;

  return (
    <div className="grid grid-cols-2">
      <div className="border-r border-b border-border-subtle pr-3 pb-3">
        <StatCell
          align="start"
          label="Drops this tier"
          value={String(dropsThisTier)}
          detail={`across ${weeksSpanned} raid week${weeksSpanned === 1 ? '' : 's'}`}
        />
      </div>
      {/* R-E1 / #30 empty roster (keyed off `most && fewest`, lootFairness.ts:81-89
          sets the pair together — never one without the other): the
          Most/fewest and Distribution rows compare players that don't exist
          — a single sibling-styled line (TeamSummaryCard.tsx:268-269 /
          NeedMatrix.tsx:149 idiom) replaces both instead of showing "—" and
          "Even"/"spread 0", which would read as a real (empty) result. R-E2-H:
          the two remaining stats (Drops this tier, This week) sit side by
          side in row 1, and the message spans both columns in row 2 — no
          empty grid cell. */}
      {most && fewest ? (
        <>
          <div className="border-b border-border-subtle pb-3 pl-3">
            <StatCell align="start" label="Most / fewest" value={`${most.count} / ${fewest.count}`} detail={mostFewestDetail} />
          </div>
          <div className="border-r border-border-subtle pr-3 pt-3">
            <StatCell
              align="start"
              label="Distribution"
              value={even ? 'Even' : 'Uneven'}
              valueClassName={even ? 'text-status-success' : 'text-status-warning'}
              detail={`spread ${spread} — ${even ? 'within' : 'over'} the ±2 band`}
            />
          </div>
          <div className="pt-3 pl-3">
            <StatCell align="start" label="This week" value={String(thisWeekCount)} detail={`${thisWeekPending} pending`} />
          </div>
        </>
      ) : (
        <>
          <div className="border-b border-border-subtle pb-3 pl-3">
            <StatCell align="start" label="This week" value={String(thisWeekCount)} detail={`${thisWeekPending} pending`} />
          </div>
          <p className="col-span-2 pt-3 text-sm text-text-muted">No configured players on the roster yet.</p>
        </>
      )}
    </div>
  );
}
