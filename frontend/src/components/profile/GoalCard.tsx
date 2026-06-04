import { Badge } from '../primitives/Badge';
import { IconButton } from '../primitives/IconButton';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useModal } from '../../hooks/useModal';
import { GoalStatusBadge } from './GoalStatusBadge';
import type { PlayerGoal } from '../../stores/playerProfileStore';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import { toast } from '../../stores/toastStore';

const GOAL_TYPE_LABELS: Record<string, string> = {
  collection: 'Collection',
  mount_farm: 'Mount Farm',
  totem_farm: 'Totem Farm',
  weekly_clear: 'Weekly Clear',
  personal: 'Personal',
  gear: 'Gear',
  raid: 'Raid',
  custom: 'Custom',
};

interface GoalCardProps {
  goal: PlayerGoal;
  onEdit: (goal: PlayerGoal) => void;
}

export function GoalCard({ goal, onEdit }: GoalCardProps) {
  const { updateGoal, deleteGoal } = usePlayerProfileStore();
  const deleteModal = useModal();

  const isCountBased = goal.targetCount !== null && goal.targetCount > 0;
  const progress = isCountBased ? Math.min(100, Math.round((goal.currentCount / goal.targetCount!) * 100)) : 0;
  const isCompleted = goal.status === 'completed';

  const handleToggleComplete = async () => {
    try {
      const newStatus = isCompleted ? 'active' : 'completed';
      await updateGoal(goal.id, { status: newStatus });
      toast.success(isCompleted ? 'Goal reactivated' : 'Goal completed!');
    } catch {
      toast.error('Failed to update goal');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteGoal(goal.id);
      toast.success('Goal deleted');
    } catch {
      toast.error('Failed to delete goal');
    }
  };

  return (
    <div className={`bg-surface-raised rounded-lg border border-border-default p-4 transition-colors ${isCompleted ? 'opacity-70' : 'hover:border-border-hover'}`}>
      <div className="flex items-start gap-3">
        {/* Toggle complete */}
        <div className="flex-shrink-0 mt-1">
          {/* design-system-ignore: Custom checkbox toggle for goal completion */}
          <button
            type="button"
            onClick={handleToggleComplete}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isCompleted
                ? 'bg-status-success border-status-success text-white'
                : 'border-border-default hover:border-accent bg-transparent'
            }`}
            aria-label={isCompleted ? 'Mark as active' : 'Mark as completed'}
          >
            {isCompleted && <span className="text-xs leading-none">&#10003;</span>}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-display font-semibold ${isCompleted ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
              {goal.title}
            </span>
            <Badge variant="default" size="sm">
              {GOAL_TYPE_LABELS[goal.goalType] ?? goal.goalType}
            </Badge>
            <GoalStatusBadge status={goal.status} />
          </div>

          {/* Source info */}
          {(goal.sourceContent || goal.sourceItem) && (
            <div className="text-sm text-text-secondary mt-1">
              {goal.sourceContent}
              {goal.sourceContent && goal.sourceItem && ' — '}
              {goal.sourceItem}
            </div>
          )}

          {/* Description */}
          {goal.description && (
            <div className="text-sm text-text-secondary mt-1 italic">
              {goal.description}
            </div>
          )}

          {/* Count progress bar */}
          {isCountBased && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                <span>{goal.currentCount} / {goal.targetCount}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-surface-base rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    progress >= 100 ? 'bg-status-success' : progress >= 75 ? 'bg-accent' : 'bg-status-info'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-2 text-xs text-text-tertiary flex-wrap">
            {goal.linkedJob && (
              <span>Job: {goal.linkedJob}</span>
            )}
            {goal.dueDate && (
              <span>Due: {new Date(goal.dueDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <IconButton
            icon="&#9998;"
            aria-label="Edit goal"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(goal)}
          />
          <IconButton
            icon="&times;"
            aria-label="Delete goal"
            variant="ghost"
            size="sm"
            onClick={deleteModal.open}
          />
        </div>
      </div>

      {deleteModal.isOpen && (
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          title="Delete Goal"
          message={`Delete "${goal.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={deleteModal.close}
        />
      )}
    </div>
  );
}
