/**
 * Quick Log Material Modal
 *
 * Streamlined modal for quickly logging an upgrade material from the priority panel.
 * Pre-filled with material type, floor, and suggested player for one-click confirmation.
 */

import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { toast } from '../../stores/toastStore';
import { getPriorityForUpgradeMaterial } from '../../utils/priority';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer, MaterialType, StaticSettings } from '../../types';

interface QuickLogMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  tierId: string;
  floor: string;
  material: MaterialType;
  currentWeek: number;
  suggestedPlayer: SnapshotPlayer;
  allPlayers: SnapshotPlayer[];
  settings?: StaticSettings;
  onSuccess?: () => void;
}

const MATERIAL_LABELS: Record<MaterialType, string> = {
  twine: 'Twine',
  glaze: 'Glaze',
  solvent: 'Solvent',
};

export function QuickLogMaterialModal({
  isOpen,
  onClose,
  groupId,
  tierId,
  floor,
  material,
  currentWeek,
  suggestedPlayer,
  allPlayers,
  settings = DEFAULT_SETTINGS,
  onSuccess,
}: QuickLogMaterialModalProps) {
  const [recipientPlayerId, setRecipientPlayerId] = useState(suggestedPlayer.id);
  const [isSaving, setIsSaving] = useState(false);
  const { createMaterialEntry, materialLog } = useLootTrackingStore();

  // Reset recipient when suggested player changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipientPlayerId(suggestedPlayer.id);
    }
  }, [isOpen, suggestedPlayer.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPlayerId) return;

    setIsSaving(true);
    try {
      await createMaterialEntry(groupId, tierId, {
        weekNumber: currentWeek,
        floor,
        materialType: material,
        recipientPlayerId,
      });

      const recipient = allPlayers.find((p) => p.id === recipientPlayerId);
      toast.success(`Logged ${MATERIAL_LABELS[material]} for ${recipient?.name || 'player'}`);

      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Failed to log material');
    } finally {
      setIsSaving(false);
    }
  };

  const configuredPlayers = allPlayers.filter((p) => p.configured);
  const selectedPlayer = allPlayers.find((p) => p.id === recipientPlayerId);

  // Sort players by priority and add labels
  const sortedRecipients = useMemo(() => {
    // Get priority entries for this material (pass materialLog to account for received materials)
    const priorityEntries = getPriorityForUpgradeMaterial(configuredPlayers, material, settings, materialLog);

    // Create a map of player ID to priority rank
    const priorityMap = new Map(priorityEntries.map((e, i) => [e.player.id, { rank: i + 1, score: e.score }]));

    // Sort all players: those with priority first (by rank), then others alphabetically
    return configuredPlayers
      .map(player => {
        const priority = priorityMap.get(player.id);
        return {
          player,
          priority: priority?.rank ?? 999,
          needsMaterial: !!priority,
        };
      })
      .sort((a, b) => {
        if (a.needsMaterial && !b.needsMaterial) return -1;
        if (!a.needsMaterial && b.needsMaterial) return 1;
        if (a.needsMaterial && b.needsMaterial) return a.priority - b.priority;
        return a.player.name.localeCompare(b.player.name);
      });
  }, [configuredPlayers, material, settings, materialLog]);

  // Get priority label for a player
  const getPriorityLabel = (priority: number, needsMaterial: boolean): string => {
    if (!needsMaterial) return '';
    if (priority === 1) return ' - Top Priority';
    if (priority === 2) return ' - 2nd Priority';
    if (priority === 3) return ' - 3rd Priority';
    return '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log ${MATERIAL_LABELS[material]}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pre-filled info */}
        <div className="bg-surface-base rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Floor:</span>
            <span className="text-text-primary font-medium">{floor}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Material:</span>
            <span className="text-text-primary font-medium">{MATERIAL_LABELS[material]}</span>
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
            {sortedRecipients.map(({ player, priority, needsMaterial }) => (
              <option key={player.id} value={player.id}>
                {player.name} ({player.job}){getPriorityLabel(priority, needsMaterial)}
              </option>
            ))}
          </select>
        </div>

        {/* Preview */}
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm">
          <div className="text-accent font-medium mb-1">This will:</div>
          <ul className="text-text-secondary space-y-1">
            <li>+ Add {MATERIAL_LABELS[material]} to Week {currentWeek} log for {selectedPlayer?.name}</li>
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
            className="px-4 py-2 rounded bg-accent text-white hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Logging...' : 'Log Material'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
