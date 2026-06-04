import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../primitives/Button';
import { Select } from '../ui/Select';
import { GoalCard } from './GoalCard';
import { GoalModal } from './GoalModal';
import { useModal } from '../../hooks/useModal';
import type { PlayerGoal } from '../../stores/playerProfileStore';
import { COLLECTION_GOAL_TYPES } from '../../stores/playerProfileStore';
import { staggerContainerProps, staggerItemProps } from '../../lib/motion';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' },
];

interface CollectionsTabProps {
  goals: PlayerGoal[];
}

export function CollectionsTab({ goals }: CollectionsTabProps) {
  const addModal = useModal();
  const [editingGoal, setEditingGoal] = useState<PlayerGoal | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const collectionGoals = goals.filter((g) => COLLECTION_GOAL_TYPES.includes(g.goalType as never));
  const filteredGoals = statusFilter === 'all'
    ? collectionGoals
    : collectionGoals.filter((g) => g.status === statusFilter);

  return (
    <div>
      {collectionGoals.length === 0 ? (
        <div className="text-center py-12 bg-surface-raised rounded-lg border border-border-default">
          <div className="text-4xl mb-3">&#127942;</div>
          <h3 className="text-lg font-display font-semibold text-text-primary mb-1">
            No collection goals yet
          </h3>
          <p className="text-text-secondary mb-4">
            Track mount farms, totem progress, weekly clears, and other collection goals.
          </p>
          <Button onClick={addModal.open}>Add Collection Goal</Button>
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
                No {statusFilter} collection goals.
              </div>
            )}
          </motion.div>
        </>
      )}

      {addModal.isOpen && (
        <GoalModal
          defaultGoalType="mount_farm"
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
