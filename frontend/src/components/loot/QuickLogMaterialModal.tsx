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
import { getPriorityForUpgradeMaterial, getPriorityForUniversalTomestone, type PriorityEntry } from '../../utils/priority';
import { isSlotAugmentationMaterial, UPGRADE_MATERIAL_DISPLAY_NAMES } from '../../gamedata/loot-tables';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer, MaterialType, StaticSettings } from '../../types';

interface QuickLogMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  tierId: string;
  floor: string;
  material: MaterialType;
  maxWeek: number; // Max week available for selection (defaults week selector to this)
  suggestedPlayer: SnapshotPlayer;
  allPlayers: SnapshotPlayer[];
  settings?: StaticSettings;
  onSuccess?: () => void;
}

export function QuickLogMaterialModal({
  isOpen,
  onClose,
  groupId,
  tierId,
  floor,
  material,
  maxWeek,
  suggestedPlayer,
  allPlayers,
  settings = DEFAULT_SETTINGS,
  onSuccess,
}: QuickLogMaterialModalProps) {
  const [recipientPlayerId, setRecipientPlayerId] = useState(suggestedPlayer.id);
  const [selectedWeek, setSelectedWeek] = useState(maxWeek);
  const [isSaving, setIsSaving] = useState(false);
  const [includeSubs, setIncludeSubs] = useState(false);
  const { createMaterialEntry, materialLog } = useLootTrackingStore();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipientPlayerId(suggestedPlayer.id);
      setSelectedWeek(maxWeek);
      setIncludeSubs(false);
    }
  }, [isOpen, suggestedPlayer.id, maxWeek]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPlayerId) return;

    setIsSaving(true);
    try {
      await createMaterialEntry(groupId, tierId, {
        weekNumber: selectedWeek,
        floor,
        materialType: material,
        recipientPlayerId,
      });

      const recipient = allPlayers.find((p) => p.id === recipientPlayerId);
      toast.success(`Logged ${UPGRADE_MATERIAL_DISPLAY_NAMES[material]} for ${recipient?.name || 'player'}`);

      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Failed to log material');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter to configured players, excluding subs unless includeSubs is checked
  const eligiblePlayers = useMemo(() =>
    allPlayers.filter((p) => p.configured && (includeSubs || !p.isSubstitute)),
    [allPlayers, includeSubs]
  );
  const selectedPlayer = allPlayers.find((p) => p.id === recipientPlayerId);

  // Sort players by priority and add labels
  const sortedRecipients = useMemo(() => {
    // Get priority entries for this material (pass materialLog to account for received materials)
    // Use different priority calculation for Universal Tomestone vs slot-based materials
    const priorityEntries: PriorityEntry[] = isSlotAugmentationMaterial(material)
      ? getPriorityForUpgradeMaterial(eligiblePlayers, material, settings, materialLog)
      : getPriorityForUniversalTomestone(eligiblePlayers, settings, materialLog);

    // Create a map of player ID to priority rank
    const priorityMap = new Map(priorityEntries.map((e, i) => [e.player.id, { rank: i + 1, score: e.score }]));

    // Sort all players: those with priority first (by rank), then others alphabetically
    return eligiblePlayers
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
  }, [eligiblePlayers, material, settings, materialLog]);

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
      title={`Log ${UPGRADE_MATERIAL_DISPLAY_NAMES[material]}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pre-filled info */}
        <div className="bg-surface-base rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Floor:</span>
            <span className="text-text-primary font-medium">{floor}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Material:</span>
            <span className="text-text-primary font-medium">{UPGRADE_MATERIAL_DISPLAY_NAMES[material]}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Week:</span>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="px-2 py-1 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none text-sm"
            >
              {Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Recipient selection */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-text-secondary">Recipient</label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSubs}
                onChange={(e) => setIncludeSubs(e.target.checked)}
                className="w-3 h-3 rounded border-border-default text-accent cursor-pointer"
              />
              <span className="text-xs text-text-muted">Include Subs</span>
            </label>
          </div>
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
            <li>+ Add {UPGRADE_MATERIAL_DISPLAY_NAMES[material]} to Week {selectedWeek} log for {selectedPlayer?.name}</li>
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
            {isSaving ? 'Logging...' : 'Log Material'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
