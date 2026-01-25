/**
 * Quick Log Material Modal
 *
 * Streamlined modal for quickly logging an upgrade material from the priority panel.
 * Pre-filled with material type, floor, and suggested player for one-click confirmation.
 */

import { useState, useEffect, useMemo } from 'react';
import { Gem } from 'lucide-react';
import { Modal, Select, Label, Checkbox } from '../ui';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { toast } from '../../stores/toastStore';
import { getPriorityForUpgradeMaterial, getPriorityForUniversalTomestone, type PriorityEntry } from '../../utils/priority';
import { isSlotAugmentationMaterial, UPGRADE_MATERIAL_DISPLAY_NAMES } from '../../gamedata/loot-tables';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import {
  getEligibleSlotsForAugmentation,
  needsTomeWeaponItem,
  needsTomeWeaponAugmentation,
  logMaterialAndUpdateGear,
} from '../../utils/materialCoordination';
import type { SnapshotPlayer, MaterialType, StaticSettings, GearSlot } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';

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
  const [updateGear, setUpdateGear] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<GearSlot | 'tome_weapon' | null>(null);
  const { materialLog } = useLootTrackingStore();

  // Compute eligible options for gear update based on selected player and material
  const eligibleOptions = useMemo(() => {
    const player = allPlayers.find((p) => p.id === recipientPlayerId);
    if (!player) return { slots: [] as GearSlot[], canMarkTomeWeaponHave: false, canAugmentTomeWeapon: false };

    if (material === 'universal_tomestone') {
      // Universal tomestone grants the base tome weapon
      return {
        slots: [] as GearSlot[],
        canMarkTomeWeaponHave: needsTomeWeaponItem(player),
        canAugmentTomeWeapon: false,
      };
    }

    if (material === 'solvent') {
      // Solvent can augment tome weapon OR weapon gear slot
      const slots = getEligibleSlotsForAugmentation(player, material);
      return {
        slots,
        canMarkTomeWeaponHave: false,
        canAugmentTomeWeapon: needsTomeWeaponAugmentation(player),
      };
    }

    // Twine/Glaze: only gear slots
    return {
      slots: getEligibleSlotsForAugmentation(player, material),
      canMarkTomeWeaponHave: false,
      canAugmentTomeWeapon: false,
    };
  }, [recipientPlayerId, material, allPlayers]);

  // For solvent, track whether user wants to augment tome weapon or gear slot
  const [augmentTomeWeapon, setAugmentTomeWeapon] = useState(false);

  // Determine if there are any eligible options
  const hasEligibleOptions = eligibleOptions.canMarkTomeWeaponHave ||
    eligibleOptions.canAugmentTomeWeapon ||
    eligibleOptions.slots.length > 0;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipientPlayerId(suggestedPlayer.id);
      setSelectedWeek(String(maxWeek));
      setUpdateGear(true);
      setSelectedSlot(null);
      setAugmentTomeWeapon(false);
    }
  }, [isOpen, suggestedPlayer.id, maxWeek]);

  // Auto-select first eligible slot or tome weapon option when eligibility changes
  useEffect(() => {
    if (eligibleOptions.slots.length > 0) {
      setSelectedSlot(eligibleOptions.slots[0]);
      setAugmentTomeWeapon(false);
    } else if (eligibleOptions.canAugmentTomeWeapon) {
      // For solvent with only tome weapon option
      setSelectedSlot(null);
      setAugmentTomeWeapon(true);
    } else {
      setSelectedSlot(null);
      setAugmentTomeWeapon(false);
    }
  }, [eligibleOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPlayerId) return;

    setIsSaving(true);
    try {
      const shouldUpdateGear = updateGear && hasEligibleOptions;

      await logMaterialAndUpdateGear(
        groupId,
        tierId,
        {
          weekNumber: Number(selectedWeek),
          floor,
          materialType: material,
          recipientPlayerId,
        },
        {
          updateGear: shouldUpdateGear,
          slotToAugment: shouldUpdateGear && selectedSlot ? selectedSlot as GearSlot : undefined,
          augmentTomeWeapon: shouldUpdateGear && augmentTomeWeapon,
        }
      );

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

        {/* Gear update option */}
        {hasEligibleOptions && (
          <div className="space-y-2">
            {/* Universal Tomestone: mark tome weapon as have */}
            {material === 'universal_tomestone' && eligibleOptions.canMarkTomeWeaponHave && (
              <Checkbox
                checked={updateGear}
                onChange={setUpdateGear}
                label={`Also mark tome weapon as obtained for ${selectedPlayer?.name}`}
              />
            )}

            {/* Solvent: choose between tome weapon or gear slot */}
            {material === 'solvent' && (eligibleOptions.canAugmentTomeWeapon || eligibleOptions.slots.length > 0) && (
              <>
                <Checkbox
                  checked={updateGear}
                  onChange={setUpdateGear}
                  label={`Also mark gear as augmented for ${selectedPlayer?.name}`}
                />
                {updateGear && (eligibleOptions.canAugmentTomeWeapon && eligibleOptions.slots.length > 0) && (
                  <div>
                    <Select
                      value={augmentTomeWeapon ? 'tome_weapon' : (selectedSlot || '')}
                      onChange={(val) => {
                        if (val === 'tome_weapon') {
                          setAugmentTomeWeapon(true);
                          setSelectedSlot(null);
                        } else {
                          setAugmentTomeWeapon(false);
                          setSelectedSlot(val as GearSlot);
                        }
                      }}
                      options={[
                        { value: 'tome_weapon', label: 'Tome Weapon' },
                        ...eligibleOptions.slots.map((slot) => ({
                          value: slot,
                          label: GEAR_SLOT_NAMES[slot],
                        })),
                      ]}
                    />
                  </div>
                )}
                {updateGear && eligibleOptions.canAugmentTomeWeapon && eligibleOptions.slots.length === 0 && (
                  <div className="text-sm text-text-muted ml-6">Tome Weapon</div>
                )}
                {updateGear && !eligibleOptions.canAugmentTomeWeapon && eligibleOptions.slots.length > 0 && (
                  <div>
                    <Select
                      value={selectedSlot || ''}
                      onChange={(val) => setSelectedSlot(val as GearSlot)}
                      options={eligibleOptions.slots.map((slot) => ({
                        value: slot,
                        label: GEAR_SLOT_NAMES[slot],
                      }))}
                    />
                  </div>
                )}
              </>
            )}

            {/* Twine/Glaze: gear slot dropdown */}
            {material !== 'universal_tomestone' && material !== 'solvent' && eligibleOptions.slots.length > 0 && (
              <>
                <Checkbox
                  checked={updateGear}
                  onChange={setUpdateGear}
                  label={`Also mark gear as augmented for ${selectedPlayer?.name}`}
                />
                {updateGear && (
                  <div>
                    <Select
                      value={selectedSlot || ''}
                      onChange={(val) => setSelectedSlot(val as GearSlot)}
                      options={eligibleOptions.slots.map((slot) => ({
                        value: slot,
                        label: GEAR_SLOT_NAMES[slot],
                      }))}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Preview */}
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm">
          <div className="text-accent font-medium mb-1">This will:</div>
          <ul className="text-text-secondary space-y-1">
            <li>+ Add {UPGRADE_MATERIAL_DISPLAY_NAMES[material]} to Week {selectedWeek} log for {selectedPlayer?.name}</li>
            {updateGear && hasEligibleOptions && (
              <li>
                {material === 'universal_tomestone'
                  ? '+ Mark tome weapon as obtained'
                  : augmentTomeWeapon
                    ? '+ Mark tome weapon as augmented'
                    : `+ Mark ${GEAR_SLOT_NAMES[selectedSlot as GearSlot]} as augmented`
                }
              </li>
            )}
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
