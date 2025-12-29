/**
 * Delete Tier Modal
 *
 * Confirmation modal for deleting a tier snapshot.
 */

import { useTierStore } from '../../stores/tierStore';
import { getTierById } from '../../gamedata';

interface DeleteTierModalProps {
  groupId: string;
  tierId: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteTierModal({ groupId, tierId, onClose, onDeleted }: DeleteTierModalProps) {
  const { deleteTier, isSaving } = useTierStore();
  const tierInfo = getTierById(tierId);

  const handleDelete = async () => {
    try {
      await deleteTier(groupId, tierId);
      onDeleted();
      onClose();
    } catch {
      // Error handled in store
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/80 backdrop-blur-sm">
      <div className="bg-surface-card rounded-lg border border-border-default p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-display text-red-400 mb-4">Delete Tier</h2>

        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
          <p className="text-text-secondary">
            Are you sure you want to delete <strong className="text-text-primary">{tierInfo?.name || tierId}</strong>?
            This will remove all player data for this tier.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isSaving}
            className="bg-red-500 text-white px-4 py-2 rounded font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Deleting...' : 'Delete Tier'}
          </button>
        </div>
      </div>
    </div>
  );
}
