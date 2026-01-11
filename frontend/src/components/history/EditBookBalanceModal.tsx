/**
 * Edit Book Balance Modal
 *
 * Modal for manually adjusting a player's book balance.
 */

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Modal, Label, TextArea } from '../ui';
import { NumberInput } from '../ui/NumberInput';
import { Button } from '../primitives';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Edit {bookLabel}
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-sm text-text-secondary">
          Adjusting {bookLabel} balance for <span className="font-medium text-text-primary">{playerName}</span>
        </div>

        {/* Current and New Balance */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Current</Label>
            <NumberInput
              value={currentBalance}
              onChange={() => {}}
              disabled
              showButtons={false}
              size="sm"
              className="opacity-60"
            />
          </div>
          <div>
            <Label htmlFor="newBalance">New Balance</Label>
            <NumberInput
              value={newBalance}
              onChange={(val) => setNewBalance(val ?? 0)}
              showButtons={false}
              size="sm"
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
          <Label htmlFor="notes">Notes (optional)</Label>
          <TextArea
            value={notes}
            onChange={setNotes}
            placeholder="e.g., Correction for missed clear"
            rows={2}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={adjustment === 0}
            loading={isSaving}
          >
            {adjustment === 0 ? 'No Change' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
