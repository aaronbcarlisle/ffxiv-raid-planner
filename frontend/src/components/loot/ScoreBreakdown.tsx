/* eslint-disable react-refresh/only-export-components -- hasAdjustments is exported alongside the component so RecipientPicker (Task 5: matrix/queue rows too) can gate the "Adjusted" tag without a second copy of the predicate. */
/**
 * ScoreBreakdown — D-25's score-transparency leaf (Phase-D D3): the priority
 * score and its components, one line per nonzero part. Signs follow
 * lootCoordination.ts:535 (score = base + drought − balance; both stored as
 * positive magnitudes). Sibling-import only, like RankingExplanation.
 */
import type { PriorityScoreBreakdown } from '../../utils/priority';

export function hasAdjustments(breakdown: PriorityScoreBreakdown): boolean {
  return breakdown.lootAdjustmentBonus !== 0 || breakdown.playerModifier !== 0;
}

// Fractional drought/balance render at one decimal, integers stay bare.
const num = (n: number) => (Number.isInteger(n) ? String(Math.abs(n)) : Math.abs(n).toFixed(1));
const fmt = (n: number) => (n < 0 ? `−${num(n)}` : `+${num(n)}`);

export function ScoreBreakdown({ breakdown, score, droughtBonus, balancePenalty }: {
  breakdown: PriorityScoreBreakdown;
  score?: number;
  droughtBonus?: number;
  balancePenalty?: number;
}) {
  const lines: Array<[string, number]> = [
    ['Role priority', breakdown.rolePriority],
    ['Need', breakdown.weightedNeedBonus],
    ['Job modifier', breakdown.jobModifier],
    ['Player modifier', breakdown.playerModifier],
    ['Loot adjustment', breakdown.lootAdjustmentBonus],
    ['Drought bonus', droughtBonus ?? 0],
    ['Balance penalty', -(balancePenalty ?? 0)], // a penalty subtracts
  ].filter((l): l is [string, number] => l[1] !== 0);
  return (
    <span className="block min-w-0">
      {score !== undefined && (
        <span className="block text-xs font-semibold text-text-secondary">Priority score {score}</span>
      )}
      {lines.length === 0 ? (
        <span className="block text-xs text-text-tertiary">Base score only</span>
      ) : (
        lines.map(([label, value]) => (
          <span key={label} className="block text-xs text-text-tertiary">
            {label} <span className="font-semibold text-text-secondary">{fmt(value)}</span>
          </span>
        ))
      )}
    </span>
  );
}
