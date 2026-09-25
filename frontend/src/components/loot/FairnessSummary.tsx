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

  const mostFewestValue = most && fewest ? `${most.count} / ${fewest.count}` : '—';
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
      <StatCard label="Most / fewest" value={mostFewestValue} detail={mostFewestDetail} />
      <StatCard
        label="Distribution"
        value={even ? 'Even' : 'Uneven'}
        valueClassName={even ? 'text-status-success' : 'text-status-warning'}
        detail={`spread ${spread} — ${even ? 'within' : 'over'} the ±2 band`}
      />
      <StatCard label="This week" value={String(thisWeekCount)} detail={`${thisWeekPending} pending`} />
    </div>
  );
}
