/**
 * Player Loot Adjustments Modal
 *
 * Modal for editing per-player priority adjustments.
 * Used for mid-tier roster changes (players who joined late or missed weeks).
 * Changes are saved immediately when the user clicks Save.
 */

import { useState, useEffect } from 'react';
import { Users, Save, RotateCcw } from 'lucide-react';
import { Button } from '../primitives';
import { Modal } from '../ui/Modal';
import { NumberInput } from '../ui/NumberInput';
import { JobIcon } from '../ui/JobIcon';
import { useTierStore } from '../../stores/tierStore';
import { toast } from '../../stores/toastStore';
import type { SnapshotPlayer } from '../../types';

interface PlayerAdjustmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: SnapshotPlayer[];
  groupId: string;
  tierId: string;
  disabled?: boolean;
}

export function PlayerAdjustmentsModal({
  isOpen,
  onClose,
  players,
  groupId,
  tierId,
  disabled,
}: PlayerAdjustmentsModalProps) {
  const { updatePlayer } = useTierStore();

  // Local state for editing - initialized from player data when modal opens
  const [localAdjustments, setLocalAdjustments] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      const adjustments: Record<string, number> = {};
      players.forEach((p) => {
        adjustments[p.id] = p.lootAdjustment ?? 0;
      });
      setLocalAdjustments(adjustments);
    }
  }, [isOpen, players]);

  const handleLocalChange = (playerId: string, value: number | null) => {
    setLocalAdjustments((prev) => ({
      ...prev,
      [playerId]: value ?? 0,
    }));
  };

  const handleSave = async () => {
    if (!tierId) return;

    setIsSaving(true);
    try {
      // Save all changed adjustments
      const updatePromises = Object.entries(localAdjustments).map(([playerId, value]) => {
        const player = players.find((p) => p.id === playerId);
        if (player && (player.lootAdjustment ?? 0) !== value) {
          return updatePlayer(groupId, tierId, playerId, { lootAdjustment: value });
        }
        return Promise.resolve();
      });
      await Promise.all(updatePromises);
      toast.success('Player adjustments saved!');
      onClose();
    } catch (error) {
      console.error('Failed to save adjustments:', error);
      toast.error('Failed to save adjustments');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const resetAdjustments: Record<string, number> = {};
    players.forEach((p) => {
      resetAdjustments[p.id] = 0;
    });
    setLocalAdjustments(resetAdjustments);
  };

  // Check if there are changes compared to player data
  const hasChanges = players.some((p) => (p.lootAdjustment ?? 0) !== (localAdjustments[p.id] ?? 0));

  // Check if all values are already zero
  const allZero = Object.values(localAdjustments).every((v) => v === 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Player Loot Adjustments
        </span>
      }
      size="md"
      footer={
        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={disabled || allZero}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset All
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={disabled || !hasChanges} loading={isSaving}>
              <Save className="w-4 h-4 mr-1.5" />
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          Positive values increase priority, negative decrease. Use for players who joined late or missed weeks.
        </p>

        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg border border-border-subtle"
            >
              <JobIcon job={player.job} size="sm" />
              <span className="text-sm text-text-primary flex-1 min-w-0 truncate">
                {player.name}
              </span>
              <NumberInput
                value={localAdjustments[player.id] ?? 0}
                onChange={(value) => handleLocalChange(player.id, value)}
                min={-100}
                max={100}
                step={5}
                size="sm"
                disabled={disabled}
              />
            </div>
          ))}
        </div>

        {players.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            No configured players in this tier.
          </div>
        )}
      </div>
    </Modal>
  );
}
