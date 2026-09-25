/**
 * FairnessSummary — 4-stat-card fairness strip at the top of static Home's
 * side column (F6d, spec §5.5; moved off Loot ▸ History in D14, R-40).
 * Presentational: rolls up `computeTierFairness` (Task 1) over the store
 * slices `Home` now holds and renders the result. Its grid is fitted for the
 * narrow side column (two columns at every width ≥ `sm` — Home is its only
 * mount, so there is no wide-History four-column step to size for).
 */
import { useMemo } from 'react';
import { computeTierFairness } from '../../utils/lootFairness';
import type { SnapshotPlayer, StaticSettings, LootLogEntry, MaterialLogEntry, PageLedgerEntry } from '../../types';

export interface FairnessSummaryProps {
  players: SnapshotPlayer[]; settings: StaticSettings;
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; pageLedger: PageLedgerEntry[];
  currentWeek: number; floors: string[];
}

function StatCard({ label, value, valueClassName, detail }: {
  label: string; value: string; valueClassName?: string; detail: string;
}) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-card px-4 py-3.5">
      <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary">{label}</div>
      <div className={`font-display text-2xl font-extrabold${valueClassName ? ` ${valueClassName}` : ''}`}>
        {value}
      </div>
      <div className="text-xs text-text-tertiary">{detail}</div>
    </div>
  );
}

export function FairnessSummary({
  players, settings, lootLog, materialLog, pageLedger, currentWeek, floors,
}: FairnessSummaryProps) {
  const fairness = useMemo(
    () => computeTierFairness({ players, settings, lootLog, materialLog, pageLedger, currentWeek, floors }),
    [players, settings, lootLog, materialLog, pageLedger, currentWeek, floors],
  );
  const { dropsThisTier, weeksSpanned, most, fewest, spread, even, thisWeekCount, thisWeekPending } = fairness;

  const mostFewestDetail = most && fewest
    ? `${most.names.join(', ')} ${most.count} · ${fewest.names.join(', ')} ${fewest.count}`
    : '';

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <StatCard
        label="Drops this tier"
        value={String(dropsThisTier)}
        detail={`across ${weeksSpanned} raid week${weeksSpanned === 1 ? '' : 's'}`}
      />
      {/* R-E1 / #30 empty roster (keyed off `most && fewest`, lootFairness.ts:81-89
          sets the pair together — never one without the other): the
          Most/fewest and Distribution rows compare players that don't exist
          — a single sibling-styled line (TeamSummaryCard.tsx:268-269 /
          NeedMatrix.tsx:149 idiom) replaces both instead of showing "—" and
          "Even"/"spread 0", which would read as a real (empty) result. */}
      {most && fewest ? (
        <>
          <StatCard label="Most / fewest" value={`${most.count} / ${fewest.count}`} detail={mostFewestDetail} />
          <StatCard
            label="Distribution"
            value={even ? 'Even' : 'Uneven'}
            valueClassName={even ? 'text-status-success' : 'text-status-warning'}
            detail={`spread ${spread} — ${even ? 'within' : 'over'} the ±2 band`}
          />
        </>
      ) : (
        <p className="sm:col-span-2 text-sm text-text-muted">No configured players on the roster yet.</p>
      )}
      <StatCard label="This week" value={String(thisWeekCount)} detail={`${thisWeekPending} pending`} />
    </div>
  );
}
