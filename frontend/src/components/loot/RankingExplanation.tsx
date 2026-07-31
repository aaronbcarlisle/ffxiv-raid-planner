/**
 * RankingExplanation — Phase D R-6's one presentation for "why is this ranked
 * here" (D-29's reasons/warnings layer; D-25's score breakdown lives in the
 * sibling `ScoreBreakdown` leaf (D3) — this module stays reasons/warnings/
 * confidence). Renders a CandidateExplanation: the ranking's reason line, plus the
 * record cross-check warnings when the consumer opts in — R-6 rules warnings
 * as the PICKER's layered extra, so surfacing them elsewhere (D3's queue rows
 * / matrix cells) is that slice's decision, not this component's default.
 */
import { AlertTriangle } from 'lucide-react';
import type { CandidateExplanation } from '../../utils/rankingExplanation';

export function RankingExplanation({
  explanation,
  showWarnings = false,
}: {
  explanation: CandidateExplanation;
  showWarnings?: boolean;
}) {
  return (
    <span className="block min-w-0">
      {explanation.reasons.map((r) => (
        <span key={r} className="block truncate text-xs text-text-tertiary">{r}</span>
      ))}
      {showWarnings && explanation.warnings.map((w) => (
        <span key={w} className="flex items-start gap-1 text-xs text-status-warning">
          <AlertTriangle aria-hidden className="mt-0.5 h-3 w-3 flex-none" />
          {w}
        </span>
      ))}
    </span>
  );
}
