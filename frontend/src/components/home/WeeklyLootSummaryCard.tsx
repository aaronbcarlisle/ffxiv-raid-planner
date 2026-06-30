/**
 * WeeklyLootSummaryCard (ring0 `home/`)
 *
 * Static-wide "This week's loot" Home card. For each fight in the tier it
 * shows whether the static has cleared it this week and how many drops were
 * logged, plus a single CTA that routes to the Loot tab to log this week's
 * loot.
 *
 * Boundary discipline (ring0): reads stores (`lootTrackingStore` — ring0→store
 * is allowed) and gamedata (not ring-typed) via `useWeeklyLootSummary`, and
 * composes shared `ui/` + `primitives/` components. It must NEVER import a
 * ring1/ring3 component.
 *
 * Bar semantics are honest to the data — no fabricated percentage:
 *   - cleared            → full fill, `success` color, "cleared · N drops"
 *   - not cleared, drops → empty fill, `accent` color, "N drops"
 *   - not cleared, none  → empty fill, `accent` color, "in progress"
 */

import { CardShell } from '../ui/CardShell';
import { ProgressBar } from '../ui/ProgressBar';
import { Button } from '../primitives/Button';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useWeeklyLootSummary } from '../../hooks/useWeeklyLootSummary';

export interface WeeklyLootSummaryCardProps {
  /** Active tier id; resolves the tier's fights. Undefined → empty card. */
  tierId: string | undefined;
  /** Routes to the Loot tab to log this week's loot. */
  onLogWeek: () => void;
}

function pluralizeDrops(n: number): string {
  return `${n} drop${n === 1 ? '' : 's'}`;
}

export function WeeklyLootSummaryCard({ tierId, onLogWeek }: WeeklyLootSummaryCardProps) {
  const lootLog = useLootTrackingStore((s) => s.lootLog);
  const pageLedger = useLootTrackingStore((s) => s.pageLedger);
  const currentWeek = useLootTrackingStore((s) => s.currentWeek);

  const summary = useWeeklyLootSummary({ tierId, lootLog, pageLedger, week: currentWeek });
  const totalDrops = summary.reduce((sum, fight) => sum + fight.dropCount, 0);

  return (
    <CardShell
      title="This week's loot"
      headerRight={
        <span className="text-xs text-text-tertiary leading-none">
          {pluralizeDrops(totalDrops)} logged
        </span>
      }
    >
      <ul className="flex flex-col gap-3">
        {summary.map(({ fight, cleared, dropCount }) => {
          const statusText = cleared
            ? `cleared · ${pluralizeDrops(dropCount)}`
            : dropCount > 0
              ? pluralizeDrops(dropCount)
              : 'in progress';
          return (
            <li key={fight} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-text-primary">{fight}</span>
                <span className="text-xs text-text-tertiary">{statusText}</span>
              </div>
              <ProgressBar
                value={cleared ? 1 : 0}
                color={cleared ? 'success' : 'accent'}
                ariaLabel={`${fight} — ${statusText}`}
              />
            </li>
          );
        })}
      </ul>

      <Button variant="primary" className="w-full mt-4" onClick={onLogWeek}>
        Log this week's loot
      </Button>
    </CardShell>
  );
}
