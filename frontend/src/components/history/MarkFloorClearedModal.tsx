/**
 * Mark Floor Cleared Modal
 *
 * Modal for batch marking players as having cleared a floor (earned books).
 */

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import type { MarkFloorClearedRequest, SnapshotPlayer } from '../../types';

interface MarkFloorClearedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: MarkFloorClearedRequest) => Promise<void>;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
}

export function MarkFloorClearedModal({
  isOpen,
  onClose,
  onSubmit,
  players,
  floors,
  currentWeek,
}: MarkFloorClearedModalProps) {
  // Only show main roster players (configured and not substitutes)
  const mainRosterPlayers = players.filter((p) => p.configured && !p.isSubstitute);

  const [weekNumber, setWeekNumber] = useState(currentWeek || 1);
  const [floor, setFloor] = useState(floors[0] || '');
  // Default to all configured players selected
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(
    () => new Set(mainRosterPlayers.map((p) => p.id))
  );
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when modal opens to ensure fresh state with current players
  useEffect(() => {
    if (isOpen) {
      setWeekNumber(currentWeek || 1);
      setFloor(floors[0] || '');
      setSelectedPlayerIds(new Set(mainRosterPlayers.map((p) => p.id)));
      setNotes('');
    }
  }, [isOpen, currentWeek, floors, mainRosterPlayers]);

  const handleTogglePlayer = (playerId: string) => {
    const newSelected = new Set(selectedPlayerIds);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedPlayerIds(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedPlayerIds(new Set(mainRosterPlayers.map((p) => p.id)));
  };

  const handleClearAll = () => {
    setSelectedPlayerIds(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedPlayerIds.size === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        weekNumber,
        floor,
        playerIds: Array.from(selectedPlayerIds),
        notes: notes || undefined,
      });

      // Reset form
      setWeekNumber(currentWeek);
      setFloor(floors[0] || '');
      setSelectedPlayerIds(new Set());
      setNotes('');

      onClose();
    } catch (error) {
      // Error handled by store
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mark Floor Cleared">
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

        {/* Player selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm text-text-secondary">
              Players ({selectedPlayerIds.size} selected)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-accent hover:text-accent-bright"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-text-muted hover:text-text-secondary"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="border border-border-default rounded-lg max-h-64 overflow-y-auto">
            {mainRosterPlayers.map((player) => (
              <label
                key={player.id}
                className="flex items-center gap-3 p-3 hover:bg-surface-hover cursor-pointer border-b border-border-default last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedPlayerIds.has(player.id)}
                  onChange={() => handleTogglePlayer(player.id)}
                  className="cursor-pointer"
                />
                <span className="text-sm text-text-primary">
                  {player.name} ({player.job})
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Weekly reclears"
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
            disabled={selectedPlayerIds.size === 0 || isSaving}
            className="px-4 py-2 rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Marking...' : `Mark ${selectedPlayerIds.size} Player${selectedPlayerIds.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
