import { useState } from 'react';
import { Scissors } from 'lucide-react';
import type { SnapshotPlayer } from '../../types';
import { useSplitClearStore } from '../../stores/splitClearStore';
import { getSplitClearReadiness } from '../../utils/splitClear';
import {
  buildSplitClearDraft,
  type SplitClearDraft,
} from '../../utils/splitClearSuggestionService';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../primitives';
import { SplitClearAssistantCard } from './SplitClearAssistantCard';
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

  if (!data) return null;

  // Hidden from read-only members when the feature isn't active.
  if (!data.enabled && !canEdit) return null;

  // Off-state: lead/owner sees an enable CTA.
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

  const assignmentMap = new Map(data.assignments.map(a => [a.snapshotPlayerId, a]));
  const readiness = getSplitClearReadiness(players, data.assignments);

  function handleReset() {
    if (!resetConfirm) {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 3000);
      return;
    }
    setResetConfirm(false);
    void resetWeek(groupId);
  }

  async function handleApplyDraft() {
    if (!draft) return;
    await Promise.all(
      draft.assignments.map(a =>
        updateAssignment(groupId, a.playerId, {
          mainCharacterName: a.mainCharacterName,
          mainCharacterWorld: a.mainCharacterWorld,
          altCharacterName: a.altCharacterName,
          altCharacterWorld: a.altCharacterWorld,
          runACharacter: a.runACharacter,
          runBCharacter: a.runBCharacter,
          lootTarget: a.lootTarget,
          lootTargetJob: a.lootTargetJob,
        }),
      ),
    );
    setDraft(null);
  }

  return (
    <div className="space-y-4 mb-6">
      <SplitClearAssistantCard
        players={players}
        data={data}
        readiness={readiness}
        draft={draft}
        canEdit={canEdit}
        isSaving={isSaving}
        resetConfirm={resetConfirm}
        onGenerateDraft={() => setDraft(buildSplitClearDraft(players, data.assignments))}
        onDismissDraft={() => setDraft(null)}
        onApplyDraft={() => void handleApplyDraft()}
        onResetWeek={handleReset}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-xs text-status-error">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <SplitClearAssignmentBoard
        players={players}
        assignmentMap={assignmentMap}
        canEdit={canEdit}
        onUpdate={(playerId, update) => void updateAssignment(groupId, playerId, update)}
      />
    </div>
  );
}
