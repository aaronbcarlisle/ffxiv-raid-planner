/**
 * Edit Book Balance Modal
 *
 * Modal for manually adjusting a player's book balance.
 */

import { useState } from 'react';
import { Modal } from '../ui/Modal';

interface EditBookBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (adjustment: number, notes?: string) => Promise<void>;
  playerName: string;
  bookType: string; // I, II, III, IV
  currentBalance: number;
}

export function EditBookBalanceModal({
  isOpen,
  onClose,
  onSubmit,
  playerName,
  bookType,
  currentBalance,
}: EditBookBalanceModalProps) {
  const [newBalance, setNewBalance] = useState(currentBalance);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const adjustment = newBalance - currentBalance;
  const bookLabel = `Book ${bookType}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (adjustment === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit(adjustment, notes || undefined);
      onClose();
    } catch {
      // Error handled by caller
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${bookLabel}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-sm text-text-secondary">
          Adjusting {bookLabel} balance for <span className="font-medium text-text-primary">{playerName}</span>
        </div>

        {/* Current and New Balance */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Current</label>
            <div className="px-3 py-2 rounded bg-surface-elevated border border-border-default text-text-primary text-center font-medium">
              {currentBalance}
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">New Balance</label>
            <input
              type="number"
              value={newBalance}
              onChange={(e) => setNewBalance(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary text-center focus:border-accent focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Adjustment Preview */}
        {adjustment !== 0 && (
          <div className={`text-sm text-center py-2 rounded ${
            adjustment > 0
              ? 'bg-status-success/10 text-status-success'
              : 'bg-status-error/10 text-status-error'
          }`}>
            {adjustment > 0 ? '+' : ''}{adjustment} adjustment
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Correction for missed clear"
            className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-surface-interactive text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={adjustment === 0 || isSaving}
            className="px-4 py-2 rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : adjustment === 0 ? 'No Change' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
