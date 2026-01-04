/**
 * Log Material Modal
 *
 * Modal for logging upgrade material distribution (Twine, Glaze, Solvent).
 */

import { useState, useMemo, useEffect } from 'react';
import type { SnapshotPlayer, MaterialType, StaticSettings } from '../../types';
import { MATERIAL_INFO } from '../../hooks/useWeekSummary';
import { getPriorityForUpgradeMaterial } from '../../utils/priority';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { parseFloorName, FLOOR_LOOT_TABLES } from '../../gamedata/loot-tables';

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
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  settings?: StaticSettings;
  suggestedPlayer?: SnapshotPlayer;
  suggestedMaterial?: MaterialType;
  presetFloor?: string;
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
  players,
  floors,
  currentWeek,
  settings = DEFAULT_SETTINGS,
  suggestedPlayer,
  suggestedMaterial,
  presetFloor,
}: LogMaterialModalProps) {
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
      await onSubmit({
        weekNumber,
        floor: selectedFloor,
        materialType: selectedMaterial,
        recipientPlayerId: selectedPlayer,
        notes: notes.trim() || undefined,
      });
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
    const configuredPlayers = players.filter((p) => p.configured);

    // Get players who need this material (have unaugmented tome pieces)
    // Pass materialLog to account for materials already received
    const priorityList = getPriorityForUpgradeMaterial(
      configuredPlayers,
      selectedMaterial,
      settings,
      materialLog
    );

    // Also include players who don't need the material (at the bottom)
    const playersWithPriority = priorityList.map(({ player, score }, index) => ({
      player,
      score,
      rank: index + 1,
      needsMaterial: true,
    }));

    // Add players who don't need this material at the bottom
    const playersWithPriorityIds = new Set(priorityList.map(p => p.player.id));
    const playersWithoutNeed = configuredPlayers
      .filter(p => !playersWithPriorityIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(player => ({
        player,
        score: 0,
        rank: 999,
        needsMaterial: false,
      }));

    return [...playersWithPriority, ...playersWithoutNeed];
  }, [players, selectedMaterial, settings, materialLog]);

  // Filter to only show players who need the material (unless showAllRecipients)
  const visibleRecipients = useMemo(() => {
    if (showAllRecipients) return sortedPlayersWithPriority;
    return sortedPlayersWithPriority.filter(r => r.needsMaterial);
  }, [sortedPlayersWithPriority, showAllRecipients]);

  // Auto-select top priority recipient when material changes
  useEffect(() => {
    if (sortedPlayersWithPriority.length > 0) {
      const topPriority = sortedPlayersWithPriority.find(r => r.needsMaterial);
      if (topPriority) {
        setSelectedPlayer(topPriority.player.id);
      } else if (sortedPlayersWithPriority.length > 0) {
        // Fall back to first player if no one needs the material
        setSelectedPlayer(sortedPlayersWithPriority[0].player.id);
      }
    }
  }, [selectedMaterial, sortedPlayersWithPriority]);

  // Get priority label for a player
  const getPriorityLabel = (rank: number, needsMaterial: boolean): string => {
    if (!needsMaterial) return '';
    if (rank === 1) return ' - Top Priority';
    if (rank === 2) return ' - 2nd Priority';
    if (rank === 3) return ' - 3rd Priority';
    return '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-card rounded-lg p-6 max-w-md w-full mx-4 border border-border-default">
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Log Material
        </h3>

        <div className="space-y-4">
          {/* Floor select */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Floor
            </label>
            <select
              value={selectedFloor}
              onChange={(e) => handleFloorChange(e.target.value)}
              className="w-full bg-surface-elevated border border-border-default rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
            >
              {floors.map((floor) => {
                const materials = getMaterialsForFloor(floor);
                return (
                  <option key={floor} value={floor} disabled={materials.length === 0}>
                    {floor} {materials.length === 0 ? '(no materials)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Material type select */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Material
            </label>
            {availableMaterials.length === 0 ? (
              <div className="text-text-muted text-sm py-2">
                No materials drop from this floor
              </div>
            ) : (
              <div className="flex gap-2">
                {availableMaterials.map((material) => {
                  const info = MATERIAL_INFO[material];
                  return (
                    <button
                      key={material}
                      onClick={() => setSelectedMaterial(material)}
                      className={`flex-1 px-3 py-2 rounded border transition-colors ${
                        selectedMaterial === material
                          ? 'bg-accent/20 border-accent text-accent'
                          : 'bg-surface-elevated border-border-default text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {info.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Player select */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-text-secondary">Recipient</label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllRecipients}
                  onChange={(e) => setShowAllRecipients(e.target.checked)}
                  className="w-3 h-3 rounded border-border-default text-accent cursor-pointer"
                />
                <span className="text-xs text-text-muted">Show all players</span>
              </label>
            </div>
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="w-full bg-surface-elevated border border-border-default rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select player...</option>
              {visibleRecipients.map(({ player, rank, needsMaterial }) => (
                <option key={player.id} value={player.id}>
                  {player.name} ({player.job}){getPriorityLabel(rank, needsMaterial)}
                </option>
              ))}
            </select>
            {visibleRecipients.length === 0 && !showAllRecipients && (
              <div className="text-xs text-status-success mt-1">
                No one needs this material! Enable "Show all players" to assign anyway.
              </div>
            )}
          </div>

          {/* Week number */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Week
            </label>
            <input
              type="number"
              min={1}
              value={weekNumber}
              onChange={(e) => setWeekNumber(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-surface-elevated border border-border-default rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note..."
              className="w-full bg-surface-elevated border border-border-default rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded bg-surface-interactive text-text-primary hover:bg-surface-raised transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !selectedPlayer ||
              !selectedMaterial ||
              availableMaterials.length === 0
            }
            className="px-4 py-2 rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Logging...' : 'Log Material'}
          </button>
        </div>
      </div>
    </div>
  );
}
