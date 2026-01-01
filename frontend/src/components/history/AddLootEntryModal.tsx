/**
 * Add Loot Entry Modal
 *
 * Modal for logging a loot drop.
 */

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import type { LootLogEntryCreate, LootMethod, SnapshotPlayer } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';

interface AddLootEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (entry: LootLogEntryCreate) => Promise<void>;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
}

export function AddLootEntryModal({
  isOpen,
  onClose,
  onSubmit,
  players,
  floors,
  currentWeek,
}: AddLootEntryModalProps) {
  const [weekNumber, setWeekNumber] = useState(currentWeek || 1);
  const [floor, setFloor] = useState(floors[0] || '');
  const [itemSlot, setItemSlot] = useState<string>('weapon');
  const [recipientPlayerId, setRecipientPlayerId] = useState('');
  const [method, setMethod] = useState<LootMethod>('drop');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientPlayerId) {
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        weekNumber,
        floor,
        itemSlot,
        recipientPlayerId,
        method,
        notes: notes || undefined,
      });

      // Reset form
      setWeekNumber(currentWeek);
      setFloor(floors[0] || '');
      setItemSlot('weapon');
      setRecipientPlayerId('');
      setMethod('drop');
      setNotes('');

      onClose();
    } catch (error) {
      // Error handled by store
    } finally {
      setIsSaving(false);
    }
  };

  const configuredPlayers = players.filter((p) => p.configured);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Loot Drop">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Week and Floor */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Week</label>
            <input
              type="number"
              min={1}
              value={weekNumber}
              onChange={(e) => setWeekNumber(Number(e.target.value))}
              className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Floor</label>
            <select
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none"
            >
              {floors.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Item Slot */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Item Slot</label>
          <select
            value={itemSlot}
            onChange={(e) => setItemSlot(e.target.value)}
            className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none"
          >
            {Object.entries(GEAR_SLOT_NAMES).map(([slot, name]) => (
              <option key={slot} value={slot}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Recipient */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Recipient</label>
          <select
            value={recipientPlayerId}
            onChange={(e) => setRecipientPlayerId(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="">Select player...</option>
            {configuredPlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} ({player.job})
              </option>
            ))}
          </select>
        </div>

        {/* Method */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Method</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="drop"
                checked={method === 'drop'}
                onChange={() => setMethod('drop')}
                className="cursor-pointer"
              />
              <span className="text-sm text-text-primary">Drop</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="book"
                checked={method === 'book'}
                onChange={() => setMethod('book')}
                className="cursor-pointer"
              />
              <span className="text-sm text-text-primary">Book</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="tome"
                checked={method === 'tome'}
                onChange={() => setMethod('tome')}
                className="cursor-pointer"
              />
              <span className="text-sm text-text-primary">Tome</span>
            </label>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Traded for tomestone piece"
            rows={2}
            className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none resize-none"
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
            disabled={!recipientPlayerId || isSaving}
            className="px-4 py-2 rounded bg-accent text-white hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Logging...' : 'Log Loot'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
