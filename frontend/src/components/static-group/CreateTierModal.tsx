/**
 * Create Tier Modal
 *
 * Modal for creating a new tier snapshot in a static group.
 */

import { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { Modal, Select, Label } from '../ui';
import { Button } from '../primitives';
import { useTierStore } from '../../stores/tierStore';
import { RAID_TIERS } from '../../gamedata';

interface CreateTierModalProps {
  groupId: string;
  existingTierIds: string[];
  onClose: () => void;
  onCreate?: () => void; // Called after successful tier creation
}

export function CreateTierModal({ groupId, existingTierIds, onClose, onCreate }: CreateTierModalProps) {
  const { createTier, isSaving } = useTierStore();
  const [selectedTierId, setSelectedTierId] = useState('');

  const availableTiers = RAID_TIERS.filter(t => !existingTierIds.includes(t.id));

  const handleCreate = async () => {
    if (!selectedTierId) return;

    try {
      await createTier(groupId, selectedTierId);
      onCreate?.();
      onClose();
    } catch {
      // Error handled in store
    }
  };

  // Build tier options for Select
  const tierOptions = [
    { value: '', label: 'Choose a tier...' },
    ...availableTiers.map((tier) => ({
      value: tier.id,
      label: `${tier.name} (${tier.shortName})`,
    })),
  ];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <FolderPlus className="w-5 h-5" />
          Create New Tier
        </span>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="tierSelect">Select Raid Tier</Label>
          <Select
            id="tierSelect"
            value={selectedTierId}
            onChange={setSelectedTierId}
            options={tierOptions}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedTierId}
            loading={isSaving}
          >
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}
