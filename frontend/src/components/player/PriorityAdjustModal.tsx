/**
 * Priority Adjust Modal
 *
 * Allows users to adjust a player's priority modifier.
 * The modifier is added to the player's calculated priority score.
 * Positive values increase priority, negative values decrease it.
 */

import { useState, useEffect } from 'react';
import { Gauge } from 'lucide-react';
import { Modal, NumberInput, Label } from '../ui';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import type { SnapshotPlayer } from '../../types';
import {
  PRIORITY_MODIFIER_MIN,
  PRIORITY_MODIFIER_MAX,
  PRIORITY_MODIFIER_STEP,
} from '../../utils/constants';

interface PriorityAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: SnapshotPlayer;
  onSave: (playerId: string, modifier: number) => Promise<void>;
}

export function PriorityAdjustModal({ isOpen, onClose, player, onSave }: PriorityAdjustModalProps) {
  const [modifier, setModifier] = useState<number>(player.priorityModifier ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset modifier state when player changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setModifier(player.priorityModifier ?? 0);
      setError(null);
    }
  }, [isOpen, player.id, player.priorityModifier]);

  const handleSave = async () => {
    // Validate range before saving
    if (modifier < PRIORITY_MODIFIER_MIN || modifier > PRIORITY_MODIFIER_MAX) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(player.id, modifier);
      onClose();
    } catch {
      // Show error state - parent will also show toast
      setError('Failed to save priority adjustment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setModifier(0);
  };

  const hasChanged = modifier !== (player.priorityModifier ?? 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Gauge className="w-5 h-5" />
          Adjust Priority
        </span>
      }
      size="sm"
    >
      <div className="space-y-4">
        {/* Player info */}
        <div className="flex items-center gap-3 p-3 bg-surface-base rounded-lg">
          <JobIcon job={player.job} size="md" />
          <div>
            <div className="font-medium text-text-primary">{player.name}</div>
            <div className="text-sm text-text-muted">{player.job}</div>
          </div>
        </div>

        {/* Modifier input */}
        <div>
          <Label htmlFor="priorityModifier">Priority Modifier</Label>
          <NumberInput
            id="priorityModifier"
            value={modifier}
            onChange={(value) => setModifier(value ?? 0)}
            min={PRIORITY_MODIFIER_MIN}
            max={PRIORITY_MODIFIER_MAX}
            step={PRIORITY_MODIFIER_STEP}
            className="mt-1"
          />
          <p className="text-xs text-text-muted mt-2">
            Positive values increase priority, negative values decrease it.
            Range: -100 to +100.
          </p>
        </div>

        {/* Explanation */}
        <div className="p-3 bg-surface-elevated border border-border-default rounded-lg text-sm text-text-secondary">
          <div className="font-medium text-text-primary mb-1">How it works:</div>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>The modifier is added directly to the priority score</li>
            <li>Use +20 to +50 to give a player higher priority</li>
            <li>Use -20 to -50 to give a player lower priority</li>
            <li>Useful for catch-up or balancing new members</li>
          </ul>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-lg text-sm text-status-error">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-border-default">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={modifier === 0}
          >
            Reset to 0
          </Button>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanged}
              loading={isSaving}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
