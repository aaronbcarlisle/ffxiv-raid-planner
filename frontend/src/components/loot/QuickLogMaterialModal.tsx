/**
 * Quick Log Material Modal
 *
 * Streamlined modal for quickly logging an upgrade material from the priority panel.
 * Pre-filled with material type, floor, and suggested player for one-click confirmation.
 */

import { useState, useEffect, useMemo } from 'react';
import { Gem } from 'lucide-react';
import { Modal, Select, Label } from '../ui';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
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
  const [selectedWeek, setSelectedWeek] = useState(String(maxWeek));
  const [isSaving, setIsSaving] = useState(false);
  const { createMaterialEntry, materialLog } = useLootTrackingStore();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipientPlayerId(suggestedPlayer.id);
      setSelectedWeek(String(maxWeek));
    }
  }, [isOpen, suggestedPlayer.id, maxWeek]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPlayerId) return;

    setIsSaving(true);
    try {
      await createMaterialEntry(groupId, tierId, {
        weekNumber: Number(selectedWeek),
        floor,
        materialType: material,
        recipientPlayerId,
      });

      const recipient = allPlayers.find((p) => p.id === recipientPlayerId);
      toast.success(`Logged ${UPGRADE_MATERIAL_DISPLAY_NAMES[material]} for ${recipient?.name || 'player'}`);

      onSuccess?.();
      onClose();
    } catch {
      toast.error('Failed to log material');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter to configured main roster players (subs can only be logged via Log tab)
  const eligiblePlayers = useMemo(() =>
    allPlayers.filter((p) => p.configured && !p.isSubstitute),
    [allPlayers]
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

  // Build week options
  const weekOptions = Array.from({ length: maxWeek }, (_, i) => ({
    value: String(i + 1),
    label: `Week ${i + 1}`,
  }));

  // Build recipient options with job icons
  const recipientOptions = sortedRecipients.map(({ player, priority, needsMaterial }) => ({
    value: player.id,
    label: `${player.name}${getPriorityLabel(priority, needsMaterial)}`,
    icon: <JobIcon job={player.job} size="sm" />,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Gem className="w-5 h-5" />
          Log {UPGRADE_MATERIAL_DISPLAY_NAMES[material]}
        </span>
      }
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
            <div className="w-32">
              <Select
                value={selectedWeek}
                onChange={setSelectedWeek}
                options={weekOptions}
              />
            </div>
          </div>
        </div>

        {/* Recipient selection */}
        <div>
          <Label htmlFor="recipient">Recipient</Label>
          <Select
            id="recipient"
            value={recipientPlayerId}
            onChange={setRecipientPlayerId}
            options={recipientOptions}
          />
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
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!recipientPlayerId}
            loading={isSaving}
          >
            Log Material
          </Button>
        </div>
      </form>
    </Modal>
  );
}
