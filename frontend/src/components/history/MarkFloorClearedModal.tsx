/**
 * Mark Floor Cleared Modal
 *
 * Modal for batch marking players as having cleared a floor (earned books).
 */

import { useState, useEffect, useMemo } from 'react';
import { Modal, Select, Checkbox, TextArea, Label } from '../ui';
import { NumberInput } from '../ui/NumberInput';
import { Button } from '../primitives';
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
  // Memoize main roster players to prevent unnecessary re-renders and effect triggers
  // Only recalculate when the players array reference or content actually changes
  const mainRosterPlayers = useMemo(
    () => players.filter((p) => p.configured && !p.isSubstitute),
    [players]
  );

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
    } catch {
      // Error handled by store
    } finally {
      setIsSaving(false);
    }
  };

  // Build floor options for Select
  const floorOptions = floors.map((f) => ({ value: f, label: f }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mark Floor Cleared">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Week and Floor */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="week">Week</Label>
            <NumberInput
              value={weekNumber}
              onChange={setWeekNumber}
              min={1}
              size="sm"
              showButtons={false}
            />
          </div>
          <div>
            <Label htmlFor="floor">Floor</Label>
            <Select
              id="floor"
              value={floor}
              onChange={setFloor}
              options={floorOptions}
            />
          </div>
        </div>

        {/* Player selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="mb-0">
              Players ({selectedPlayerIds.size} selected)
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="border border-border-default rounded-lg max-h-64 overflow-y-auto">
            {mainRosterPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 p-3 hover:bg-surface-hover border-b border-border-default last:border-b-0"
              >
                <Checkbox
                  checked={selectedPlayerIds.has(player.id)}
                  onChange={() => handleTogglePlayer(player.id)}
                  label={`${player.name} (${player.job})`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <TextArea
            value={notes}
            onChange={setNotes}
            placeholder="e.g., Weekly reclears"
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
            disabled={selectedPlayerIds.size === 0}
            loading={isSaving}
          >
            {`Mark ${selectedPlayerIds.size} Player${selectedPlayerIds.size === 1 ? '' : 's'}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
