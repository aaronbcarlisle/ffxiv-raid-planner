import { useEffect, useState } from 'react';
import { History, Loader2, Trash2 } from 'lucide-react';
import { IconButton } from '../primitives/IconButton';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { RewardDrop } from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';

interface DropHistoryPanelProps {
  groupId: string;
  goalId: string;
  currentUserId: string;
  /** Leads and owners may delete any drop; everyone else only the ones they logged. */
  canManage: boolean;
  /** Viewers delete nothing, not even a drop they logged before being demoted (the API refuses them). */
  isViewer: boolean;
}

const PRIOR_STATE_LABELS: Record<string, string> = { need: 'Need', want: 'Want' };

function formatDropDate(drop: RewardDrop): string {
  return new Date(drop.droppedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DropHistoryPanel({ groupId, goalId, currentUserId, canManage, isViewer }: DropHistoryPanelProps) {
  const { drops, dropsLoading, fetchDrops, deleteDrop } = useCollectionGoalStore();
  const [pendingDelete, setPendingDelete] = useState<RewardDrop | null>(null);

  useEffect(() => {
    fetchDrops(groupId, goalId);
  }, [groupId, goalId, fetchDrops]);

  const list = drops[goalId] ?? [];
  const loading = dropsLoading[goalId] ?? false;

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    const drop = pendingDelete;
    try {
      await deleteDrop(groupId, goalId, drop.id);
      toast.success('Drop deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete drop');
    } finally {
      setPendingDelete(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-text-muted">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading history…
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="py-8 text-center text-text-muted text-sm flex flex-col items-center gap-2">
        <History size={32} className="opacity-30" />
        No drops logged yet.
      </div>
    );
  }

  const priorLabel = pendingDelete?.recipientPriorState
    ? PRIOR_STATE_LABELS[pendingDelete.recipientPriorState] ?? null
    : null;
  const confirmMessage = pendingDelete && priorLabel
    ? `Delete this drop? ${pendingDelete.recipientDisplayName ?? 'The recipient'} goes back to ${priorLabel} if it was their only drop.`
    : 'Delete this drop?';

  return (
    <div className="flex flex-col gap-2">
      {list.map((drop) => {
        const dateStr = formatDropDate(drop);
        const canDelete = !isViewer && (canManage || drop.createdById === currentUserId);

        return (
          <div key={drop.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-base">
            <div className="flex-1 min-w-0">
              {drop.recipientDisplayName ? (
                <span className="text-sm text-text-primary font-medium">{drop.recipientDisplayName}</span>
              ) : (
                <span className="text-sm text-text-muted italic">No recipient</span>
              )}
              {drop.notes && (
                <p className="text-xs text-text-secondary mt-0.5 truncate">{drop.notes}</p>
              )}
            </div>
            {drop.quantity > 1 && (
              <span className="text-xs text-text-muted">×{drop.quantity}</span>
            )}
            <span className="text-xs text-text-muted flex-shrink-0">{dateStr}</span>
            {canDelete && (
              <IconButton
                icon={<Trash2 size={14} />}
                aria-label={`Delete drop: ${drop.recipientDisplayName ?? 'no recipient'} on ${dateStr}`}
                variant="danger"
                size="sm"
                onClick={() => setPendingDelete(drop)}
              />
            )}
          </div>
        );
      })}

      <ConfirmModal
        isOpen={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Drop"
        message={confirmMessage}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
