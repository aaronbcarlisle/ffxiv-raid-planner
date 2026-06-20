import { useState } from 'react';
import { Edit2, Trash2, Users, History } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { ParticipantsPanel } from './ParticipantsPanel';
import { DropHistoryPanel } from './DropHistoryPanel';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { CollectionGoal, ParticipantState } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';

type DetailTab = 'who' | 'history';

interface RewardGoalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: CollectionGoal;
  groupId: string;
  currentUserId: string;
  canManage: boolean;
  onEdit: (goal: CollectionGoal) => void;
}

export function RewardGoalDetailModal({
  isOpen,
  onClose,
  goal,
  groupId,
  currentUserId,
  canManage,
  onEdit,
}: RewardGoalDetailModalProps) {
  const { upsertMyState, deleteGoal } = useCollectionGoalStore();
  const addToast = useToastStore((s) => s.addToast);

  const [tab, setTab] = useState<DetailTab>('who');
  const [showDelete, setShowDelete] = useState(false);

  async function handleSetMyState(state: ParticipantState) {
    try {
      await upsertMyState(groupId, goal.id, { state });
      addToast({ type: 'success', message: `Status set to "${state}"` });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to set status' });
    }
  }

  async function handleDelete() {
    try {
      await deleteGoal(groupId, goal.id);
      addToast({ type: 'success', message: 'Goal deleted.' });
      onClose();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to delete goal' });
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={goal.title}
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {/* Summary */}
          {goal.summary && (
            <p className="text-sm text-text-secondary">{goal.summary}</p>
          )}

          {/* Actions row */}
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <Button variant="ghost" size="sm" onClick={() => onEdit(goal)} className="flex items-center gap-1">
                  <Edit2 size={14} /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDelete(true)}
                  className="flex items-center gap-1 text-status-error hover:text-status-error"
                >
                  <Trash2 size={14} /> Delete
                </Button>
              </>
            )}
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 border-b border-border-default">
            {(['who', 'history'] as const).map((t) => (
              /* design-system-ignore: tab toggle inside modal */
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {t === 'who' ? <Users size={14} /> : <History size={14} />}
                {t === 'who' ? 'Who needs it?' : 'Drop history'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div>
            {tab === 'who' ? (
              <ParticipantsPanel
                groupId={groupId}
                goalId={goal.id}
                currentUserId={currentUserId}
                canManage={canManage}
                onSetMyState={handleSetMyState}
              />
            ) : (
              <DropHistoryPanel groupId={groupId} goalId={goal.id} />
            )}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Goal"
        message={`Delete "${goal.title}"? This will remove all participant states and drop history for this goal.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
