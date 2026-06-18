import { Info, AlertTriangle, AlertOctagon, X, Wand2 } from 'lucide-react';
import type { SnapshotPlayer } from '../../types';
import type { SplitClearData } from '../../types';
import type { SplitClearDraft } from '../../utils/splitClearSuggestionService';
import { getSplitChangeSummary } from '../../utils/splitClearSuggestionService';
import {
  TONE_CHIP_CLASS,
  formatConfidenceLabel,
  formatChangeSummary,
  formatRelativeTime,
  getConfidenceTone,
} from '../../utils/splitClearHelpers';
import { Badge, Button } from '../primitives';
import { SplitClearRunPanel } from './SplitClearRunPanel';

// ── Source chip ────────────────────────────────────────────────────────────────

function SourceChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        active ? TONE_CHIP_CLASS.success : TONE_CHIP_CLASS.neutral
      }`}
    >
      {label}
    </span>
  );
}

// ── Issue computation ──────────────────────────────────────────────────────────

interface DraftIssue {
  message: string;
  severity: 'info' | 'warning' | 'blocking';
}

function computeIssues(draft: SplitClearDraft, players: SnapshotPlayer[]): DraftIssue[] {
  const issues: DraftIssue[] = [];

  const noMainNames = draft.assignments
    .filter(a => !a.mainCharacterName)
    .map(a => players.find(p => p.id === a.playerId)?.name ?? 'Unknown');

  for (const name of noMainNames) {
    issues.push({ message: `${name} needs a main character — fill in on the board`, severity: 'warning' });
  }

  const noAltCount = draft.assignments.filter(a => !a.altCharacterName).length;
  if (noAltCount > 0) {
    issues.push({
      message: `${noAltCount} player${noAltCount !== 1 ? 's' : ''}: No alt character assigned — set after applying or skip for now`,
      severity: 'info',
    });
  }

  const noPriorityCount = players.filter(p => !(p.weaponPriorities?.length)).length;
  if (noPriorityCount > 0 && noPriorityCount < players.length) {
    issues.push({
      message: `Weapon priority missing for ${noPriorityCount} player${noPriorityCount !== 1 ? 's' : ''} — loot targets set to Normal loot`,
      severity: 'info',
    });
  }

  return issues;
}

const ISSUE_ICON: Record<DraftIssue['severity'], React.ReactElement> = {
  blocking: <AlertOctagon className="h-3 w-3 text-status-error mt-0.5 shrink-0" aria-hidden="true" />,
  warning:  <AlertTriangle className="h-3 w-3 text-status-warning mt-0.5 shrink-0" aria-hidden="true" />,
  info:     <Info          className="h-3 w-3 text-status-info mt-0.5 shrink-0"    aria-hidden="true" />,
};

// ── Main component ─────────────────────────────────────────────────────────────

interface SplitClearDraftReviewProps {
  draft: SplitClearDraft;
  players: SnapshotPlayer[];
  data: SplitClearData;
  isSaving: boolean;
  onDismiss: () => void;
  onApply: () => void;
  onRegenerate: () => void;
}

export function SplitClearDraftReview({
  draft,
  players,
  data,
  isSaving,
  onDismiss,
  onApply,
  onRegenerate,
}: SplitClearDraftReviewProps) {
  const issues = computeIssues(draft, players);
  const changeSummary = getSplitChangeSummary(draft, data.assignments);
  const confidenceTone = getConfidenceTone(draft.confidence);
  const badgeVariant: 'success' | 'warning' = confidenceTone === 'success' ? 'success' : 'warning';

  const willOverwrite =
    changeSummary.totalAffected > 0 &&
    data.assignments.some(
      a => a.mainCharacterName || a.altCharacterName || a.runACharacter || a.runBCharacter,
    );

  return (
    <div
      className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-4"
      data-testid="split-clear-draft-panel"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Suggested Split Plan</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Review Run A / Run B assignments before applying.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={badgeVariant} size="sm">
            {formatConfidenceLabel(draft.confidence)}
          </Badge>
          <span className="text-[11px] text-text-muted">
            {formatRelativeTime(draft.generatedAt)}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close draft panel"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Source strip */}
      <div className="flex flex-wrap gap-1.5" aria-label="Data sources used for this draft">
        <SourceChip
          label={`Roster ${draft.sourceSummary.rosterCount}/${draft.sourceSummary.rosterCount}`}
          active
        />
        <SourceChip
          label={`Alts ${draft.sourceSummary.altCount}/${draft.sourceSummary.rosterCount}`}
          active={draft.sourceSummary.altCount === draft.sourceSummary.rosterCount}
        />
        <SourceChip
          label={`Priority ${draft.sourceSummary.priorityCount > 0 ? '✓' : '—'}`}
          active={draft.sourceSummary.priorityCount > 0}
        />
        <SourceChip label="Loot log —" active={false} />
        <SourceChip label="Plugin —" active={false} />
      </div>

      {/* Run A / Run B panels — side by side on desktop, stacked on mobile */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SplitClearRunPanel run="A" assignments={draft.assignments} players={players} />
        <SplitClearRunPanel run="B" assignments={draft.assignments} players={players} />
      </div>

      {/* Issue summary */}
      {issues.length > 0 && (
        <div
          className="rounded-lg border border-status-warning/20 bg-status-warning/5 px-3 py-2.5 space-y-1.5"
          role="list"
          aria-label="Draft issues"
        >
          <p className="text-[11px] font-semibold text-status-warning">
            {issues.length} issue{issues.length !== 1 ? 's' : ''} to review before applying
          </p>
          {issues.map((issue, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[11px] text-text-secondary" role="listitem">
              {ISSUE_ICON[issue.severity]}
              {issue.message}
            </p>
          ))}
        </div>
      )}

      {/* Apply bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-base px-3 py-2.5">
        <p className="text-[11px] text-text-muted flex-1 min-w-0">
          {changeSummary.totalAffected === 0
            ? 'No changes detected.'
            : formatChangeSummary(changeSummary)}
          {willOverwrite && (
            <span className="text-status-warning"> Existing manual edits will be overwritten.</span>
          )}
        </p>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={<Wand2 className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={onRegenerate}
            disabled={isSaving}
            aria-label="Regenerate draft plan"
          >
            Regenerate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onDismiss}
          >
            Dismiss
          </Button>
          <Button
            type="button"
            size="sm"
            variant="accent"
            onClick={onApply}
            disabled={isSaving}
          >
            Apply draft
          </Button>
        </div>
      </div>
    </div>
  );
}
