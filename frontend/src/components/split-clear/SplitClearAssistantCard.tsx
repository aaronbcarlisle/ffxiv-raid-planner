import { AlertTriangle, Info, RotateCcw, Scissors, Wand2 } from 'lucide-react';
import type { SnapshotPlayer } from '../../types';
import type { SplitClearData } from '../../types';
import type { SplitClearReadiness } from '../../utils/splitClear';
import type {
  DraftPlayerAssignment,
  SplitClearDraft,
} from '../../utils/splitClearSuggestionService';
import { getSplitChangeSummary } from '../../utils/splitClearSuggestionService';
import {
  TONE_CHIP_CLASS,
  formatChangeSummary,
  formatConfidenceLabel,
  formatLootTarget,
  formatRelativeTime,
  getRunSlotTone,
  formatRunSlot,
} from '../../utils/splitClearHelpers';
import { Badge, Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';

// ── Sub-components ─────────────────────────────────────────────────────────────

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

function RunSlotChip({ slot }: { slot: DraftPlayerAssignment['runACharacter'] }) {
  const tone = getRunSlotTone(slot);
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${TONE_CHIP_CLASS[tone]}`}>
      {formatRunSlot(slot)}
    </span>
  );
}

interface DraftRowProps {
  suggestion: DraftPlayerAssignment;
  player: SnapshotPlayer | undefined;
}

function DraftRow({ suggestion, player }: DraftRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-base px-3 py-2">
      <div className="flex items-center gap-2 w-32 shrink-0">
        {player?.job && <JobIcon job={player.job} size="sm" />}
        <span className="text-xs font-medium text-text-primary truncate">
          {player?.name ?? '—'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
        {suggestion.mainCharacterName ? (
          <span className="text-[11px] text-text-secondary">
            Main: <span className="text-text-primary">{suggestion.mainCharacterName}</span>
            {suggestion.mainCharacterWorld && (
              <span className="text-text-muted"> @ {suggestion.mainCharacterWorld}</span>
            )}
          </span>
        ) : (
          <span className="text-[11px] text-status-warning">Main: not set</span>
        )}

        <span className="text-[11px] text-text-muted">Run A:</span>
        <RunSlotChip slot={suggestion.runACharacter} />
        <span className="text-[11px] text-text-muted">Run B:</span>
        <RunSlotChip slot={suggestion.runBCharacter} />

        <span className="text-[11px] text-text-secondary">
          Loot:{' '}
          <span className="text-text-primary">{formatLootTarget(suggestion.lootTarget)}</span>
        </span>

        <span className="w-full text-[10px] text-text-muted italic">
          {suggestion.reasons[suggestion.reasons.length - 1]}
        </span>
      </div>

      <span
        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 self-start ${TONE_CHIP_CLASS.suggested}`}
        aria-label="Suggested by draft"
      >
        Suggested
      </span>
    </div>
  );
}

interface DraftIssue {
  player: string;
  message: string;
  severity: 'warning' | 'info';
}

function computeDraftIssues(
  assignments: DraftPlayerAssignment[],
  players: SnapshotPlayer[],
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  for (const a of assignments) {
    const name = players.find(p => p.id === a.playerId)?.name ?? 'Unknown player';
    if (!a.mainCharacterName) {
      issues.push({ player: name, message: 'No main character — fill in manually', severity: 'warning' });
    }
  }
  const noAltCount = assignments.filter(a => !a.altCharacterName).length;
  if (noAltCount > 0) {
    issues.push({
      player: `${noAltCount} player${noAltCount !== 1 ? 's' : ''}`,
      message: 'No alt character assigned — set after applying or skip for now',
      severity: 'info',
    });
  }
  return issues;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SplitClearAssistantCardProps {
  players: SnapshotPlayer[];
  data: SplitClearData;
  readiness: SplitClearReadiness;
  draft: SplitClearDraft | null;
  canEdit: boolean;
  isSaving: boolean;
  resetConfirm: boolean;
  onGenerateDraft: () => void;
  onDismissDraft: () => void;
  onApplyDraft: () => void;
  onResetWeek: () => void;
}

export function SplitClearAssistantCard({
  players,
  data,
  readiness,
  draft,
  canEdit,
  isSaving,
  resetConfirm,
  onGenerateDraft,
  onDismissDraft,
  onApplyDraft,
  onResetWeek,
}: SplitClearAssistantCardProps) {
  const hasDraft = draft !== null;
  const changeSummary = hasDraft ? getSplitChangeSummary(draft, data.assignments) : null;
  const draftIssues = hasDraft ? computeDraftIssues(draft.assignments, players) : [];

  return (
    <div
      className={`rounded-xl border p-4 space-y-4 transition-colors ${
        hasDraft
          ? 'border-accent/30 bg-accent/5'
          : 'border-border-subtle bg-surface-raised'
      }`}
    >
      {/* Plan header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Scissors className="h-5 w-5 text-accent flex-shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Split Clear Planner</h2>
            <p className="text-xs text-text-muted">
              Plan main/alt runs and loot targets for split clears.
            </p>
          </div>
        </div>

        <p className="text-xs text-text-muted shrink-0 tabular-nums">
          {readiness.altCount}/{readiness.memberCount} with alts
          {readiness.issueMemberCount > 0 &&
            ` · ${readiness.issueMemberCount} issue${readiness.issueMemberCount !== 1 ? 's' : ''}`}
        </p>

        {canEdit && (
          <div className="flex gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="accent-subtle"
              leftIcon={<Wand2 className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={onGenerateDraft}
              disabled={isSaving}
              aria-label={hasDraft ? 'Regenerate draft plan' : 'Generate draft plan'}
            >
              {hasDraft ? 'Regenerate' : 'Generate draft'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={onResetWeek}
              disabled={isSaving}
            >
              {resetConfirm ? 'Confirm reset?' : 'Reset week'}
            </Button>
          </div>
        )}
      </div>

      {/* Draft content — only rendered when a draft exists */}
      {draft && (
        <div className="space-y-3" data-testid="split-clear-draft-panel">
          {/* Source + confidence strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-base border border-border-subtle px-3 py-2">
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

            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={
                  draft.confidence === 'high'
                    ? 'success'
                    : draft.confidence === 'medium'
                      ? 'warning'
                      : 'error'
                }
                size="sm"
              >
                {formatConfidenceLabel(draft.confidence)}
              </Badge>
              <span className="text-[11px] text-text-muted">
                {formatRelativeTime(draft.generatedAt)}
              </span>
            </div>
          </div>

          {/* Per-player suggestion rows */}
          <div className="space-y-1.5">
            {draft.assignments.map(suggestion => (
              <DraftRow
                key={suggestion.playerId}
                suggestion={suggestion}
                player={players.find(p => p.id === suggestion.playerId)}
              />
            ))}
          </div>

          {/* Issue list */}
          {draftIssues.length > 0 && (
            <div
              className="rounded-lg border border-status-warning/30 bg-status-warning/5 px-3 py-2 space-y-1.5"
              role="list"
              aria-label="Draft issues"
            >
              <p className="text-[11px] font-semibold text-status-warning">
                {draftIssues.length} issue{draftIssues.length !== 1 ? 's' : ''} to review before applying
              </p>
              {draftIssues.map((issue, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11px] text-text-secondary" role="listitem">
                  {issue.severity === 'warning' ? (
                    <AlertTriangle className="h-3 w-3 text-status-warning mt-0.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Info className="h-3 w-3 text-status-info mt-0.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    <span className="font-medium">{issue.player}:</span>{' '}
                    {issue.message}
                  </span>
                </p>
              ))}
            </div>
          )}

          {/* Apply bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-base px-3 py-2.5">
            <p className="text-[11px] text-text-muted">
              {changeSummary ? formatChangeSummary(changeSummary) : 'No changes detected.'}
              {' '}Existing manual edits will be overwritten.
            </p>
            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onDismissDraft}
              >
                Dismiss
              </Button>
              <Button
                type="button"
                size="sm"
                variant="accent-subtle"
                onClick={onApplyDraft}
                disabled={isSaving}
              >
                Apply draft
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
