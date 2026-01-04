/**
 * Quick Log Drop Modal
 *
 * Streamlined modal for quickly logging a loot drop from the priority panel.
 * Pre-filled with slot, floor, and suggested player for one-click confirmation.
 */

import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { logLootAndUpdateGear } from '../../utils/lootCoordination';
import { toast } from '../../stores/toastStore';
import { getPriorityForItem, getPriorityForRing } from '../../utils/priority';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer, GearSlot } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';

interface QuickLogDropModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  tierId: string;
  floor: string;
  slot: string;
  currentWeek: number;
  suggestedPlayer: SnapshotPlayer;
  allPlayers: SnapshotPlayer[];
  onSuccess?: () => void;
}

export function QuickLogDropModal({
  isOpen,
  onClose,
  groupId,
  tierId,
  floor,
  slot,
  currentWeek,
  suggestedPlayer,
  allPlayers,
  onSuccess,
}: QuickLogDropModalProps) {
  const [recipientPlayerId, setRecipientPlayerId] = useState(suggestedPlayer.id);
  const [updateGear, setUpdateGear] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Reset recipient when suggested player changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipientPlayerId(suggestedPlayer.id);
      setUpdateGear(true);
    }
  }, [isOpen, suggestedPlayer.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPlayerId) return;

    setIsSaving(true);
    try {
      await logLootAndUpdateGear(
        groupId,
        tierId,
        {
          weekNumber: currentWeek,
          floor,
          itemSlot: slot,
          recipientPlayerId,
          method: 'drop',
        },
        {
          updateGear,
          updateWeaponPriority: slot === 'weapon',
        }
      );

      const recipient = allPlayers.find((p) => p.id === recipientPlayerId);
      const slotName = GEAR_SLOT_NAMES[slot as keyof typeof GEAR_SLOT_NAMES] || slot;
      toast.success(`Logged ${slotName} drop for ${recipient?.name || 'player'}`);

      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Failed to log drop');
    } finally {
      setIsSaving(false);
    }
  };

  const configuredPlayers = allPlayers.filter((p) => p.configured);
  const slotName = GEAR_SLOT_NAMES[slot as keyof typeof GEAR_SLOT_NAMES] || slot;
  const selectedPlayer = allPlayers.find((p) => p.id === recipientPlayerId);

  // Sort players by priority and add labels
  const sortedRecipients = useMemo(() => {
    if (!slot) return configuredPlayers.map(p => ({ player: p, priority: 0, needsItem: false }));

    // Get priority entries for this slot
    const priorityEntries = slot === 'ring1' || slot === 'ring2'
      ? getPriorityForRing(configuredPlayers, DEFAULT_SETTINGS)
      : getPriorityForItem(configuredPlayers, slot as GearSlot, DEFAULT_SETTINGS);

    // Create a map of player ID to priority rank
    const priorityMap = new Map(priorityEntries.map((e, i) => [e.player.id, { rank: i + 1, score: e.score }]));

    // Sort all players: those with priority first (by rank), then others alphabetically
    return configuredPlayers
      .map(player => {
        const priority = priorityMap.get(player.id);
        return {
          player,
          priority: priority?.rank ?? 999,
          needsItem: !!priority,
        };
      })
      .sort((a, b) => {
        if (a.needsItem && !b.needsItem) return -1;
        if (!a.needsItem && b.needsItem) return 1;
        if (a.needsItem && b.needsItem) return a.priority - b.priority;
        return a.player.name.localeCompare(b.player.name);
      });
  }, [configuredPlayers, slot]);

  // Get priority label for a player
  const getPriorityLabel = (priority: number, needsItem: boolean): string => {
    if (!needsItem) return '';
    if (priority === 1) return ' - Top Priority';
    if (priority === 2) return ' - 2nd Priority';
    if (priority === 3) return ' - 3rd Priority';
    return '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log ${slotName} Drop`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pre-filled info */}
        <div className="bg-surface-base rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Floor:</span>
            <span className="text-text-primary font-medium">{floor}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Item:</span>
            <span className="text-text-primary font-medium">{slotName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Week:</span>
            <span className="text-text-primary font-medium">{currentWeek}</span>
          </div>
        </div>

        {/* Recipient selection */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Recipient</label>
          <select
            value={recipientPlayerId}
            onChange={(e) => setRecipientPlayerId(e.target.value)}
            className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none"
          >
            {sortedRecipients.map(({ player, priority, needsItem }) => (
              <option key={player.id} value={player.id}>
                {player.name} ({player.job}){getPriorityLabel(priority, needsItem)}
              </option>
            ))}
          </select>
        </div>

        {/* Update gear checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={updateGear}
            onChange={(e) => setUpdateGear(e.target.checked)}
            className="w-4 h-4 rounded border-border-default text-accent focus:ring-accent cursor-pointer"
          />
          <span className="text-sm text-text-primary">
            Mark {slotName.toLowerCase()} as acquired for {selectedPlayer?.name || 'player'}
          </span>
        </label>

        {/* Preview */}
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm">
          <div className="text-accent font-medium mb-1">This will:</div>
          <ul className="text-text-secondary space-y-1">
            <li>+ Add {slotName} to Week {currentWeek} loot log</li>
            {updateGear && (
              <li>+ Mark {slotName} as acquired on {selectedPlayer?.name}</li>
            )}
            {updateGear && slot === 'weapon' && (
              <li>+ Update weapon priority status</li>
            )}
          </ul>
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
            className="px-4 py-2 rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Logging...' : 'Log Drop'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
