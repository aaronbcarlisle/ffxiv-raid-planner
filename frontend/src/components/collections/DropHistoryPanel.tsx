import { useEffect } from 'react';
import { History, Loader2 } from 'lucide-react';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';

interface DropHistoryPanelProps {
  groupId: string;
  goalId: string;
}

export function DropHistoryPanel({ groupId, goalId }: DropHistoryPanelProps) {
  const { drops, dropsLoading, fetchDrops } = useCollectionGoalStore();

  useEffect(() => {
    fetchDrops(groupId, goalId);
  }, [groupId, goalId, fetchDrops]);

  const list = drops[goalId] ?? [];
  const loading = dropsLoading[goalId] ?? false;

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

  return (
    <div className="flex flex-col gap-2">
      {list.map((drop) => {
        const date = new Date(drop.droppedAt);
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

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
          </div>
        );
      })}
    </div>
  );
}
