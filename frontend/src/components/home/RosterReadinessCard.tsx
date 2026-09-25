/**
 * RosterReadinessCard (ring0 `home/`)
 *
 * Hero readiness glance for the redesigned Home: a three-stat strip
 * (avg iLvl · at-full-BiS % · raider count, via the shared `StatCell` idiom)
 * over a single "BiS complete" progress bar, with a footer tallying obtained
 * BiS slots and members still needing setup.
 *
 * Boundary discipline (ring0): reads the tier store (`useTierPlayers` — ring0→
 * store is allowed) and composes shared `ui/` components. Never imports a
 * ring1/ring3 component. The readiness math lives in `utils/rosterReadiness`,
 * shared verbatim with the legacy `StaticHomeTab` so the numbers stay identical.
 */

import { CardShell } from '../ui/CardShell';
import { ProgressBar } from '../ui/ProgressBar';
import { StatCell } from '../ui/StatCell';
import { useTierPlayers } from '../../stores/tierStore';
import { bisCompleteCount, bisSlotTotals, rosterAvgIlv } from '../../utils/rosterReadiness';

/** A roster member still needs setup if it's unconfigured or has no BiS imported. */
function needsSetup(players: ReturnType<typeof useTierPlayers>): number {
  return players.filter((p) => {
    if (p.isSubstitute) return false;
    if (!p.configured) return true;
    return !p.gear.some((s) => s.bisSource !== null && s.bisSource !== undefined);
  }).length;
}

export function RosterReadinessCard() {
  const players = useTierPlayers();

  const raiders = players.filter((p) => p.configured && !p.isSubstitute);
  const raiderCount = raiders.length;
  const avgIlv = rosterAvgIlv(players);
  const bisComplete = bisCompleteCount(players);
  const { obtained, total } = bisSlotTotals(players);

  const bisPct = raiderCount > 0 ? Math.round((bisComplete / raiderCount) * 100) : 0;
  const barValue = total > 0 ? obtained / total : 0;
  const allObtained = total > 0 && obtained === total;
  const setupNeeded = needsSetup(players);

  return (
    <CardShell title="Roster readiness">
      <div className="flex items-stretch divide-x divide-border-subtle">
        <div className="flex-1">
          <StatCell value={avgIlv != null ? String(avgIlv) : '—'} label="Avg iLvl" />
        </div>
        <div className="flex-1">
          <StatCell value={`${bisPct}%`} label="At full BiS" />
        </div>
        <div className="flex-1">
          <StatCell value={String(raiderCount)} label="Raiders" />
        </div>
      </div>

      <ProgressBar
        className="mt-4"
        value={barValue}
        color={allObtained ? 'success' : 'accent'}
        ariaLabel="BiS complete"
      />

      <p className="mt-2 text-xs text-text-tertiary leading-snug">
        {obtained}/{total} BiS slots obtained
        {setupNeeded > 0 && (
          <> · {setupNeeded} member{setupNeeded === 1 ? ' needs' : 's need'} setup</>
        )}
      </p>
    </CardShell>
  );
}
