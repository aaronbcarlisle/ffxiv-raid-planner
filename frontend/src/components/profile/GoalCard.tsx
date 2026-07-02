import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, Check } from 'lucide-react';
import { IconButton } from '../primitives/IconButton';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useModal } from '../../hooks/useModal';
import { GoalStatusBadge } from './GoalStatusBadge';
import { GoalIntentBadge } from './GoalIntentBadge';
import type { PlayerGoal } from '../../stores/playerProfileStore';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import { toast } from '../../stores/toastStore';

const GOAL_TYPE_LABEL_KEYS: Record<string, string> = {
  collection: 'profile.goals.typeCollection',
  mount_farm: 'profile.goals.typeMountFarm',
  totem_farm: 'profile.goals.typeTotemFarm',
  weekly_clear: 'profile.goals.typeWeeklyClear',
  personal: 'profile.goals.typePersonal',
  gear: 'profile.goals.typeGear',
  raid: 'profile.goals.typeRaid',
  custom: 'profile.goals.typeCustom',
};

interface GoalCardProps {
  goal: PlayerGoal;
  onEdit: (goal: PlayerGoal) => void;
}

export function GoalCard({ goal, onEdit }: GoalCardProps) {
  const { t, i18n } = useTranslation();
  const { updateGoal, deleteGoal } = usePlayerProfileStore();
  const deleteModal = useModal();
  const uiLocale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';

  const isCountBased = goal.targetCount !== null && goal.targetCount > 0;
  const progress = isCountBased ? Math.min(100, Math.round((goal.currentCount / goal.targetCount!) * 100)) : 0;
  const isCompleted = goal.status === 'completed';

  const handleToggleComplete = async () => {
    try {
      const newStatus = isCompleted ? 'active' : 'completed';
      await updateGoal(goal.id, { status: newStatus });
      toast.success(isCompleted ? t('profile.goals.goalReactivated') : t('profile.goals.goalCompleted'));
    } catch {
      toast.error(t('profile.goals.goalUpdateFailed'));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteGoal(goal.id);
      toast.success(t('profile.goals.goalDeleted'));
    } catch {
      toast.error(t('profile.goals.goalDeleteFailed'));
    }
  };

  const intentColor = goal.intentLevel === 'must_have'
    ? 'rgba(239,68,68,0.5)'
    : goal.intentLevel === 'nice_to_have'
      ? 'rgba(234,179,8,0.4)'
      : 'rgba(20,184,166,0.3)';

  return (
    <div className={`group relative bg-surface-raised rounded-lg border border-border-default overflow-hidden transition-all duration-150 ${isCompleted ? 'opacity-60' : 'hover:border-border-hover hover:shadow-sm'}`}>
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: isCompleted ? 'rgba(255,255,255,0.06)' : intentColor }} />

      <div className="flex items-center gap-3 px-4 py-3 pl-5">
        {/* design-system-ignore: Custom circle checkbox for goal completion */}
        <button
          type="button"
          onClick={handleToggleComplete}
          className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
            isCompleted
              ? 'bg-status-success border-status-success'
              : 'border-border-hover hover:border-accent bg-transparent'
          }`}
          aria-label={isCompleted ? t('profile.goals.markAsActive') : t('profile.goals.markAsCompleted')}
        >
          {isCompleted && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
          <span className={`font-display font-semibold text-sm leading-snug ${isCompleted ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
            {goal.title}
          </span>

          <span className="text-[10px] font-medium text-text-muted bg-surface-elevated border border-border-subtle rounded px-1.5 py-0.5 leading-none flex-shrink-0">
            {t(GOAL_TYPE_LABEL_KEYS[goal.goalType] ?? '', { defaultValue: goal.goalType })}
          </span>

          <GoalStatusBadge status={goal.status} />
          <GoalIntentBadge intentLevel={goal.intentLevel} />

          {goal.isPublic && (
            <span className="text-[10px] font-medium text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5 leading-none flex-shrink-0">
              {t('profile.goals.shared')}
            </span>
          )}

          {(goal.sourceContent || goal.sourceItem) && (
            <span className="text-xs text-text-muted truncate hidden sm:inline">
              {[goal.sourceContent, goal.sourceItem].filter(Boolean).join(' — ')}
            </span>
          )}

          {goal.dueDate && (
            <span className="text-[10px] text-text-tertiary flex-shrink-0">
              {t('profile.goals.dueDate', { date: new Date(goal.dueDate).toLocaleDateString(uiLocale) })}
            </span>
          )}
        </div>

        {isCountBased && (
          <div className="flex-shrink-0 flex items-center gap-2 hidden sm:flex">
            <div className="w-20 h-1.5 bg-surface-base rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-status-success' : 'bg-accent'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-text-muted tabular-nums w-8 text-right">{progress}%</span>
          </div>
        )}

        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <IconButton
            icon={<Pencil className="w-3 h-3" />}
            aria-label={t('profile.goals.editGoal')}
            variant="ghost"
            size="sm"
            onClick={() => onEdit(goal)}
          />
          <IconButton
            icon={<Trash2 className="w-3 h-3" />}
            aria-label={t('profile.goals.deleteGoal')}
            variant="ghost"
            size="sm"
            onClick={deleteModal.open}
          />
        </div>
      </div>

      {deleteModal.isOpen && (
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          title={t('profile.goals.deleteGoalTitle')}
          message={t('profile.goals.deleteGoalMessage', { title: goal.title })}
          confirmLabel={t('common.delete')}
          variant="danger"
          onConfirm={handleDelete}
          onCancel={deleteModal.close}
        />
      )}
    </div>
  );
}
