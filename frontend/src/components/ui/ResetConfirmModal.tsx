/**
 * ResetConfirmModal - Type-to-confirm destructive reset modal
 *
 * Requires user to type "RESET" to enable the confirm button.
 * Used for dangerous bulk delete operations.
 */

import { useState, useEffect } from 'react';
import { Modal } from './Modal';

export type ResetType = 'loot' | 'books' | 'all';

interface ResetConfirmModalProps {
  isOpen: boolean;
  resetType: ResetType;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const RESET_DESCRIPTIONS: Record<ResetType, string> = {
  loot: 'all loot log entries',
  books: 'all book balances',
  all: 'all loot log entries AND book balances',
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
      title="Confirm Reset"
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
          <label htmlFor="reset-confirm" className="block text-sm text-text-secondary">
            Type <span className="font-mono font-bold text-text-primary">RESET</span> to confirm:
          </label>
          <input
            id="reset-confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type RESET"
            className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg
                       text-text-primary placeholder-text-muted focus:outline-none focus:ring-2
                       focus:ring-status-error/50 focus:border-status-error"
            autoComplete="off"
            disabled={isResetting}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isResetting}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-interactive
                       rounded-lg hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              canConfirm
                ? 'bg-status-error text-white hover:bg-status-error/90'
                : 'bg-status-error/30 text-status-error/50 cursor-not-allowed'
            }`}
          >
            {isResetting ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Resetting...
              </span>
            ) : (
              'Reset'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
