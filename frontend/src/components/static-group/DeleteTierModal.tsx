/**
 * Delete Tier Modal
 *
 * Confirmation modal for deleting a tier snapshot.
 */

import { Trash2 } from 'lucide-react';
import { Modal } from '../ui';
import { Button } from '../primitives';
import { useTierStore } from '../../stores/tierStore';
import { getTierById } from '../../gamedata';
import { toast } from '../../stores/toastStore';

interface DeleteTierModalProps {
  groupId: string;
  tierSnapshotId: string; // UUID for API call
  tierId: string; // Tier slug for display (e.g., 'aac-heavyweight')
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteTierModal({ groupId, tierSnapshotId, tierId, onClose, onDeleted }: DeleteTierModalProps) {
  const { deleteTier, isSaving } = useTierStore();
  const tierInfo = getTierById(tierId);
  const tierName = tierInfo?.name || tierId;

  const handleDelete = async () => {
    try {
      await deleteTier(groupId, tierSnapshotId);
      toast.success(`${tierName} deleted successfully`);
      onDeleted();
      onClose();
    } catch {
      toast.error(`Failed to delete ${tierName}`);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-status-error" />
          Delete Tier
        </span>
      }
    >
      <div className="space-y-4">
        <div className="p-3 bg-status-error/10 border border-status-error/30 rounded">
          <p className="text-text-secondary">
            Are you sure you want to delete <strong className="text-text-primary">{tierInfo?.name || tierId}</strong>?
            This will remove all player data for this tier.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            loading={isSaving}
          >
            Delete Tier
          </Button>
        </div>
      </div>
    </Modal>
  );
}
