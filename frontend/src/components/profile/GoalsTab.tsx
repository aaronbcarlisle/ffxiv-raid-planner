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
    <div>
      {personalGoals.length === 0 ? (
        <div className="text-center py-12 bg-surface-raised rounded-lg border border-border-default">
          <div className="mb-3 text-accent"><GameIcon name="checklist" size="xl" /></div>
          <h3 className="text-lg font-display font-semibold text-text-primary mb-1">
            No personal goals yet
          </h3>
          <p className="text-text-secondary mb-4">
            Track gear objectives, raid goals, personal checklists, and more.
          </p>
          <Button onClick={addModal.open}>Add Goal</Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={FILTER_OPTIONS}
              className="w-36"
            />
            <Button variant="secondary" onClick={addModal.open}>
              Add Goal
            </Button>
          </div>

          <motion.div {...staggerContainerProps} className="space-y-3">
            {filteredGoals.map((goal) => (
              <motion.div key={goal.id} {...staggerItemProps}>
                <GoalCard goal={goal} onEdit={setEditingGoal} />
              </motion.div>
            ))}
            {filteredGoals.length === 0 && (
              <div className="text-center py-8 text-text-secondary">
                No {statusFilter} personal goals.
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
