/**
 * Create Tier Modal
 *
 * Modal for creating a new tier snapshot in a static group.
 */

import { useState } from 'react';
import { useTierStore } from '../../stores/tierStore';
import { RAID_TIERS } from '../../gamedata';

interface CreateTierModalProps {
  groupId: string;
  existingTierIds: string[];
  onClose: () => void;
}

export function CreateTierModal({ groupId, existingTierIds, onClose }: CreateTierModalProps) {
  const { createTier, isSaving } = useTierStore();
  const [selectedTierId, setSelectedTierId] = useState('');

  const availableTiers = RAID_TIERS.filter(t => !existingTierIds.includes(t.id));

  const handleCreate = async () => {
    if (!selectedTierId) return;

    try {
      await createTier(groupId, selectedTierId);
      onClose();
    } catch {
      // Error handled in store
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-card rounded-lg border border-white/10 p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-display text-accent mb-4">Create New Tier</h2>

        <div className="mb-4">
          <label className="block text-sm text-text-secondary mb-2">
            Select Raid Tier
          </label>
          <select
            value={selectedTierId}
            onChange={(e) => setSelectedTierId(e.target.value)}
            className="w-full bg-bg-primary border border-white/10 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">Choose a tier...</option>
            {availableTiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name} ({tier.shortName})
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedTierId || isSaving}
            className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
