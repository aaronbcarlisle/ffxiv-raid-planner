import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Button } from '../primitives/Button';
import { Select } from '../ui/Select';
import { GoalCard } from './GoalCard';
import { GoalModal } from './GoalModal';
import { useModal } from '../../hooks/useModal';
import type { PlayerGoal } from '../../stores/playerProfileStore';
import { PERSONAL_GOAL_TYPES } from '../../stores/playerProfileStore';
import { staggerContainerProps, staggerItemProps } from '../../lib/motion';
import { GameIcon } from '../ui/GameIcon';

interface GoalsTabProps {
  goals: PlayerGoal[];
}

export function GoalsTab({ goals }: GoalsTabProps) {
  const { t } = useTranslation();
  const addModal = useModal();
  const [editingGoal, setEditingGoal] = useState<PlayerGoal | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const statusLabels: Record<string, string> = {
    all: t('common.all'),
    active: t('profile.goals.statusActive'),
    completed: t('profile.goals.statusCompleted'),
    paused: t('profile.goals.statusPaused'),
  };
  const filterOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));

  const personalGoals = goals.filter((g) => PERSONAL_GOAL_TYPES.includes(g.goalType as never));
  const filteredGoals = statusFilter === 'all'
    ? personalGoals
    : personalGoals.filter((g) => g.status === statusFilter);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4 pt-2 pb-3 border-t border-border-subtle">
        <div>
          <h3 className="font-display text-base font-semibold text-text-primary">{t('profile.goals.title')}</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            {t('profile.goals.desc')}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={addModal.open}>{t('profile.goals.addTask')}</Button>
      </div>

      {personalGoals.length === 0 ? (
        <div className="text-center py-10 rounded-lg border border-border-subtle bg-surface-raised/40">
          <div className="mb-2 text-accent"><GameIcon name="checklist" size="xl" /></div>
          <h3 className="text-base font-display font-semibold text-text-primary mb-1">{t('profile.goals.noTasksYet')}</h3>
          <p className="text-sm text-text-secondary">{t('profile.goals.noTasksDesc')}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={filterOptions}
              className="w-36"
            />
          </div>

          <motion.div {...staggerContainerProps} className="space-y-3">
            {filteredGoals.map((goal) => (
              <motion.div key={goal.id} {...staggerItemProps}>
                <GoalCard goal={goal} onEdit={setEditingGoal} />
              </motion.div>
            ))}
            {filteredGoals.length === 0 && (
              <div className="text-center py-8 text-text-secondary text-sm">
                {t('profile.goals.noTasksForStatus', { status: statusLabels[statusFilter] ?? statusFilter })}
              </div>
            )}
          </motion.div>
        </>
      )}

      {addModal.isOpen && (
        <GoalModal
          defaultGoalType="personal"
          onClose={addModal.close}
        />
      )}
      {editingGoal && (
        <GoalModal
          existing={editingGoal}
          onClose={() => setEditingGoal(null)}
        />
      )}
    </div>
  );
}
