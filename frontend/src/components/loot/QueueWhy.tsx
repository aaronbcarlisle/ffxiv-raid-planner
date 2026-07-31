/**
 * QueueWhy — the queue row's "why this order" content (Phase-D D3): R-6's
 * queue-row consumption of the explanation leaf, plus D-25's breakdown and
 * Adjusted badge (kickoff ruling 1) with warnings shown (ruling 2 — an
 * intentional hover/focus is the same consent as opening the picker), and
 * the surface-level "adjustments active" line (M-1 restore-both).
 * Renders INSIDE a Tooltip; sibling-import only.
 */
import { Tag } from '../ui';
import { RankingExplanation } from './RankingExplanation';
import { ScoreBreakdown, hasAdjustments } from './ScoreBreakdown';
import { explainCandidate } from '../../utils/rankingExplanation';
import type { RecipientEntry } from '../../utils/recipientRanking';
import type { GearSlot, LootLogEntry } from '../../types';

export function QueueWhy({ entries, slot, lootLog, enhancedActive, maxCandidates = 3 }: {
  entries: RecipientEntry[];
  slot: GearSlot | 'ring';
  lootLog: LootLogEntry[];
  /** FloorCard's legacy-gate expression — renders the surface "adjustments active" line. */
  enhancedActive?: boolean;
  /** Keep in sync with PriorityRow's default maxVisible — the popover explains the visible chips. */
  maxCandidates?: number;
}) {
  return (
    <span className="block w-72 space-y-2">
      {entries.slice(0, maxCandidates).map((e) => (
        <span key={e.player.id} className="block">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            {e.rank !== null && <span className="font-display">#{e.rank}</span>}
            <span className="truncate">{e.player.name}</span>
            {e.breakdown && hasAdjustments(e.breakdown) && (
              <Tag variant="label" tone="accent">Adjusted</Tag>
            )}
          </span>
          <RankingExplanation showWarnings explanation={explainCandidate(e, slot, { lootLog })} />
          {e.breakdown && (
            <ScoreBreakdown
              breakdown={e.breakdown} score={e.score}
              droughtBonus={e.droughtBonus} balancePenalty={e.balancePenalty}
            />
          )}
        </span>
      ))}
      {enhancedActive && (
        <span className="block text-xs text-text-tertiary">Loot history adjustments active</span>
      )}
    </span>
  );
}
