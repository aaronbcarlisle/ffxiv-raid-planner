import { useState } from 'react';
import { Scissors, RotateCcw, Wand2 } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import type { SnapshotPlayer } from '../../types';
import { useSplitClearStore } from '../../stores/splitClearStore';
import { getSplitClearReadiness } from '../../utils/splitClear';
import {
  buildSplitClearDraft,
  type SplitClearDraft,
} from '../../utils/splitClearSuggestionService';
import { Button } from '../primitives';
import { SplitClearEmptyState } from './SplitClearEmptyState';
import { SplitClearDraftReview } from './SplitClearDraftReview';
import { SplitClearAssignmentBoard } from './SplitClearAssignmentBoard';

interface SplitClearPlannerProps {
  groupId: string;
  players: SnapshotPlayer[];
  canEdit: boolean;
}

export function SplitClearPlanner({ groupId, players, canEdit }: SplitClearPlannerProps) {
  const { data, isSaving, error, toggleMode, updateAssignment, resetWeek } = useSplitClearStore();
  const [resetConfirm, setResetConfirm] = useState(false);
  const [draft, setDraft] = useState<SplitClearDraft | null>(null);
  const [manualBoardOpen, setManualBoardOpen] = useState(false);

  if (!data) return null;
  if (!data.enabled && !canEdit) return null;

  // Mode OFF — lead/owner sees a compact enable CTA
  if (!data.enabled) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Scissors className="h-4 w-4 text-text-muted flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-text-primary">Split Clear Planner</p>
              <p className="text-xs text-text-muted">Optional main/alt planning for split-clear runs</p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="accent-subtle"
            onClick={() => void toggleMode(groupId, true)}
            disabled={isSaving}
          >
            Enable split planning
          </Button>
        </div>
      </div>
    );
  }

  // Mode ON — derive view state
  const assignmentMap = new Map(data.assignments.map(a => [a.snapshotPlayerId, a]));
  const readiness = getSplitClearReadiness(players, data.assignments);
  const hasExistingAssignments = data.assignments.length > 0;

  // Show board when: draft was just applied (manualBoardOpen), or saved assignments exist and no draft
  const showBoard = !draft && (manualBoardOpen || hasExistingAssignments);
  // Show empty state when: no draft, no board
  const showEmptyState = !draft && !showBoard;

  function handleReset() {
    if (!resetConfirm) {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 3000);
      return;
    }
    setResetConfirm(false);
    void resetWeek(groupId);
  }

  function handleGenerateDraft() {
    if (!data) return;
    setDraft(buildSplitClearDraft(players, data.assignments, data.playerCharacters));
  }

  async function handleApplyDraft() {
    if (!draft) return;
    await Promise.all(
      draft.assignments.map(a =>
        updateAssignment(groupId, a.playerId, {
          runACharacterLinkId: a.runACharacterLinkId,
          runBCharacterLinkId: a.runBCharacterLinkId,
          // Mirror resolved names into legacy text fields for backward compat rendering
          mainCharacterName: a.runACharacterName,
          mainCharacterWorld: a.runACharacterWorld,
          altCharacterName: a.runBCharacterName,
          altCharacterWorld: a.runBCharacterWorld,
          runACharacter: a.runACharacter,
          runBCharacter: a.runBCharacter,
          lootTarget: a.lootTarget,
          lootTargetJob: a.lootTargetJob,
        }),
      ),
    );
    setDraft(null);
    setManualBoardOpen(true); // Always open board after apply
  }

  return (
    <div className="space-y-3 mb-6">
      {/* ── Composer header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Scissors className="h-4 w-4 text-accent shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-text-primary">Split Clear Composer</span>
          <span className="text-xs text-text-muted tabular-nums">
            {readiness.altCount}/{readiness.memberCount} with alts
            {readiness.issueMemberCount > 0 &&
              ` · ${readiness.issueMemberCount} issue${readiness.issueMemberCount !== 1 ? 's' : ''}`}
          </span>
        </div>

        {canEdit && (
          <div className="flex gap-2 shrink-0">
            {/* Generate draft shown in header when board is open (no draft) */}
            {showBoard && (
              <Button
                type="button"
                size="sm"
                variant="accent-subtle"
                leftIcon={<Wand2 className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={handleGenerateDraft}
                disabled={isSaving}
                aria-label="Generate draft plan"
              >
                Generate draft
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={handleReset}
              disabled={isSaving}
            >
              {resetConfirm ? 'Confirm reset?' : 'Reset week'}
            </Button>
          </div>
        )}
      </div>

      {/* ── Draft Review (State 2) ── */}
      {draft && (
        <SplitClearDraftReview
          draft={draft}
          players={players}
          data={data}
          isSaving={isSaving}
          onDismiss={() => setDraft(null)}
          onApply={() => void handleApplyDraft()}
          onRegenerate={handleGenerateDraft}
        />
      )}

      {/* ── Empty / Compose State (State 1) ── */}
      {showEmptyState && (
        <SplitClearEmptyState
          players={players}
          data={data}
          canEdit={canEdit}
          isSaving={isSaving}
          onGenerateDraft={handleGenerateDraft}
          onStartManually={() => setManualBoardOpen(true)}
        />
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-xs text-status-error">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* ── Manual Assignment Board (State 3) ── */}
      {showBoard && (
        <SplitClearAssignmentBoard
          players={players}
          assignmentMap={assignmentMap}
          canEdit={canEdit}
          onUpdate={(playerId, update) => void updateAssignment(groupId, playerId, update)}
        />
      )}
    </div>
  );
}
