/**
 * ResetConfirmModal - Type-to-confirm destructive reset modal
 *
 * Requires user to type "RESET" to enable the confirm button.
 * Used for dangerous bulk delete operations.
 */

import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal } from './Modal';
import { Label } from './Label';
import { Input } from './Input';
import { Button } from '../primitives';

export type ResetType = 'loot' | 'books' | 'all';

interface ResetConfirmModalProps {
  isOpen: boolean;
  resetType: ResetType;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const RESET_DESCRIPTIONS: Record<ResetType, string> = {
  loot: 'loot log entries for the current week',
  books: 'book balances for all players',
  all: 'loot log entries (current week) AND all book balances',
};

export function ResetConfirmModal({
  isOpen,
  resetType,
  onConfirm,
  onCancel,
}: ResetConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Reset the confirm text when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmText('');
      setIsResetting(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (confirmText !== 'RESET') return;
    setIsResetting(true);
    try {
      await onConfirm();
    } finally {
      setIsResetting(false);
    }
  };

  const canConfirm = confirmText === 'RESET' && !isResetting;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={
        <span className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-status-error" />
          Confirm Reset
        </span>
      }
      size="md"
    >
      <div className="space-y-4">
        {/* Warning icon and message */}
        <div className="flex items-start gap-3 p-3 bg-status-error/10 rounded-lg border border-status-error/30">
          <svg className="w-6 h-6 text-status-error flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-status-error">This action cannot be undone</p>
            <p className="text-sm text-text-secondary mt-1">
              This will permanently delete {RESET_DESCRIPTIONS[resetType]} for this tier.
            </p>
          </div>
        </div>

        {/* Type to confirm */}
        <div className="space-y-2">
          <Label htmlFor="reset-confirm">
            Type <span className="font-mono font-bold text-text-primary">RESET</span> to confirm:
          </Label>
          <Input
            id="reset-confirm"
            value={confirmText}
            onChange={setConfirmText}
            placeholder="Type RESET"
            disabled={isResetting}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isResetting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={!canConfirm}
            loading={isResetting}
          >
            Reset
          </Button>
        </div>
      </div>
    </Modal>
  );
}
