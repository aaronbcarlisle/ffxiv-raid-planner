/**
 * Delete Loot Confirm Modal
 *
 * Confirmation modal for deleting loot entries with option to revert gear.
 */

import { useState } from 'react';
import { Modal, Checkbox } from '../ui';
import { Button } from '../primitives';
import type { LootLogEntry } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';

interface DeleteLootConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (revertGear: boolean) => Promise<void>;
  entry: LootLogEntry;
  playerName: string;
}

export function DeleteLootConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  entry,
  playerName,
}: DeleteLootConfirmModalProps) {
  const [revertGear, setRevertGear] = useState(entry.method === 'drop');
  const [isDeleting, setIsDeleting] = useState(false);

  const slotName = GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] || entry.itemSlot;
  const isDrop = entry.method === 'drop';

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(revertGear);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Loot Entry">
      <div className="space-y-4">
        {/* Entry info */}
        <div className="bg-surface-base rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Floor:</span>
            <span className="text-text-primary font-medium">{entry.floor}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Item:</span>
            <span className="text-text-primary font-medium">{slotName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Recipient:</span>
            <span className="text-text-primary font-medium">{playerName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Method:</span>
            <span className={`font-medium ${
              entry.method === 'drop' ? 'text-status-success' :
              entry.method === 'book' ? 'text-status-warning' : 'text-accent'
            }`}>
              {entry.method}
            </span>
          </div>
        </div>

        {/* Revert gear option - only for drops */}
        {isDrop && (
          <Checkbox
            checked={revertGear}
            onChange={setRevertGear}
            label={`Also uncheck ${slotName.toLowerCase()} as acquired for ${playerName}`}
          />
        )}

        {/* Preview */}
        <div className="bg-status-error/10 border border-status-error/30 rounded-lg p-3 text-sm">
          <div className="text-status-error font-medium mb-1">This will:</div>
          <ul className="text-text-secondary space-y-1">
            <li>- Remove {slotName} from Week {entry.weekNumber} loot log</li>
            {isDrop && revertGear && (
              <li>- Uncheck {slotName} on {playerName}'s player card</li>
            )}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            loading={isDeleting}
          >
            Delete Entry
          </Button>
        </div>
      </div>
    </Modal>
  );
}
