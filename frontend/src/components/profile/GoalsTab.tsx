import { useState } from 'react';
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

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' },
];

interface GoalsTabProps {
  goals: PlayerGoal[];
}

export function GoalsTab({ goals }: GoalsTabProps) {
  const addModal = useModal();
  const [editingGoal, setEditingGoal] = useState<PlayerGoal | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const personalGoals = goals.filter((g) => PERSONAL_GOAL_TYPES.includes(g.goalType as never));
  const filteredGoals = statusFilter === 'all'
    ? personalGoals
    : personalGoals.filter((g) => g.status === statusFilter);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4 pt-2 pb-3 border-t border-border-subtle">
        <div>
          <h3 className="font-display text-base font-semibold text-text-primary">Tasks & Goals</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            Track gearing, clears, raid prep, reminders, or custom tasks.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={addModal.open}>Add Task</Button>
      </div>

      {personalGoals.length === 0 ? (
        <div className="text-center py-10 rounded-lg border border-border-subtle bg-surface-raised/40">
          <div className="mb-2 text-accent"><GameIcon name="checklist" size="xl" /></div>
          <h3 className="text-base font-display font-semibold text-text-primary mb-1">No tasks yet</h3>
          <p className="text-sm text-text-secondary">Add a task to track gearing, clears, or raid prep goals.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={FILTER_OPTIONS}
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
                No {statusFilter} tasks.
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
