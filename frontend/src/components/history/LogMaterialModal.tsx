/**
 * Log Material Modal
 *
 * Modal for logging upgrade material distribution (Twine, Glaze, Solvent).
 */

import { useState } from 'react';
import type { SnapshotPlayer, MaterialType } from '../../types';
import { MATERIAL_INFO } from '../../hooks/useWeekSummary';

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
  suggestedPlayer?: SnapshotPlayer;
  suggestedMaterial?: MaterialType;
}

// Floor to material mapping based on current tier (AAC Heavyweight)
const FLOOR_MATERIALS: Record<string, MaterialType[]> = {
  M9S: ['glaze'],
  M10S: ['glaze'],
  M11S: ['twine', 'solvent'],
  M12S: [],
  // Legacy tiers
  M5S: ['glaze'],
  M6S: ['glaze'],
  M7S: ['twine', 'solvent'],
  M8S: [],
};

export function LogMaterialModal({
  isOpen,
  onClose,
  onSubmit,
  players,
  floors,
  currentWeek,
  suggestedPlayer,
  suggestedMaterial,
}: LogMaterialModalProps) {
  const [selectedFloor, setSelectedFloor] = useState(
    floors.find((f) => FLOOR_MATERIALS[f]?.length > 0) || floors[0]
  );
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialType>(
    suggestedMaterial || FLOOR_MATERIALS[selectedFloor]?.[0] || 'twine'
  );
  const [selectedPlayer, setSelectedPlayer] = useState(
    suggestedPlayer?.id || ''
  );
  const [weekNumber, setWeekNumber] = useState(currentWeek);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get available materials for selected floor
  const availableMaterials = FLOOR_MATERIALS[selectedFloor] || [];

  const handleFloorChange = (floor: string) => {
    setSelectedFloor(floor);
    const materials = FLOOR_MATERIALS[floor] || [];
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

  if (!isOpen) return null;

  const configuredPlayers = players.filter((p) => p.configured);

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
                const materials = FLOOR_MATERIALS[floor] || [];
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
            <label className="block text-sm text-text-secondary mb-1">
              Recipient
            </label>
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="w-full bg-surface-elevated border border-border-default rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select player...</option>
              {configuredPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} ({player.job})
                </option>
              ))}
            </select>
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
            className="px-4 py-2 rounded bg-accent text-white hover:bg-accent-bright transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Logging...' : 'Log Material'}
          </button>
        </div>
      </div>
    </div>
  );
}
