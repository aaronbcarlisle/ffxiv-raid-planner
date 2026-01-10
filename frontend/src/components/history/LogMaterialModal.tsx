/**
 * Log Material Modal
 *
 * Modal for logging or editing upgrade material distribution (Twine, Glaze, Solvent).
 */

import { useState, useMemo, useEffect } from 'react';
import { Modal, Select, Checkbox, Label, TextArea } from '../ui';
import { NumberInput } from '../ui/NumberInput';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import type { SnapshotPlayer, MaterialType, StaticSettings, MaterialLogEntry, MaterialLogEntryUpdate } from '../../types';
import { MATERIAL_INFO } from '../../hooks/useWeekSummary';
import { getPriorityForUpgradeMaterial, getPriorityForUniversalTomestone } from '../../utils/priority';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { parseFloorName, FLOOR_LOOT_TABLES, isSlotAugmentationMaterial } from '../../gamedata/loot-tables';

interface LogMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    weekNumber: number;
    floor: string;
    materialType: MaterialType;
    recipientPlayerId: string;
    notes?: string;
  }) => Promise<void>;
  onUpdate?: (data: MaterialLogEntryUpdate) => Promise<void>;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  settings?: StaticSettings;
  suggestedPlayer?: SnapshotPlayer;
  suggestedMaterial?: MaterialType;
  presetFloor?: string;
  /** If provided, modal operates in edit mode */
  editEntry?: MaterialLogEntry;
}

/**
 * Get materials that drop from a floor by parsing the floor name
 * and looking up in the standard loot tables.
 * Works with any tier naming convention (M9S, P9S, etc.)
 */
function getMaterialsForFloor(floorName: string): MaterialType[] {
  const floorNum = parseFloorName(floorName);
  const lootTable = FLOOR_LOOT_TABLES[floorNum];
  return lootTable?.upgradeMaterials as MaterialType[] || [];
}

export function LogMaterialModal({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  players,
  floors,
  currentWeek,
  settings = DEFAULT_SETTINGS,
  suggestedPlayer,
  suggestedMaterial,
  presetFloor,
  editEntry,
}: LogMaterialModalProps) {
  const isEditMode = !!editEntry;
  // Determine initial floor: use preset if valid, otherwise find first floor with materials
  const getInitialFloor = () => {
    if (presetFloor && getMaterialsForFloor(presetFloor).length > 0) {
      return presetFloor;
    }
    return floors.find((f) => getMaterialsForFloor(f).length > 0) || floors[0];
  };

  const [selectedFloor, setSelectedFloor] = useState(getInitialFloor);

  // Determine initial material: use suggested if valid for floor, otherwise first material for floor
  const getInitialMaterial = (): MaterialType => {
    const floorMaterials = getMaterialsForFloor(selectedFloor);
    if (suggestedMaterial && floorMaterials.includes(suggestedMaterial)) {
      return suggestedMaterial;
    }
    return floorMaterials[0] || 'twine';
  };

  const [selectedMaterial, setSelectedMaterial] = useState<MaterialType>(getInitialMaterial);
  const [selectedPlayer, setSelectedPlayer] = useState(
    suggestedPlayer?.id || ''
  );
  const [weekNumber, setWeekNumber] = useState(currentWeek);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [includeSubs, setIncludeSubs] = useState(false);

  // Reset state when modal opens with new preset values or edit entry
  useEffect(() => {
    if (isOpen) {
      if (editEntry) {
        // Edit mode: use existing entry values
        setSelectedFloor(editEntry.floor);
        setSelectedMaterial(editEntry.materialType);
        setSelectedPlayer(editEntry.recipientPlayerId);
        setWeekNumber(editEntry.weekNumber);
        setNotes(editEntry.notes || '');
        setShowAllRecipients(false);
        // If the recipient is a substitute, enable includeSubs so they appear in dropdown
        const recipient = players.find(p => p.id === editEntry.recipientPlayerId);
        setIncludeSubs(recipient?.isSubstitute ?? false);
      } else {
        // Add mode: use presets if provided, otherwise defaults
        const initialFloor = presetFloor && getMaterialsForFloor(presetFloor).length > 0
          ? presetFloor
          : floors.find((f) => getMaterialsForFloor(f).length > 0) || floors[0];
        setSelectedFloor(initialFloor);

        const floorMaterials = getMaterialsForFloor(initialFloor);
        const initialMaterial = suggestedMaterial && floorMaterials.includes(suggestedMaterial)
          ? suggestedMaterial
          : floorMaterials[0] || 'twine';
        setSelectedMaterial(initialMaterial);

        setSelectedPlayer(suggestedPlayer?.id || '');
        setWeekNumber(currentWeek);
        setNotes('');
        setShowAllRecipients(false);
        setIncludeSubs(false);
      }
    }
  }, [isOpen, editEntry, presetFloor, suggestedMaterial, suggestedPlayer, currentWeek, floors, players]);

  // Get material log from store for priority calculation
  const { materialLog } = useLootTrackingStore();

  // Get available materials for selected floor
  const availableMaterials = getMaterialsForFloor(selectedFloor);

  const handleFloorChange = (floor: string) => {
    setSelectedFloor(floor);
    const materials = getMaterialsForFloor(floor);
    if (materials.length > 0 && !materials.includes(selectedMaterial)) {
      setSelectedMaterial(materials[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPlayer || !selectedMaterial) return;

    setIsSubmitting(true);
    try {
      if (isEditMode && onUpdate) {
        // Edit mode: call onUpdate with changes
        await onUpdate({
          weekNumber,
          floor: selectedFloor,
          materialType: selectedMaterial,
          recipientPlayerId: selectedPlayer,
          notes: notes.trim() || undefined,
        });
      } else {
        // Add mode: call onSubmit with full data
        await onSubmit({
          weekNumber,
          floor: selectedFloor,
          materialType: selectedMaterial,
          recipientPlayerId: selectedPlayer,
          notes: notes.trim() || undefined,
        });
      }
      onClose();
    } catch {
      // Error handled by caller
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get priority-sorted players using the same logic as loot priority
  // This respects role priority (melee > ranged > caster > tank > healer)
  // and boosts score by number of unaugmented pieces needing this material
  const sortedPlayersWithPriority = useMemo(() => {
    // Filter to configured players, excluding subs unless includeSubs is checked
    const eligiblePlayers = players.filter((p) => p.configured && (includeSubs || !p.isSubstitute));

    // Get players who need this material (have unaugmented tome pieces)
    // Pass materialLog to account for materials already received
    // Use different priority function for universal_tomestone vs augmentation materials
    const priorityList = isSlotAugmentationMaterial(selectedMaterial)
      ? getPriorityForUpgradeMaterial(eligiblePlayers, selectedMaterial, settings, materialLog)
      : getPriorityForUniversalTomestone(eligiblePlayers, settings, materialLog);

    // Also include players who don't need the material (at the bottom)
    const playersWithPriority = priorityList.map(({ player, score }, index) => ({
      player,
      score,
      rank: index + 1,
      needsMaterial: true,
    }));

    // Add players who don't need this material at the bottom
    const playersWithPriorityIds = new Set(priorityList.map(p => p.player.id));
    const playersWithoutNeed = eligiblePlayers
      .filter(p => !playersWithPriorityIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(player => ({
        player,
        score: 0,
        rank: 999,
        needsMaterial: false,
      }));

    return [...playersWithPriority, ...playersWithoutNeed];
  }, [players, selectedMaterial, settings, materialLog, includeSubs]);

  // Filter recipients based on checkbox states
  // Logic:
  // - Neither checked: Main roster who need material only
  // - Include Subs only: Main roster who need material + subs who need material.
  //                      If NO ONE needs it, show ONLY subs (fallback)
  // - Show All Players only: All main roster (excluding subs), regardless of need
  // - Both checked: Everyone (all main roster + all subs)
  // - In Edit mode: Always include the current recipient even if they don't need the material
  const visibleRecipients = useMemo(() => {
    let result: typeof sortedPlayersWithPriority;

    if (showAllRecipients && includeSubs) {
      // Both checked: show everyone
      result = sortedPlayersWithPriority;
    } else if (showAllRecipients && !includeSubs) {
      // Show all main roster (already filtered out subs in sortedPlayersWithPriority when includeSubs is false)
      result = sortedPlayersWithPriority;
    } else if (includeSubs && !showAllRecipients) {
      // Include Subs mode: show those who need + fallback to subs if none need
      const needsMaterial = sortedPlayersWithPriority.filter(r => r.needsMaterial);
      if (needsMaterial.length > 0) {
        result = needsMaterial;
      } else {
        // No one needs it - show only subs as fallback
        result = sortedPlayersWithPriority.filter(r => r.player.isSubstitute);
      }
    } else {
      // Default: only those who need the material
      result = sortedPlayersWithPriority.filter(r => r.needsMaterial);
    }

    // In edit mode, ALWAYS ensure the current recipient is in the list
    // (they may no longer need the material if they already received it)
    if (isEditMode && editEntry?.recipientPlayerId) {
      const currentRecipientInList = result.some(r => r.player.id === editEntry.recipientPlayerId);
      if (!currentRecipientInList) {
        // Find the recipient directly from players prop (unfiltered)
        const player = players.find(p => p.id === editEntry.recipientPlayerId);
        if (player) {
          // Check if they're in sortedPlayersWithPriority for priority info
          const sortedEntry = sortedPlayersWithPriority.find(r => r.player.id === editEntry.recipientPlayerId);
          result = [{
            player,
            score: sortedEntry?.score ?? 0,
            rank: sortedEntry?.rank ?? 999,
            needsMaterial: sortedEntry?.needsMaterial ?? false,
          }, ...result];
        }
      }
    }

    return result;
  }, [sortedPlayersWithPriority, showAllRecipients, includeSubs, isEditMode, editEntry, players]);

  // Auto-select top priority recipient when material changes
  // Skip auto-selection in edit mode to preserve original recipient
  useEffect(() => {
    if (editEntry) return; // Don't auto-select in edit mode

    // Use visibleRecipients for auto-selection to match what's shown in dropdown
    if (visibleRecipients.length > 0) {
      // Select the first visible recipient (already sorted by priority)
      setSelectedPlayer(visibleRecipients[0].player.id);
    } else {
      // No visible recipients - clear selection
      setSelectedPlayer('');
    }
  }, [selectedMaterial, visibleRecipients, editEntry]);

  // Get priority label for a player
  const getPriorityLabel = (rank: number, needsMaterial: boolean): string => {
    if (!needsMaterial) return '';
    if (rank === 1) return ' - Top Priority';
    if (rank === 2) return ' - 2nd Priority';
    if (rank === 3) return ' - 3rd Priority';
    return '';
  };

  // Build floor options for Select - only include floors that have materials
  const floorOptions = floors
    .filter((floor) => getMaterialsForFloor(floor).length > 0)
    .map((floor) => ({
      value: floor,
      label: floor,
    }));

  // Build recipient options for Select
  const recipientOptions = [
    { value: '', label: 'Select player...' },
    ...visibleRecipients.map(({ player, rank, needsMaterial }) => ({
      value: player.id,
      label: `${player.name}${getPriorityLabel(rank, needsMaterial)}`,
      icon: <JobIcon job={player.job} size="sm" />,
    })),
  ];

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Edit Material Entry' : 'Log Material'}>
      <div className="space-y-4">
        {/* Week + Floor row (matching loot modal layout) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="week">Week</Label>
            <NumberInput
              value={weekNumber}
              onChange={(val) => setWeekNumber(val ?? 1)}
              min={1}
              size="sm"
              showButtons={false}
            />
          </div>
          <div>
            <Label htmlFor="floor">Floor</Label>
            <Select
              id="floor"
              value={selectedFloor}
              onChange={handleFloorChange}
              options={floorOptions}
            />
          </div>
        </div>

        {/* Material type select */}
        <div>
          <Label>Material</Label>
          {availableMaterials.length === 0 ? (
            <div className="text-text-muted text-sm py-2">
              No materials drop from this floor
            </div>
          ) : (
            <div className="flex gap-2">
              {availableMaterials.map((material) => {
                const info = MATERIAL_INFO[material];
                return (
                  <Button
                    key={material}
                    type="button"
                    variant={selectedMaterial === material ? 'primary' : 'secondary'}
                    onClick={() => setSelectedMaterial(material)}
                    className="flex-1"
                  >
                    {info.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        {/* Player select */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label htmlFor="recipient" className="mb-0">Recipient</Label>
            <div className="flex items-center gap-3">
              <Checkbox
                checked={includeSubs}
                onChange={setIncludeSubs}
                label="Include Subs"
                className="text-xs"
              />
              <Checkbox
                checked={showAllRecipients}
                onChange={setShowAllRecipients}
                label="Show all players"
                className="text-xs"
              />
            </div>
          </div>
          <Select
            id="recipient"
            value={selectedPlayer}
            onChange={setSelectedPlayer}
            options={recipientOptions}
          />
          {visibleRecipients.length === 0 && !showAllRecipients && (
            <div className="text-xs text-status-success mt-1">
              No one needs this material! Enable "Show all players" to assign anyway.
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <TextArea
            value={notes}
            onChange={setNotes}
            placeholder="Add a note..."
            rows={2}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedPlayer || !selectedMaterial || availableMaterials.length === 0}
          loading={isSubmitting}
        >
          {isEditMode ? 'Save Changes' : 'Log Material'}
        </Button>
      </div>
    </Modal>
  );
}
