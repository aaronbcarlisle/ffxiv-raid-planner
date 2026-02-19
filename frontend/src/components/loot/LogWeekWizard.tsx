/**
 * Log Week Wizard
 *
 * Multi-step wizard for logging an entire week's worth of loot drops.
 * Streamlines the process of recording gear drops, materials, and book clears.
 *
 * Design matches the SetupWizard for consistency.
 *
 * NOTE: Future enhancement consideration - "Edit Mode"
 * Currently, if a user opens the wizard for a week that already has logged loot,
 * it shows fresh priority suggestions rather than the existing logged entries.
 * This can lead to duplicate entries if a user accidentally logs the same week twice.
 * A future improvement could detect existing entries and switch to an "Edit Week Log"
 * mode that shows already-logged recipients with the ability to swap them out.
 * For now, users can manually edit/delete duplicate entries from the loot log,
 * or use the Reset options to clear and re-log.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Package,
  Book,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader2,
  Gem,
} from 'lucide-react';
import { Modal, Select, Label, Toggle } from '../ui';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import { toast } from '../../stores/toastStore';
import { logLootAndUpdateGear } from '../../utils/lootCoordination';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { getPriorityForItem, getPriorityForRing, getPriorityForUpgradeMaterial, getPriorityForUniversalTomestone } from '../../utils/priority';
import { FLOOR_LOOT_TABLES, FLOOR_COLORS, UPGRADE_MATERIAL_DISPLAY_NAMES, isSlotAugmentationMaterial, type FloorNumber, type UpgradeMaterialType } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES, GEAR_SLOT_ICONS, type GearSlot, type MaterialType } from '../../types';
import {
  getEligibleSlotsForAugmentation,
  needsTomeWeaponAugmentation,
  logMaterialAndUpdateGear,
} from '../../utils/materialCoordination';
import type { SnapshotPlayer, StaticSettings, LootLogEntry, LootLogEntryCreate, MarkFloorClearedRequest } from '../../types';

// Wizard steps
type WizardStep = 'gear' | 'books' | 'confirm';

const STEP_TITLES: Record<WizardStep, string> = {
  gear: 'Gear Drops',
  books: 'Books',
  confirm: 'Confirm',
};

const STEP_ORDER: WizardStep[] = ['gear', 'books', 'confirm'];

interface SlotEntry {
  slot: string;
  playerId: string | null;
  previousPlayerId?: string | null; // Remember last selection when toggling off
  didNotDrop: boolean;
  updateGear: boolean;
  // Material-specific fields
  selectedSlot?: GearSlot | null; // For twine/glaze/solvent: which gear slot to augment
  augmentTomeWeapon?: boolean; // For solvent: augment tome weapon instead of gear
}

interface FloorEntries {
  gear: Record<string, SlotEntry>;
  materials: Record<string, SlotEntry>;
  booksCleared: string[]; // Player IDs who cleared
}

interface LogWeekWizardProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  settings: StaticSettings;
  floors: string[];
  currentWeek: number;
  lootLog?: LootLogEntry[];
  materialLog?: import('../../types').MaterialLogEntry[];
  onSuccess?: () => void;
  /** Single floor mode - only log specified floor, skip floor tabs */
  singleFloorMode?: boolean;
  /** Initial floor to select (used in single floor mode) */
  initialFloor?: FloorNumber;
}

export function LogWeekWizard({
  isOpen,
  onClose,
  groupId,
  tierId,
  players,
  settings,
  floors,
  currentWeek,
  lootLog: _lootLog = [],
  materialLog = [],
  onSuccess,
  singleFloorMode = false,
  initialFloor = 1,
}: LogWeekWizardProps) {
  const [step, setStep] = useState<WizardStep>('gear');
  const [selectedFloor, setSelectedFloor] = useState<FloorNumber>(singleFloorMode ? initialFloor : 1);
  const [floorData, setFloorData] = useState<Record<FloorNumber, FloorEntries>>({} as Record<FloorNumber, FloorEntries>);
  const [clearedFloors, setClearedFloors] = useState<Set<FloorNumber>>(
    singleFloorMode ? new Set([initialFloor]) : new Set([1, 2, 3, 4])
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { markFloorCleared } = useLootTrackingStore();

  // Configured main roster players
  const mainRosterPlayers = useMemo(() => {
    return players.filter((p) => p.configured && !p.isSubstitute);
  }, [players]);

  // Get priority-ordered players for a slot (top 3 + others)
  const getPriorityPlayers = useCallback(
    (slot: GearSlot) => {
      const entries = slot === 'ring1' || slot === 'ring2'
        ? getPriorityForRing(mainRosterPlayers, settings)
        : getPriorityForItem(mainRosterPlayers, slot, settings);
      return entries;
    },
    [mainRosterPlayers, settings]
  );

  // Build recipient options with job icons and priority labels (matching QuickLogDropModal)
  const getRecipientOptions = useCallback(
    (slot: GearSlot) => {
      const priorityEntries = getPriorityPlayers(slot);
      const priorityMap = new Map(priorityEntries.map((e, i) => [e.player.id, i + 1]));
      const anyoneNeedsItem = priorityEntries.length > 0;

      const getPriorityLabel = (priority: number | undefined): string => {
        if (!priority) return '';
        if (priority === 1) return ' - Top Priority';
        if (priority === 2) return ' - 2nd Priority';
        if (priority === 3) return ' - 3rd Priority';
        return '';
      };

      // Sort: priority players first, then others alphabetically
      const sorted = [...mainRosterPlayers].sort((a, b) => {
        const aPriority = priorityMap.get(a.id);
        const bPriority = priorityMap.get(b.id);
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;
        if (aPriority && bPriority) return aPriority - bPriority;
        return a.name.localeCompare(b.name);
      });

      return [
        { value: '', label: anyoneNeedsItem ? 'Select player...' : '(Free for All)', icon: undefined },
        ...sorted.map((player) => ({
          value: player.id,
          label: `${player.name}${getPriorityLabel(priorityMap.get(player.id))}`,
          icon: <JobIcon job={player.job} size="sm" />,
        })),
      ];
    },
    [mainRosterPlayers, getPriorityPlayers]
  );

  // Get suggested player for a slot (highest priority who needs it)
  const getSuggestedPlayer = useCallback(
    (slot: GearSlot): string | null => {
      const entries = getPriorityPlayers(slot);
      return entries[0]?.player.id || null;
    },
    [getPriorityPlayers]
  );

  // Get suggested player for a material (highest priority who needs it)
  const getSuggestedMaterialPlayer = useCallback(
    (material: UpgradeMaterialType): { playerId: string | null; selectedSlot: GearSlot | null; augmentTomeWeapon: boolean } => {
      const priorityEntries = isSlotAugmentationMaterial(material)
        ? getPriorityForUpgradeMaterial(mainRosterPlayers, material, settings, materialLog)
        : getPriorityForUniversalTomestone(mainRosterPlayers, settings, materialLog);

      if (priorityEntries.length === 0) {
        return { playerId: null, selectedSlot: null, augmentTomeWeapon: false };
      }

      const topPlayer = priorityEntries[0].player;
      let selectedSlot: GearSlot | null = null;
      let augmentTomeWeapon = false;

      if (isSlotAugmentationMaterial(material)) {
        const eligibleSlots = getEligibleSlotsForAugmentation(topPlayer, material);
        if (material === 'solvent') {
          if (eligibleSlots.length > 0) {
            selectedSlot = eligibleSlots[0];
          } else if (needsTomeWeaponAugmentation(topPlayer)) {
            augmentTomeWeapon = true;
          }
        } else {
          selectedSlot = eligibleSlots.length > 0 ? eligibleSlots[0] : null;
        }
      }

      return { playerId: topPlayer.id, selectedSlot, augmentTomeWeapon };
    },
    [mainRosterPlayers, settings, materialLog]
  );

  // Initialize floor data with suggested players (including materials)
  const initFloorData = useCallback((): Record<FloorNumber, FloorEntries> => {
    const data: Record<FloorNumber, FloorEntries> = {} as Record<FloorNumber, FloorEntries>;
    for (let i = 1; i <= 4; i++) {
      const floorNum = i as FloorNumber;
      const lootTable = FLOOR_LOOT_TABLES[floorNum];
      if (!lootTable) continue;

      const gear: Record<string, SlotEntry> = {};
      const materials: Record<string, SlotEntry> = {};

      // Initialize gear slots with suggested player pre-selected
      lootTable.gearDrops.forEach((slot) => {
        const suggestedPlayer = getSuggestedPlayer(slot);
        gear[slot] = {
          slot,
          playerId: suggestedPlayer,
          didNotDrop: false,
          updateGear: true,
        };
      });

      // Initialize material slots with suggested player pre-selected
      lootTable.upgradeMaterials.forEach((material) => {
        const suggestion = getSuggestedMaterialPlayer(material);
        materials[material] = {
          slot: material,
          playerId: suggestion.playerId,
          didNotDrop: false,
          updateGear: true,
          selectedSlot: suggestion.selectedSlot,
          augmentTomeWeapon: suggestion.augmentTomeWeapon,
        };
      });

      // In single floor mode, pre-select all players for that floor's books
      const booksCleared = singleFloorMode && floorNum === initialFloor
        ? mainRosterPlayers.map((p) => p.id)
        : [];

      data[floorNum] = { gear, materials, booksCleared };
    }
    return data;
  }, [getSuggestedPlayer, getSuggestedMaterialPlayer, singleFloorMode, initialFloor, mainRosterPlayers]);

  // Reset state when modal opens (only on open transition, not while already open)
  // Use ref to track previous state to avoid resetting while modal is open
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Modal is opening - reset state
      setStep('gear');
      setSelectedFloor(singleFloorMode ? initialFloor : 1);
      setFloorData(initFloorData());
      setClearedFloors(singleFloorMode ? new Set([initialFloor]) : new Set([1, 2, 3, 4]));
      setError(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initFloorData, singleFloorMode, initialFloor]);

  // Handle slot assignment change
  const handleSlotChange = useCallback(
    (floorNum: FloorNumber, type: 'gear' | 'materials', slot: string, playerId: string | null) => {
      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        const slots = { ...floor[type] };
        slots[slot] = { ...slots[slot], playerId, didNotDrop: false };
        return { ...prev, [floorNum]: { ...floor, [type]: slots } };
      });
    },
    []
  );

  // Handle did not drop toggle - persists player selection
  const handleDidNotDrop = useCallback(
    (floorNum: FloorNumber, type: 'gear' | 'materials', slot: string, didNotDrop: boolean) => {
      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        const slots = { ...floor[type] };
        const currentEntry = slots[slot];

        if (didNotDrop) {
          // Turning OFF: save current player before clearing
          slots[slot] = {
            ...currentEntry,
            didNotDrop: true,
            previousPlayerId: currentEntry.playerId,
            playerId: null,
          };
        } else {
          // Turning ON: restore previous player or fall back to suggested
          const restoredPlayerId = currentEntry.previousPlayerId !== undefined
            ? currentEntry.previousPlayerId
            : (type === 'gear'
              ? getSuggestedPlayer(slot as GearSlot)
              : getSuggestedMaterialPlayer(slot as UpgradeMaterialType).playerId);
          slots[slot] = {
            ...currentEntry,
            didNotDrop: false,
            playerId: restoredPlayerId,
          };
        }

        return { ...prev, [floorNum]: { ...floor, [type]: slots } };
      });
    },
    [getSuggestedPlayer, getSuggestedMaterialPlayer]
  );

  // Handle book clear toggle
  const handleBookToggle = useCallback(
    (floorNum: FloorNumber, playerId: string, cleared: boolean) => {
      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        const booksCleared = cleared
          ? [...floor.booksCleared, playerId]
          : floor.booksCleared.filter((id) => id !== playerId);
        return { ...prev, [floorNum]: { ...floor, booksCleared } };
      });
    },
    []
  );

  // Select/clear all books for a floor
  const handleSelectAllBooks = useCallback(
    (floorNum: FloorNumber) => {
      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        return { ...prev, [floorNum]: { ...floor, booksCleared: mainRosterPlayers.map((p) => p.id) } };
      });
    },
    [mainRosterPlayers]
  );

  const handleClearAllBooks = useCallback(
    (floorNum: FloorNumber) => {
      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        return { ...prev, [floorNum]: { ...floor, booksCleared: [] } };
      });
    },
    []
  );

  // Toggle floor cleared status
  const toggleFloorCleared = useCallback(
    (floorNum: FloorNumber, cleared: boolean) => {
      setClearedFloors((prev) => {
        const next = new Set(prev);
        if (cleared) {
          next.add(floorNum);
        } else {
          next.delete(floorNum);
          // If unchecking the currently selected floor, switch to another checked floor
          if (selectedFloor === floorNum) {
            const remainingFloors = Array.from(next).sort((a, b) => a - b);
            if (remainingFloors.length > 0) {
              setSelectedFloor(remainingFloors[0]);
            }
          }
        }
        return next;
      });
    },
    [selectedFloor]
  );

  // Toggle all slots as "no drops" for a floor
  const toggleAllNoDrops = useCallback(
    (floorNum: FloorNumber) => {
      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        const gear = { ...floor.gear };
        const materials = { ...floor.materials };

        // Check if all are currently marked as no-drop
        const allGearNoDrops = Object.values(gear).every((e) => e.didNotDrop);
        const allMaterialNoDrops = Object.values(materials).every((e) => e.didNotDrop);
        const allNoDrops = allGearNoDrops && allMaterialNoDrops;

        // Toggle: if all are no-drop, restore them; otherwise mark all as no-drop
        for (const slot of Object.keys(gear)) {
          if (allNoDrops) {
            // Restore from previous or suggested
            const restoredPlayerId = gear[slot].previousPlayerId !== undefined
              ? gear[slot].previousPlayerId
              : getSuggestedPlayer(slot as GearSlot);
            gear[slot] = { ...gear[slot], didNotDrop: false, playerId: restoredPlayerId };
          } else {
            // Mark as no drop, save current selection
            gear[slot] = { ...gear[slot], didNotDrop: true, previousPlayerId: gear[slot].playerId, playerId: null };
          }
        }

        for (const matType of Object.keys(materials)) {
          if (allNoDrops) {
            // Restore from previous or suggested
            const restoredPlayerId = materials[matType].previousPlayerId !== undefined
              ? materials[matType].previousPlayerId
              : getSuggestedMaterialPlayer(matType as UpgradeMaterialType).playerId;
            materials[matType] = { ...materials[matType], didNotDrop: false, playerId: restoredPlayerId };
          } else {
            // Mark as no drop, save current selection
            materials[matType] = { ...materials[matType], didNotDrop: true, previousPlayerId: materials[matType].playerId, playerId: null };
          }
        }

        return { ...prev, [floorNum]: { ...floor, gear, materials } };
      });
    },
    [getSuggestedPlayer, getSuggestedMaterialPlayer]
  );

  // Get priority-based options for materials
  const getMaterialRecipientOptions = useCallback(
    (material: UpgradeMaterialType) => {
      const priorityEntries = isSlotAugmentationMaterial(material)
        ? getPriorityForUpgradeMaterial(mainRosterPlayers, material, settings, materialLog)
        : getPriorityForUniversalTomestone(mainRosterPlayers, settings, materialLog);

      const priorityMap = new Map(priorityEntries.map((e, i) => [e.player.id, i + 1]));
      const anyoneNeedsMaterial = priorityEntries.length > 0;

      const getPriorityLabel = (priority: number | undefined): string => {
        if (!priority) return '';
        if (priority === 1) return ' - Top Priority';
        if (priority === 2) return ' - 2nd Priority';
        if (priority === 3) return ' - 3rd Priority';
        return '';
      };

      // Sort: priority players first, then others alphabetically
      const sorted = [...mainRosterPlayers].sort((a, b) => {
        const aPriority = priorityMap.get(a.id);
        const bPriority = priorityMap.get(b.id);
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;
        if (aPriority && bPriority) return aPriority - bPriority;
        return a.name.localeCompare(b.name);
      });

      return [
        { value: '', label: anyoneNeedsMaterial ? 'Select player...' : '(No one needs this)', icon: undefined },
        ...sorted.map((player) => ({
          value: player.id,
          label: `${player.name}${getPriorityLabel(priorityMap.get(player.id))}`,
          icon: <JobIcon job={player.job} size="sm" />,
        })),
      ];
    },
    [mainRosterPlayers, settings, materialLog]
  );

  // Handle material player change - also update eligible slots
  const handleMaterialPlayerChange = useCallback(
    (floorNum: FloorNumber, materialType: string, playerId: string | null) => {
      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        const materials = { ...floor.materials };
        const entry = { ...materials[materialType], playerId, didNotDrop: false };

        // Auto-select first eligible slot when player changes
        if (playerId && isSlotAugmentationMaterial(materialType as MaterialType)) {
          const player = mainRosterPlayers.find((p) => p.id === playerId);
          if (player) {
            const eligibleSlots = getEligibleSlotsForAugmentation(player, materialType as MaterialType);
            if (materialType === 'solvent') {
              // For solvent, prefer tome weapon if no slots available
              if (eligibleSlots.length > 0) {
                entry.selectedSlot = eligibleSlots[0];
                entry.augmentTomeWeapon = false;
              } else if (needsTomeWeaponAugmentation(player)) {
                entry.selectedSlot = null;
                entry.augmentTomeWeapon = true;
              } else {
                entry.selectedSlot = null;
                entry.augmentTomeWeapon = false;
              }
            } else {
              entry.selectedSlot = eligibleSlots.length > 0 ? eligibleSlots[0] : null;
              entry.augmentTomeWeapon = false;
            }
            entry.updateGear = true;
          }
        } else {
          entry.selectedSlot = null;
          entry.augmentTomeWeapon = false;
          entry.updateGear = true;
        }

        materials[materialType] = entry;
        return { ...prev, [floorNum]: { ...floor, materials } };
      });
    },
    [mainRosterPlayers]
  );

  // Handle material slot selection change
  const handleMaterialSlotChange = useCallback(
    (floorNum: FloorNumber, materialType: string, slotValue: string) => {
      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        const materials = { ...floor.materials };
        const entry = { ...materials[materialType] };

        if (slotValue === 'tome_weapon') {
          entry.selectedSlot = null;
          entry.augmentTomeWeapon = true;
        } else {
          entry.selectedSlot = slotValue as GearSlot;
          entry.augmentTomeWeapon = false;
        }

        materials[materialType] = entry;
        return { ...prev, [floorNum]: { ...floor, materials } };
      });
    },
    []
  );

  // Calculate summary counts (only for cleared floors)
  const summary = useMemo(() => {
    let gearDrops = 0;
    let materialDrops = 0;
    let bookClears = 0;
    let skipped = 0;

    for (let i = 1; i <= 4; i++) {
      const floorNum = i as FloorNumber;
      if (!clearedFloors.has(floorNum)) continue;
      const floor = floorData[floorNum];
      if (!floor) continue;

      Object.values(floor.gear).forEach((entry) => {
        if (entry.playerId) gearDrops++;
        if (entry.didNotDrop) skipped++;
      });
      Object.values(floor.materials).forEach((entry) => {
        if (entry.playerId) materialDrops++;
        if (entry.didNotDrop) skipped++;
      });
      bookClears += floor.booksCleared.length;
    }

    return { gearDrops, materialDrops, bookClears, skipped, total: gearDrops + materialDrops + bookClears };
  }, [floorData, clearedFloors]);

  // Submit all entries
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const promises: Promise<void>[] = [];

      // Log gear and material drops (only for cleared floors)
      for (let floorNum = 1; floorNum <= 4; floorNum++) {
        const fn = floorNum as FloorNumber;
        if (!clearedFloors.has(fn)) continue;
        const floor = floorData[fn];
        if (!floor) continue;

        const floorName = floors[floorNum - 1];

        // Gear drops
        for (const [slot, entry] of Object.entries(floor.gear)) {
          if (entry.playerId && !entry.didNotDrop) {
            const data: LootLogEntryCreate = {
              recipientPlayerId: entry.playerId,
              itemSlot: slot,
              floor: floorName,
              weekNumber: currentWeek,
              method: 'drop',
            };
            promises.push(logLootAndUpdateGear(groupId, tierId, data, { updateGear: entry.updateGear }));
          }
        }

        // Material drops - use logMaterialAndUpdateGear for proper coordination
        for (const [materialType, entry] of Object.entries(floor.materials)) {
          if (entry.playerId && !entry.didNotDrop) {
            promises.push(
              logMaterialAndUpdateGear(
                groupId,
                tierId,
                {
                  weekNumber: currentWeek,
                  floor: floorName,
                  materialType: materialType as MaterialType,
                  recipientPlayerId: entry.playerId,
                },
                {
                  updateGear: entry.updateGear,
                  slotToAugment: entry.selectedSlot || undefined,
                  augmentTomeWeapon: entry.augmentTomeWeapon,
                }
              )
            );
          }
        }

        // Book clears - use MarkFloorClearedRequest
        if (floor.booksCleared.length > 0) {
          const clearRequest: MarkFloorClearedRequest = {
            weekNumber: currentWeek,
            floor: floorName,
            playerIds: floor.booksCleared,
          };
          promises.push(markFloorCleared(groupId, tierId, clearRequest));
        }
      }

      await Promise.all(promises);
      const toastMsg = singleFloorMode
        ? `Logged ${summary.total} entries for ${floors[initialFloor - 1]}!`
        : `Logged ${summary.total} entries for Week ${currentWeek}!`;
      toast.success(toastMsg);
      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to log entries';
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigation
  const stepIndex = STEP_ORDER.indexOf(step);
  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < STEP_ORDER.length - 1;
  const isLastStep = stepIndex === STEP_ORDER.length - 1;

  const goNext = () => {
    if (canGoNext) {
      setStep(STEP_ORDER[stepIndex + 1]);
    }
  };

  const goBack = () => {
    if (canGoBack) {
      setStep(STEP_ORDER[stepIndex - 1]);
    }
  };

  // Current floor data
  const currentFloorData = floorData[selectedFloor];
  const currentLootTable = FLOOR_LOOT_TABLES[selectedFloor];
  const currentFloorName = floors[selectedFloor - 1];

  // Progress indicator (matching WizardProgress style)
  const renderProgress = () => (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {STEP_ORDER.map((s, index) => {
        const isActive = s === step;
        const isCompleted = index < stepIndex;
        const isLast = index === STEP_ORDER.length - 1;

        return (
          <div key={s} className="flex items-center gap-1 sm:gap-2">
            <div className="flex flex-col items-center gap-1">
              {/* Step circle */}
              <div
                className={`
                  w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm
                  transition-all duration-300
                  ${
                    isCompleted
                      ? 'bg-accent text-accent-contrast'
                      : isActive
                      ? 'bg-accent/30 text-accent ring-2 ring-accent'
                      : 'bg-surface-elevated text-text-muted border border-border-default'
                  }
                `}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>

              {/* Step label */}
              <span
                className={`
                  text-[10px] sm:text-xs font-medium whitespace-nowrap
                  ${
                    isActive
                      ? 'text-accent'
                      : isCompleted
                      ? 'text-text-primary'
                      : 'text-text-muted'
                  }
                `}
              >
                {STEP_TITLES[s]}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={`
                  w-8 sm:w-12 h-0.5 transition-all duration-300 -mb-5
                  ${isCompleted ? 'bg-accent' : 'bg-border-default'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // Floor tabs (for gear step) - using floor colors from design system
  const renderFloorTabs = () => (
    <div className="flex gap-1 p-1 mb-4 rounded-lg bg-surface-elevated">
      {floors.map((name, i) => {
        const floorNum = (i + 1) as FloorNumber;
        const isActive = selectedFloor === floorNum;
        const isCleared = clearedFloors.has(floorNum);
        const floorColor = FLOOR_COLORS[floorNum];

        // Calculate items assigned for this floor
        const floor = floorData[floorNum];
        const gearAssigned = floor ? Object.values(floor.gear).filter((e) => e.playerId && !e.didNotDrop).length : 0;
        const materialsAssigned = floor ? Object.values(floor.materials).filter((e) => e.playerId && !e.didNotDrop).length : 0;
        const itemsAssigned = gearAssigned + materialsAssigned;

        return (
          <div
            key={floorNum}
            role="button"
            tabIndex={0}
            onClick={() => isCleared && setSelectedFloor(floorNum)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && isCleared) {
                e.preventDefault();
                setSelectedFloor(floorNum);
              }
            }}
            className={`
              flex-1 relative flex items-center px-2 py-2 rounded-md text-sm font-medium transition-colors
              ${isActive
                ? `${floorColor.bg} ${floorColor.text} ${floorColor.border} border`
                : isCleared
                  ? `${floorColor.text} hover:${floorColor.bg} opacity-70 hover:opacity-100 cursor-pointer`
                  : 'text-text-muted opacity-40'
              }
            `}
          >
            {/* Custom checkbox aligned to far left */}
            <div
              role="checkbox"
              aria-checked={isCleared}
              onClick={(e) => {
                e.stopPropagation();
                toggleFloorCleared(floorNum, !isCleared);
              }}
              className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center cursor-pointer border-2 transition-colors"
              style={{
                backgroundColor: isCleared ? floorColor.hex : 'transparent',
                borderColor: floorColor.hex,
              }}
            >
              {isCleared && (
                <Check className="w-4 h-4 text-surface-base" strokeWidth={3} />
              )}
            </div>
            {/* Floor name centered in the tab */}
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {name}
            </span>
            {/* Items assigned badge - positioned to the right */}
            {isCleared && itemsAssigned > 0 && (
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center text-surface-base"
                style={{
                  backgroundColor: floorColor.hex,
                }}
              >
                {itemsAssigned}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          {singleFloorMode ? `Log ${floors[initialFloor - 1]} (Week ${currentWeek})` : `Log Week ${currentWeek}`}
        </span>
      }
      size="4xl"
      className="bg-surface-card"
    >
      <div className="space-y-4">
        {/* Progress indicator */}
        <div className="pb-4 border-b border-border-default">
          {renderProgress()}
        </div>

        {/* Error display */}
        {error && (
          <div className="p-3 bg-status-error/10 border border-status-error/30 rounded text-status-error text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Step content - min-height only for input steps, not confirm */}
        <div className={step !== 'confirm' ? 'min-h-[350px]' : ''}>
          {/* Gear Drops Step */}
          {step === 'gear' && currentLootTable && currentFloorData && (
            <div className="space-y-4">
              {/* Floor tabs - hidden in single floor mode */}
              {!singleFloorMode && renderFloorTabs()}

              {/* Content area - vertical stack */}
              <div className="space-y-4">
                {/* Gear Section Card */}
                <div
                  className="rounded-lg border-l-4 bg-surface-elevated"
                  style={{ borderLeftColor: FLOOR_COLORS[selectedFloor].hex }}
                >
                  <div className="p-4">
                    {/* Section header with No Drops toggle */}
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        {singleFloorMode ? '' : `${currentFloorName} - `}Gear
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAllNoDrops(selectedFloor)}
                      >
                        {Object.values(currentFloorData.gear).every((e) => e.didNotDrop) &&
                         Object.values(currentFloorData.materials).every((e) => e.didNotDrop)
                          ? 'Restore All'
                          : 'No Drops'}
                      </Button>
                    </div>

                    {/* Slot rows */}
                    <div className="divide-y divide-border-subtle">
                      {currentLootTable.gearDrops.map((slot) => {
                        const entry = currentFloorData.gear[slot];
                        if (!entry) return null;
                        const slotName = GEAR_SLOT_NAMES[slot as GearSlot] || slot;
                        // Map ring1/ring2 to "ring" for the icon path
                        const iconSlot = slot === 'ring1' || slot === 'ring2' ? 'ring' : slot;

                        return (
                          <div
                            key={slot}
                            className="py-3 first:pt-0 last:pb-0"
                          >
                            {/* Main row: Name + Dropdown + Toggle */}
                            <div className="flex items-center gap-3">
                              {/* Name with gear icon - fixed width for alignment */}
                              <div className={`w-24 flex-shrink-0 flex items-center gap-2 ${entry.didNotDrop ? 'opacity-50' : ''}`}>
                                <img
                                  alt=""
                                  className="w-4 h-4 brightness-[3.0]"
                                  src={`/images/gear-slots/white/${iconSlot}.png`}
                                />
                                <span className="text-sm text-text-secondary">{slotName}</span>
                              </div>

                              {/* Dropdown - grows to fill space, disabled when toggled off */}
                              <div className={`flex-1 min-w-0 ${entry.didNotDrop ? 'opacity-60' : ''}`}>
                                <Select
                                  value={entry.playerId || ''}
                                  onChange={(v) => handleSlotChange(selectedFloor, 'gear', slot, v || null)}
                                  options={getRecipientOptions(slot as GearSlot)}
                                  disabled={entry.didNotDrop}
                                />
                              </div>

                              {/* Floor-colored toggle */}
                              <Toggle
                                checked={!entry.didNotDrop}
                                onChange={(checked) => handleDidNotDrop(selectedFloor, 'gear', slot, !checked)}
                                color={FLOOR_COLORS[selectedFloor].hex}
                                aria-label={`Toggle ${slotName} drop`}
                                size="sm"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Materials Section Card - only if floor has materials */}
                {Object.keys(currentFloorData.materials).length > 0 && (
                  <div
                    className="rounded-lg border-l-4 bg-surface-elevated"
                    style={{ borderLeftColor: FLOOR_COLORS[selectedFloor].hex }}
                  >
                    <div className="p-4">
                      {/* Section header */}
                      <h4 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                        <Gem className="w-4 h-4" />
                        {singleFloorMode ? '' : `${currentFloorName} - `}Materials
                      </h4>

                      {/* Material rows */}
                      <div className="divide-y divide-border-subtle">
                        {Object.entries(currentFloorData.materials).map(([materialType, entry]) => {
                          const materialName = UPGRADE_MATERIAL_DISPLAY_NAMES[materialType as UpgradeMaterialType] || materialType;
                          const selectedPlayer = mainRosterPlayers.find((p) => p.id === entry.playerId);
                          const isUniversalTomestone = materialType === 'universal_tomestone';

                          // Get eligible slots for the selected player
                          const eligibleSlots = selectedPlayer && isSlotAugmentationMaterial(materialType as MaterialType)
                            ? getEligibleSlotsForAugmentation(selectedPlayer, materialType as MaterialType)
                            : [];
                          const canAugmentTomeWeapon = selectedPlayer && materialType === 'solvent'
                            ? needsTomeWeaponAugmentation(selectedPlayer)
                            : false;
                          const hasEligibleOptions = eligibleSlots.length > 0 || canAugmentTomeWeapon;

                          // Shorter display name and color for materials (using design system)
                          const shortMaterialName = isUniversalTomestone ? 'U. Tome' : materialName;
                          const materialColorClass = materialType === 'twine' ? 'text-material-twine'
                            : materialType === 'glaze' ? 'text-material-glaze'
                            : materialType === 'solvent' ? 'text-material-solvent'
                            : 'text-material-tomestone';

                          return (
                            <div
                              key={materialType}
                              className="py-3 first:pt-0 last:pb-0"
                            >
                              {/* Main row */}
                              <div className="flex items-center gap-3">
                                {/* Name with material-specific color */}
                                <div className={`w-20 flex-shrink-0 ${entry.didNotDrop ? 'opacity-50' : ''}`}>
                                  <span className={`text-sm font-medium ${materialColorClass}`}>{shortMaterialName}</span>
                                </div>

                                {/* Dropdown area - disabled when toggled off */}
                                <div className={`flex-1 min-w-0 flex items-center gap-2 ${entry.didNotDrop ? 'opacity-60' : ''}`}>
                                  <div className="flex-1 min-w-0">
                                    <Select
                                      value={entry.playerId || ''}
                                      onChange={(v) => handleMaterialPlayerChange(selectedFloor, materialType, v || null)}
                                      options={getMaterialRecipientOptions(materialType as UpgradeMaterialType)}
                                      disabled={entry.didNotDrop}
                                    />
                                  </div>
                                  {/* Slot dropdown for materials with multiple options */}
                                  {!entry.didNotDrop && entry.playerId && hasEligibleOptions && (eligibleSlots.length > 1 || (eligibleSlots.length > 0 && canAugmentTomeWeapon)) && (
                                    <div className="w-32 flex-shrink-0">
                                      <Select
                                        value={entry.augmentTomeWeapon ? 'tome_weapon' : (entry.selectedSlot || '')}
                                        onChange={(val) => handleMaterialSlotChange(selectedFloor, materialType, val)}
                                        options={[
                                          ...(canAugmentTomeWeapon ? [{ value: 'tome_weapon', label: 'Tome Weapon', icon: <img alt="" className="w-4 h-4 brightness-[3.0]" src={GEAR_SLOT_ICONS.weapon} /> }] : []),
                                          ...eligibleSlots.map((slot) => ({
                                            value: slot,
                                            label: GEAR_SLOT_NAMES[slot],
                                            icon: <img alt="" className="w-4 h-4 brightness-[3.0]" src={GEAR_SLOT_ICONS[slot]} />,
                                          })),
                                        ]}
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Floor-colored toggle */}
                                <Toggle
                                  checked={!entry.didNotDrop}
                                  onChange={(checked) => handleDidNotDrop(selectedFloor, 'materials', materialType, !checked)}
                                  color={FLOOR_COLORS[selectedFloor].hex}
                                  aria-label={`Toggle ${materialName} drop`}
                                  size="sm"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Books Step */}
          {step === 'books' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">
                  {singleFloorMode
                    ? `Select which players cleared ${floors[initialFloor - 1]} this week.`
                    : 'Select which players cleared each floor this week to add their book entries.'}
                </p>
                {/* Select/Clear All Floors bulk options - only show in week mode */}
                {!singleFloorMode && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFloorData((prev) => {
                          const newData = { ...prev };
                          for (const floorNum of [1, 2, 3, 4] as FloorNumber[]) {
                            if (newData[floorNum]) {
                              newData[floorNum] = {
                                ...newData[floorNum],
                                booksCleared: mainRosterPlayers.map((p) => p.id),
                              };
                            }
                          }
                          return newData;
                        });
                      }}
                    >
                      Select All Floors
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFloorData((prev) => {
                          const newData = { ...prev };
                          for (const floorNum of [1, 2, 3, 4] as FloorNumber[]) {
                            if (newData[floorNum]) {
                              newData[floorNum] = {
                                ...newData[floorNum],
                                booksCleared: [],
                              };
                            }
                          }
                          return newData;
                        });
                      }}
                    >
                      Clear All Floors
                    </Button>
                  </div>
                )}
              </div>

              {floors.map((floorName, i) => {
                const floorNum = (i + 1) as FloorNumber;
                // In single floor mode, only show the initial floor
                // In week mode, only show floors that are checked/cleared
                if (singleFloorMode && floorNum !== initialFloor) return null;
                if (!singleFloorMode && !clearedFloors.has(floorNum)) return null;
                const floor = floorData[floorNum];
                if (!floor) return null;
                const floorColor = FLOOR_COLORS[floorNum];

                return (
                  <div key={floorName} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Book className="w-4 h-4" style={{ color: floorColor.hex }} />
                        <Label className="mb-0" style={{ color: floorColor.hex }}>{floorName}</Label>
                        <span className="text-xs text-text-muted">
                          ({floor.booksCleared.length} selected)
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectAllBooks(floorNum)}
                        >
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClearAllBooks(floorNum)}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {mainRosterPlayers.map((player) => {
                        const isSelected = floor.booksCleared.includes(player.id);
                        return (
                          <label
                            key={player.id}
                            className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                              isSelected ? '' : 'bg-surface-raised border-border-subtle hover:border-border-default'
                            }`}
                            style={isSelected ? {
                              backgroundColor: `${floorColor.hex}20`,
                              borderColor: `${floorColor.hex}4D`,
                            } : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleBookToggle(floorNum, player.id, e.target.checked)}
                              className="sr-only"
                            />
                            {player.job && <JobIcon job={player.job} size="sm" />}
                            <span
                              className="text-sm truncate"
                              style={{ color: isSelected ? floorColor.hex : undefined }}
                            >
                              {player.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Confirm Step */}
          {step === 'confirm' && (
            <div className="space-y-4">
              {/* Summary stats - horizontal bar */}
              <div className="flex items-center justify-between bg-surface-elevated rounded-lg border border-border-default p-3">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-accent" />
                    <span className="text-sm text-text-muted">Gear</span>
                    <span className="text-sm font-bold text-text-primary">{summary.gearDrops}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gem className="w-4 h-4 text-material-glaze" />
                    <span className="text-sm text-text-muted">Materials</span>
                    <span className="text-sm font-bold text-text-primary">{summary.materialDrops}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Book className="w-4 h-4 text-status-info" />
                    <span className="text-sm text-text-muted">Books</span>
                    <span className="text-sm font-bold text-text-primary">{summary.bookClears}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-4 border-l border-border-subtle">
                  <span className="text-sm text-text-secondary">Total</span>
                  <span className="text-lg font-bold text-accent">{summary.total}</span>
                </div>
              </div>

              {/* Per-floor detail cards - 2 column grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {floors.map((floorName, i) => {
                const floorNum = (i + 1) as FloorNumber;
                if (!clearedFloors.has(floorNum)) return null;
                const floor = floorData[floorNum];
                if (!floor) return null;
                const floorColor = FLOOR_COLORS[floorNum];

                const gearEntries = Object.entries(floor.gear)
                  .filter(([_, e]) => e.playerId && !e.didNotDrop)
                  .map(([slot, e]) => ({
                    slot,
                    player: mainRosterPlayers.find((p) => p.id === e.playerId),
                    updateGear: e.updateGear,
                  }));
                const materialEntries = Object.entries(floor.materials)
                  .filter(([_, e]) => e.playerId && !e.didNotDrop)
                  .map(([slot, e]) => ({
                    slot,
                    player: mainRosterPlayers.find((p) => p.id === e.playerId),
                    updateGear: e.updateGear,
                  }));

                const hasContent = gearEntries.length > 0 || materialEntries.length > 0 || floor.booksCleared.length > 0;
                if (!hasContent) return null;

                const allPlayersCleared = floor.booksCleared.length === mainRosterPlayers.length;

                return (
                  <div
                    key={floorName}
                    className="bg-surface-elevated rounded-lg border border-border-default p-3"
                  >
                    <h3
                      className="text-sm font-medium mb-2 flex items-center gap-2"
                      style={{ color: floorColor.hex }}
                    >
                      <div
                        className="w-1.5 h-3.5 rounded-sm"
                        style={{ backgroundColor: floorColor.hex }}
                      />
                      {floorName}
                    </h3>

                    <div className="space-y-2">
                      {/* Gear drops */}
                      {gearEntries.length > 0 && (
                        <div className="space-y-1">
                          {gearEntries.map(({ slot, player, updateGear }) => (
                            <div key={slot} className="flex justify-between items-center text-xs">
                              <span className="text-text-muted">
                                {GEAR_SLOT_NAMES[slot as GearSlot]}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {player?.job && <JobIcon job={player.job} size="xs" />}
                                <span className="font-medium text-text-primary">
                                  {player?.name || '?'}
                                </span>
                                {updateGear && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-status-success/20 text-status-success">
                                    +gear
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Materials */}
                      {materialEntries.length > 0 && (
                        <div className={`space-y-1 ${gearEntries.length > 0 ? 'pt-1.5 border-t border-border-subtle' : ''}`}>
                          {materialEntries.map(({ slot, player, updateGear }) => {
                            const displayName = slot === 'universal_tomestone'
                              ? 'U. Tomestone'
                              : UPGRADE_MATERIAL_DISPLAY_NAMES[slot as UpgradeMaterialType];
                            const materialColorClass = slot === 'twine' ? 'text-material-twine'
                              : slot === 'glaze' ? 'text-material-glaze'
                              : slot === 'solvent' ? 'text-material-solvent'
                              : 'text-material-tomestone';
                            return (
                              <div key={slot} className="flex justify-between items-center text-xs">
                                <span className={materialColorClass}>
                                  {displayName}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {player?.job && <JobIcon job={player.job} size="xs" />}
                                  <span className="font-medium text-text-primary">
                                    {player?.name || '?'}
                                  </span>
                                  {updateGear && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-status-success/20 text-status-success">
                                      +aug
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Books */}
                      {floor.booksCleared.length > 0 && (
                        <div className={`${gearEntries.length > 0 || materialEntries.length > 0 ? 'pt-1.5 border-t border-border-subtle' : ''}`}>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted">Books</span>
                            <span className="text-text-secondary">
                              {allPlayersCleared ? (
                                'All players'
                              ) : (
                                <span className="flex items-center gap-1">
                                  {floor.booksCleared.slice(0, 4).map((playerId) => {
                                    const player = mainRosterPlayers.find((p) => p.id === playerId);
                                    return player?.job ? (
                                      <JobIcon key={playerId} job={player.job} size="xs" />
                                    ) : null;
                                  })}
                                  {floor.booksCleared.length > 4 && (
                                    <span className="text-text-muted">
                                      +{floor.booksCleared.length - 4}
                                    </span>
                                  )}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>

              {/* Skipped floors notice */}
              {!singleFloorMode && clearedFloors.size < 4 && (
                <div className="flex items-start gap-3 p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-text-secondary">
                    Skipped: {floors.filter((_, i) => !clearedFloors.has((i + 1) as FloorNumber)).join(', ')}
                  </div>
                </div>
              )}

              {summary.total === 0 && (
                <div className="flex items-start gap-3 p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-text-secondary">
                    No entries to log. Go back and add some drops or book clears.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-border-default">
          <Button
            variant="secondary"
            onClick={goBack}
            disabled={!canGoBack || isSubmitting}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
          >
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            {isLastStep ? (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={isSubmitting || summary.total === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Logging...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    {singleFloorMode ? `Log ${floors[initialFloor - 1]}` : `Log Week ${currentWeek}`}
                  </>
                )}
              </Button>
            ) : (
              <Button variant="primary" onClick={goNext}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
