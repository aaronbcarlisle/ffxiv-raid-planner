/**
 * Log Material Modal
 *
 * Modal for logging or editing upgrade material distribution (Twine, Glaze, Solvent).
 */

import { useState, useMemo, useEffect } from 'react';
import { Gem, Pencil } from 'lucide-react';
import { Modal, Select, Checkbox, Label, TextArea } from '../ui';
import { NumberInput } from '../ui/NumberInput';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import type { SnapshotPlayer, MaterialType, StaticSettings, MaterialLogEntry, MaterialLogEntryUpdate, GearSlot } from '../../types';
import { GEAR_SLOT_NAMES, GEAR_SLOT_ICONS } from '../../types';
import { MATERIAL_INFO } from '../../hooks/useWeekSummary';
import { getPriorityForUpgradeMaterial, getPriorityForUniversalTomestone } from '../../utils/priority';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useTierStore } from '../../stores/tierStore';
import { toast } from '../../stores/toastStore';
import { parseFloorName, FLOOR_LOOT_TABLES, FLOOR_COLORS, isSlotAugmentationMaterial } from '../../gamedata/loot-tables';
import {
  getEligibleSlotsForAugmentation,
  needsTomeWeaponItem,
  needsTomeWeaponAugmentation,
  hasTomeWeaponItem,
  logMaterialAndUpdateGear,
} from '../../utils/materialCoordination';

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
  /** Required for augmentation coordination in add mode */
  groupId?: string;
  tierId?: string;
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
  groupId,
  tierId,
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
  // Augmentation state (add mode only)
  const [updateGear, setUpdateGear] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<GearSlot | null>(null);
  const [augmentTomeWeapon, setAugmentTomeWeapon] = useState(false);

  // Compute eligible options for gear update based on selected player and material
  // In edit mode, also include the originally selected slot so users can see/change it
  const eligibleOptions = useMemo(() => {
    const player = players.find((p) => p.id === selectedPlayer);
    if (!player) return { slots: [] as GearSlot[], canMarkTomeWeaponHave: false, canAugmentTomeWeapon: false, originalSlot: null as GearSlot | 'tome_weapon' | null };

    // Get the original slot from the edit entry (if editing and same recipient)
    const originalSlot = isEditMode && editEntry?.recipientPlayerId === selectedPlayer
      ? editEntry.slotAugmented
      : null;

    if (selectedMaterial === 'universal_tomestone') {
      // Universal tomestone grants the base tome weapon
      // In edit mode, if we originally marked tome weapon as obtained, show that option
      const canMark = needsTomeWeaponItem(player);
      const hadTomeWeapon = isEditMode && editEntry?.materialType === 'universal_tomestone';
      return {
        slots: [] as GearSlot[],
        canMarkTomeWeaponHave: canMark || hadTomeWeapon,
        canAugmentTomeWeapon: false,
        originalSlot,
      };
    }

    if (selectedMaterial === 'solvent') {
      // Solvent can augment tome weapon OR weapon gear slot
      let slots = getEligibleSlotsForAugmentation(player, selectedMaterial);
      let canAugmentTome = needsTomeWeaponAugmentation(player);

      // In edit mode, include the original slot even if already augmented
      if (originalSlot === 'tome_weapon') {
        canAugmentTome = true;
      } else if (originalSlot && !slots.includes(originalSlot as GearSlot)) {
        slots = [originalSlot as GearSlot, ...slots];
      }

      return {
        slots,
        canMarkTomeWeaponHave: false,
        canAugmentTomeWeapon: canAugmentTome,
        originalSlot,
      };
    }

    // Twine/Glaze: only gear slots
    let slots = getEligibleSlotsForAugmentation(player, selectedMaterial);

    // In edit mode, include the original slot even if already augmented
    if (originalSlot && originalSlot !== 'tome_weapon' && !slots.includes(originalSlot as GearSlot)) {
      slots = [originalSlot as GearSlot, ...slots];
    }

    return {
      slots,
      canMarkTomeWeaponHave: false,
      canAugmentTomeWeapon: false,
      originalSlot,
    };
  }, [selectedPlayer, selectedMaterial, players, isEditMode, editEntry]);

  // Determine if there are any eligible options
  const hasEligibleOptions = eligibleOptions.canMarkTomeWeaponHave ||
    eligibleOptions.canAugmentTomeWeapon ||
    eligibleOptions.slots.length > 0 ||
    (isEditMode && editEntry?.slotAugmented); // In edit mode, having an original slot counts

  // Auto-select first eligible slot or tome weapon option when eligibility changes
  // Skip in edit mode - the reset effect handles initial selection
  useEffect(() => {
    // In edit mode, don't auto-select - preserve the original selection
    if (isEditMode) return;

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
  }, [eligibleOptions, isEditMode]);

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

        // Determine if gear update checkbox should be checked:
        // - For universal_tomestone: check if player has the tome weapon (this entry likely caused it)
        // - For other materials: check if entry has slotAugmented
        const shouldCheckGearUpdate = editEntry.materialType === 'universal_tomestone'
          ? (recipient ? hasTomeWeaponItem(recipient) : false)
          : !!editEntry.slotAugmented;
        setUpdateGear(shouldCheckGearUpdate);

        // Initialize slot selection based on entry's slotAugmented or compute from player
        if (editEntry.slotAugmented === 'tome_weapon') {
          setSelectedSlot(null);
          setAugmentTomeWeapon(true);
        } else if (editEntry.slotAugmented) {
          setSelectedSlot(editEntry.slotAugmented as GearSlot);
          setAugmentTomeWeapon(false);
        } else if (recipient) {
          // Compute initial slot from player's eligible slots
          const slots = getEligibleSlotsForAugmentation(recipient, editEntry.materialType);
          if (editEntry.materialType === 'solvent' && needsTomeWeaponAugmentation(recipient)) {
            setSelectedSlot(null);
            setAugmentTomeWeapon(true);
          } else {
            setSelectedSlot(slots.length > 0 ? slots[0] : null);
            setAugmentTomeWeapon(false);
          }
        } else {
          setSelectedSlot(null);
          setAugmentTomeWeapon(false);
        }
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

        const initialPlayerId = suggestedPlayer?.id || '';
        setSelectedPlayer(initialPlayerId);
        setWeekNumber(currentWeek);
        setNotes('');
        setShowAllRecipients(false);
        setIncludeSubs(false);
        setUpdateGear(true);

        // Compute initial slot selection based on player and material
        const initialPlayer = players.find(p => p.id === initialPlayerId);
        if (initialPlayer && initialMaterial !== 'universal_tomestone') {
          if (initialMaterial === 'solvent') {
            const slots = getEligibleSlotsForAugmentation(initialPlayer, initialMaterial);
            if (slots.length > 0) {
              setSelectedSlot(slots[0]);
              setAugmentTomeWeapon(false);
            } else if (needsTomeWeaponAugmentation(initialPlayer)) {
              setSelectedSlot(null);
              setAugmentTomeWeapon(true);
            } else {
              setSelectedSlot(null);
              setAugmentTomeWeapon(false);
            }
          } else {
            // Twine/Glaze
            const slots = getEligibleSlotsForAugmentation(initialPlayer, initialMaterial);
            setSelectedSlot(slots.length > 0 ? slots[0] : null);
            setAugmentTomeWeapon(false);
          }
        } else {
          setSelectedSlot(null);
          setAugmentTomeWeapon(false);
        }
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
    // Determine if gear should be updated
    const shouldUpdateGear = updateGear && hasEligibleOptions && groupId && tierId;

    // Calculate the new slotAugmented value for the entry
    const newSlotAugmented = shouldUpdateGear
      ? (augmentTomeWeapon ? 'tome_weapon' : selectedSlot)
      : null;

    try {
      if (isEditMode && onUpdate && editEntry) {
        const tierStore = useTierStore.getState();
        const player = players.find((p) => p.id === selectedPlayer);
        const oldRecipient = players.find((p) => p.id === editEntry.recipientPlayerId);
        const recipientChanged = selectedPlayer !== editEntry.recipientPlayerId;
        const oldSlot = editEntry.slotAugmented;

        // Update the material entry with new slotAugmented
        await onUpdate({
          weekNumber,
          floor: selectedFloor,
          materialType: selectedMaterial,
          recipientPlayerId: selectedPlayer,
          slotAugmented: newSlotAugmented,
          notes: notes.trim() || undefined,
        });

        // Handle gear updates
        if (player) {
          // Special handling for universal_tomestone (marks hasItem, not augmentation)
          if (editEntry.materialType === 'universal_tomestone' && !recipientChanged && oldRecipient) {
            if (shouldUpdateGear) {
              // Ensure tome weapon is marked as obtained
              if (!oldRecipient.tomeWeapon.hasItem) {
                await tierStore.updatePlayer(groupId!, tierId!, selectedPlayer, {
                  tomeWeapon: { ...oldRecipient.tomeWeapon, hasItem: true },
                });
              }
            } else {
              // User unchecked the box - revert tome weapon to not obtained
              // Note: Only reset hasItem, NOT isAugmented - augmentation is controlled by solvent
              if (oldRecipient.tomeWeapon.hasItem) {
                await tierStore.updatePlayer(groupId!, tierId!, selectedPlayer, {
                  tomeWeapon: { ...oldRecipient.tomeWeapon, hasItem: false },
                });
              }
            }
          } else if (shouldUpdateGear) {
            // Step 1: Revert old augmentation if slot changed AND same recipient
            // (Don't touch old recipient's gear if recipient changed - that was valid)
            if (!recipientChanged && oldRecipient && oldSlot && oldSlot !== newSlotAugmented) {
              if (oldSlot === 'tome_weapon') {
                // Revert tome weapon augmentation
                if (oldRecipient.tomeWeapon.isAugmented) {
                  await tierStore.updatePlayer(groupId!, tierId!, oldRecipient.id, {
                    tomeWeapon: { ...oldRecipient.tomeWeapon, isAugmented: false },
                  });
                }
              } else {
                // Revert gear slot augmentation
                const updatedGear = oldRecipient.gear.map((g) =>
                  g.slot === oldSlot ? { ...g, isAugmented: false } : g
                );
                await tierStore.updatePlayer(groupId!, tierId!, oldRecipient.id, { gear: updatedGear });
              }
            }

            // Step 2: Apply new augmentation to the (potentially new) recipient
            // Re-fetch player state after potential revert
            const freshPlayer = useTierStore.getState().currentTier?.players?.find((p) => p.id === selectedPlayer) || player;

            if (selectedMaterial === 'universal_tomestone' && needsTomeWeaponItem(freshPlayer)) {
              await tierStore.updatePlayer(groupId!, tierId!, selectedPlayer, {
                tomeWeapon: { ...freshPlayer.tomeWeapon, hasItem: true },
              });
            } else if (selectedMaterial === 'solvent') {
              if (augmentTomeWeapon && needsTomeWeaponAugmentation(freshPlayer)) {
                await tierStore.updatePlayer(groupId!, tierId!, selectedPlayer, {
                  tomeWeapon: { ...freshPlayer.tomeWeapon, isAugmented: true },
                });
              } else if (selectedSlot) {
                const updatedGear = freshPlayer.gear.map((g) =>
                  g.slot === selectedSlot ? { ...g, isAugmented: true } : g
                );
                await tierStore.updatePlayer(groupId!, tierId!, selectedPlayer, { gear: updatedGear });
              }
            } else if (selectedSlot) {
              const updatedGear = freshPlayer.gear.map((g) =>
                g.slot === selectedSlot ? { ...g, isAugmented: true } : g
              );
              await tierStore.updatePlayer(groupId!, tierId!, selectedPlayer, { gear: updatedGear });
            }
          }
        }
        toast.success('Material entry updated');
      } else if (shouldUpdateGear) {
        // Add mode with gear update: use coordination function
        await logMaterialAndUpdateGear(
          groupId!,
          tierId!,
          {
            weekNumber,
            floor: selectedFloor,
            materialType: selectedMaterial,
            recipientPlayerId: selectedPlayer,
            notes: notes.trim() || undefined,
          },
          {
            updateGear: true,
            slotToAugment: selectedSlot ? selectedSlot : undefined,
            augmentTomeWeapon,
          }
        );
        toast.success('Material entry logged');
      } else {
        // Add mode without gear update: call onSubmit
        await onSubmit({
          weekNumber,
          floor: selectedFloor,
          materialType: selectedMaterial,
          recipientPlayerId: selectedPlayer,
          notes: notes.trim() || undefined,
        });
      }
      onClose();
    } catch (error) {
      // Always log and show error - coordination path and onSubmit/onUpdate errors
      // should both provide user feedback
      console.error('Material log error:', error);
      toast.error('Failed to log material');
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

  // Build floor options for Select - only include floors that have materials, with floor colors
  const floorOptions = floors
    .filter((floor) => getMaterialsForFloor(floor).length > 0)
    .map((floor) => {
      const floorNum = parseFloorName(floor);
      const floorColor = FLOOR_COLORS[floorNum];
      return {
        value: floor,
        label: floor,
        textClassName: floorColor.text,
      };
    });

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {isEditMode ? <Pencil className="w-5 h-5" /> : <Gem className="w-5 h-5" />}
          {isEditMode ? 'Edit Material Entry' : 'Log Material'}
        </span>
      }
    >
      <div className="space-y-4">
        {/* Week + Floor row (matching loot modal layout) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="week">Week</Label>
            <NumberInput
              value={weekNumber}
              onChange={(val) => setWeekNumber(val ?? 1)}
              min={1}
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
                const isSelected = selectedMaterial === material;
                // Material color classes from design system
                const materialColors: Record<MaterialType, { text: string; bg: string; border: string }> = {
                  twine: { text: 'text-material-twine', bg: 'bg-material-twine/20', border: 'border-material-twine/50' },
                  glaze: { text: 'text-material-glaze', bg: 'bg-material-glaze/20', border: 'border-material-glaze/50' },
                  solvent: { text: 'text-material-solvent', bg: 'bg-material-solvent/20', border: 'border-material-solvent/50' },
                  universal_tomestone: { text: 'text-material-tomestone', bg: 'bg-material-tomestone/20', border: 'border-material-tomestone/50' },
                };
                const colors = materialColors[material];
                return (
                  <button
                    key={material}
                    type="button"
                    onClick={() => setSelectedMaterial(material)}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      isSelected
                        ? `${colors.bg} ${colors.text} ${colors.border}`
                        : 'bg-surface-interactive border-border-default text-text-secondary hover:text-text-primary hover:border-border-subtle'
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
            <Label htmlFor="recipient" className="mb-0 hidden sm:block">Recipient</Label>
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

        {/* Gear update option */}
        {hasEligibleOptions && groupId && tierId && (
          <div className="space-y-2">
            {/* Universal Tomestone: mark tome weapon as have */}
            {selectedMaterial === 'universal_tomestone' && eligibleOptions.canMarkTomeWeaponHave && (
              <Checkbox
                checked={updateGear}
                onChange={setUpdateGear}
                label="Also mark tome weapon as obtained"
              />
            )}

            {/* Solvent: choose between tome weapon or gear slot */}
            {selectedMaterial === 'solvent' && (eligibleOptions.canAugmentTomeWeapon || eligibleOptions.slots.length > 0) && (
              <>
                <Checkbox
                  checked={updateGear}
                  onChange={setUpdateGear}
                  label="Also mark gear as augmented"
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
                        { value: 'tome_weapon', label: 'Tome Weapon', icon: <img alt="" className="w-4 h-4 brightness-[3.0]" src={GEAR_SLOT_ICONS.weapon} /> },
                        ...eligibleOptions.slots.map((slot) => ({
                          value: slot,
                          label: GEAR_SLOT_NAMES[slot],
                          icon: <img alt="" className="w-4 h-4 brightness-[3.0]" src={GEAR_SLOT_ICONS[slot]} />,
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
                        icon: <img alt="" className="w-4 h-4 brightness-[3.0]" src={GEAR_SLOT_ICONS[slot]} />,
                      }))}
                    />
                  </div>
                )}
              </>
            )}

            {/* Twine/Glaze: gear slot dropdown */}
            {selectedMaterial !== 'universal_tomestone' && selectedMaterial !== 'solvent' && eligibleOptions.slots.length > 0 && (
              <>
                <Checkbox
                  checked={updateGear}
                  onChange={setUpdateGear}
                  label="Also mark gear as augmented"
                />
                {updateGear && (
                  <div>
                    <Select
                      value={selectedSlot || ''}
                      onChange={(val) => setSelectedSlot(val as GearSlot)}
                      options={eligibleOptions.slots.map((slot) => ({
                        value: slot,
                        label: GEAR_SLOT_NAMES[slot],
                        icon: <img alt="" className="w-4 h-4 brightness-[3.0]" src={GEAR_SLOT_ICONS[slot]} />,
                      }))}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

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
      <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-border-default">
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
