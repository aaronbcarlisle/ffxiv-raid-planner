/**
 * Log Week Wizard
 *
 * Multi-step wizard for logging an entire week's worth of loot drops.
 * Streamlines the process of recording gear drops, materials, and book clears.
 *
 * Design matches the SetupWizard for consistency.
 *
 * LOG-1 (R-P0-9, R-P0-10): the wizard seeds from the week's loot and material
 * logs. A slot the week already holds as a DROP is locked — shown read-only,
 * skipped by every handler, "Restore All" and both submit filters — and the
 * seed re-runs when the in-modal week changes. Suggestions and the
 * Top/2nd/3rd labels come from the same ranking Queues uses
 * (`buildRecipientEntries` / `materialPriorityEntries`, with FloorCard's
 * enhanced-scoring gate), so the two surfaces can't disagree on who is next.
 * Still carried: a floor's books can be logged twice (no pageLedger here).
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Package,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Modal, NumberInput } from '../../ui';
import { Button } from '../../primitives';
import { JobIcon } from '../../ui/JobIcon';
import { toast } from '../../../stores/toastStore';
import { logLootAndUpdateGear } from '../../../utils/lootCoordination';
import { useLootTrackingStore } from '../../../stores/lootTrackingStore';
import { isPriorityDisabled } from '../../../utils/priority';
import { buildRecipientEntries } from '../../../utils/recipientRanking';
import { materialPriorityEntries } from '../materialSuggestion';
import { FLOOR_LOOT_TABLES, UPGRADE_MATERIAL_DISPLAY_NAMES, isSlotAugmentationMaterial, type UpgradeMaterialType } from '../../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES, type GearSlot, type MaterialType } from '../../../types';
import {
  getEligibleSlotsForAugmentation,
  needsTomeWeaponAugmentation,
  logMaterialAndUpdateGear,
} from '../../../utils/materialCoordination';
import type { SnapshotPlayer, StaticSettings, LootLogEntry, MaterialLogEntry, LootLogEntryCreate, MarkFloorClearedRequest } from '../../../types';
import { STEP_ORDER, STEP_TITLES, type WizardStep, type FloorNumber, type FloorEntries, type SlotEntry } from './types';
import { loggedSlotsForWeek } from './loggedSlots';
import { GearStep } from './GearStep';
import { BooksStep } from './BooksStep';
import { ConfirmStep } from './ConfirmStep';

interface LogWeekWizardProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  settings: StaticSettings;
  floors: string[];
  currentWeek: number;
  /** Maximum week number for the week selector (defaults to currentWeek) */
  maxWeek?: number;
  lootLog?: LootLogEntry[];
  materialLog?: MaterialLogEntry[];
  /** Called after successful submission. Receives the week number entries were logged to. */
  onSuccess?: (loggedWeek: number) => void;
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
  maxWeek: maxWeekProp,
  lootLog = [],
  materialLog = [],
  onSuccess,
  singleFloorMode = false,
  initialFloor = 1,
}: LogWeekWizardProps) {
  const [step, setStep] = useState<WizardStep>('gear');
  const [selectedFloor, setSelectedFloor] = useState<FloorNumber>(singleFloorMode ? initialFloor : 1);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const effectiveMaxWeek = Math.max(maxWeekProp ?? currentWeek, 1);
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

  // Queues' enhanced-scoring gate (FloorCard.tsx:86), computed the same way
  // so the wizard's #1 is Queues' #1 (R-P0-10).
  const enhancedActive = settings.enableEnhancedScoring === true && !isPriorityDisabled(settings) && lootLog.length > 0;

  // Priority-ordered needers for a slot — the ONE ranking Queues and the
  // RecipientPicker use. The wizard keys rings as `ring1`; the ranking and the
  // log key them as `ring`.
  const getPriorityPlayers = useCallback(
    (slot: GearSlot) =>
      buildRecipientEntries({
        players: mainRosterPlayers,
        slot: slot === 'ring1' ? 'ring' : slot,
        scope: 'priority',
        settings,
        lootLog,
        currentWeek: selectedWeek,
        enhancedActive,
      }),
    [mainRosterPlayers, settings, lootLog, selectedWeek, enhancedActive]
  );

  // Priority-ordered needers for a material — the ONE derivation FloorCard
  // and the weekly grid use (it applies the enhanced gate itself).
  const getMaterialPriorityPlayers = useCallback(
    (material: UpgradeMaterialType) =>
      materialPriorityEntries({
        material,
        players: mainRosterPlayers,
        settings,
        lootLog,
        materialLog,
        currentWeek: selectedWeek,
      }),
    [mainRosterPlayers, settings, lootLog, materialLog, selectedWeek]
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
      const priorityEntries = getMaterialPriorityPlayers(material);

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
    [getMaterialPriorityPlayers]
  );

  // Initialize floor data for a week: suggested players pre-selected, and any
  // slot the week's log already holds as a drop seeded LOCKED (R-P0-9).
  const initFloorData = useCallback((week: number): Record<FloorNumber, FloorEntries> => {
    const data: Record<FloorNumber, FloorEntries> = {} as Record<FloorNumber, FloorEntries>;
    const logged = loggedSlotsForWeek({ floors, week, lootLog, materialLog });
    for (let i = 1; i <= 4; i++) {
      const floorNum = i as FloorNumber;
      const lootTable = FLOOR_LOOT_TABLES[floorNum];
      if (!lootTable) continue;
      const floorLogged = logged[floorNum];

      const gear: Record<string, SlotEntry> = {};
      const materials: Record<string, SlotEntry> = {};

      // Gear slots: locked when already logged, otherwise the suggested player
      lootTable.gearDrops.forEach((slot) => {
        const existing = floorLogged.gear[slot];
        const alsoLogged = floorLogged.otherMethods[slot]?.map((e) => ({ recipientName: e.recipientPlayerName, method: e.method }));
        if (existing) {
          gear[slot] = {
            slot,
            playerId: null,
            didNotDrop: true,
            updateGear: true,
            locked: { recipientName: existing.recipientPlayerName, method: existing.method },
            alsoLogged,
          };
          return;
        }
        gear[slot] = {
          slot,
          playerId: getSuggestedPlayer(slot),
          didNotDrop: false,
          updateGear: true,
          alsoLogged,
        };
      });

      // Material slots: the same rule
      lootTable.upgradeMaterials.forEach((material) => {
        const existing = floorLogged.materials[material];
        const alsoLogged = floorLogged.materialOtherMethods[material]?.map((e) => ({ recipientName: e.recipientPlayerName, method: e.method }));
        if (existing) {
          materials[material] = {
            slot: material,
            playerId: null,
            didNotDrop: true,
            updateGear: true,
            locked: { recipientName: existing.recipientPlayerName, method: existing.method },
            alsoLogged,
          };
          return;
        }
        const suggestion = getSuggestedMaterialPlayer(material);
        materials[material] = {
          slot: material,
          playerId: suggestion.playerId,
          didNotDrop: false,
          updateGear: true,
          selectedSlot: suggestion.selectedSlot,
          augmentTomeWeapon: suggestion.augmentTomeWeapon,
          alsoLogged,
        };
      });

      // In single floor mode, pre-select all players for that floor's books
      const booksCleared = singleFloorMode && floorNum === initialFloor
        ? mainRosterPlayers.map((p) => p.id)
        : [];

      data[floorNum] = { gear, materials, booksCleared };
    }
    return data;
  }, [floors, lootLog, materialLog, getSuggestedPlayer, getSuggestedMaterialPlayer, singleFloorMode, initialFloor, mainRosterPlayers]);

  const wasOpenRef = useRef(false);
  const seededWeekRef = useRef(currentWeek);

  // Re-seed when the in-modal week changes while the modal is open: picks and
  // locks are per week. Declared BEFORE the open-transition effect so that, on
  // the commit that opens the modal, `wasOpenRef` is still false and this
  // effect yields to the open reset below. The `seededWeekRef` guard keeps a
  // lootLog/players change from re-seeding over the user's edits.
  useEffect(() => {
    if (!isOpen || !wasOpenRef.current) return;
    if (seededWeekRef.current === selectedWeek) return;
    seededWeekRef.current = selectedWeek;
    setFloorData(initFloorData(selectedWeek));
  }, [isOpen, selectedWeek, initFloorData]);

  // Reset state when modal opens (only on open transition, not while already open)
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setStep('gear');
      setSelectedFloor(singleFloorMode ? initialFloor : 1);
      setSelectedWeek(currentWeek);
      seededWeekRef.current = currentWeek;
      setFloorData(initFloorData(currentWeek));
      setClearedFloors(singleFloorMode ? new Set([initialFloor]) : new Set([1, 2, 3, 4]));
      setError(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initFloorData, singleFloorMode, initialFloor, currentWeek]);

  // Handle slot assignment change
  const handleSlotChange = useCallback(
    (floorNum: FloorNumber, type: 'gear' | 'materials', slot: string, playerId: string | null) => {
      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        const slots = { ...floor[type] };
        if (slots[slot]?.locked) return prev;
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
        if (currentEntry?.locked) return prev;

        if (didNotDrop) {
          slots[slot] = {
            ...currentEntry,
            didNotDrop: true,
            previousPlayerId: currentEntry.playerId,
            playerId: null,
          };
        } else {
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

  // Toggle all UNLOCKED slots as "no drops" for a floor, or restore them all.
  // Locked slots (already in the week's log) are skipped in both the check and
  // the change (V1): a restore must never resubmit one.
  const toggleAllNoDrops = useCallback(
    (floorNum: FloorNumber) => {
      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        const gear = { ...floor.gear };
        const materials = { ...floor.materials };

        const unlocked = [...Object.values(gear), ...Object.values(materials)].filter((e) => !e.locked);
        const allNoDrops = unlocked.length > 0 && unlocked.every((e) => e.didNotDrop);

        for (const slot of Object.keys(gear)) {
          if (gear[slot].locked) continue;
          if (allNoDrops) {
            const restoredPlayerId = gear[slot].previousPlayerId !== undefined
              ? gear[slot].previousPlayerId
              : getSuggestedPlayer(slot as GearSlot);
            gear[slot] = { ...gear[slot], didNotDrop: false, playerId: restoredPlayerId };
          } else {
            gear[slot] = { ...gear[slot], didNotDrop: true, previousPlayerId: gear[slot].playerId, playerId: null };
          }
        }

        for (const matType of Object.keys(materials)) {
          if (materials[matType].locked) continue;
          if (allNoDrops) {
            const restoredPlayerId = materials[matType].previousPlayerId !== undefined
              ? materials[matType].previousPlayerId
              : getSuggestedMaterialPlayer(matType as UpgradeMaterialType).playerId;
            materials[matType] = { ...materials[matType], didNotDrop: false, playerId: restoredPlayerId };
          } else {
            materials[matType] = { ...materials[matType], didNotDrop: true, previousPlayerId: materials[matType].playerId, playerId: null };
          }
        }

        return { ...prev, [floorNum]: { ...floor, gear, materials } };
      });
    },
    [getSuggestedPlayer, getSuggestedMaterialPlayer]
  );

  // Get priority-based options for materials (same ranking as the seeded pick)
  const getMaterialRecipientOptions = useCallback(
    (material: UpgradeMaterialType) => {
      const priorityEntries = getMaterialPriorityPlayers(material);

      const priorityMap = new Map(priorityEntries.map((e, i) => [e.player.id, i + 1]));
      const anyoneNeedsMaterial = priorityEntries.length > 0;

      const getPriorityLabel = (priority: number | undefined): string => {
        if (!priority) return '';
        if (priority === 1) return ' - Top Priority';
        if (priority === 2) return ' - 2nd Priority';
        if (priority === 3) return ' - 3rd Priority';
        return '';
      };

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
    [mainRosterPlayers, getMaterialPriorityPlayers]
  );

  // Handle material player change - also update eligible slots
  const handleMaterialPlayerChange = useCallback(
    (floorNum: FloorNumber, materialType: string, playerId: string | null) => {
      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        const materials = { ...floor.materials };
        if (materials[materialType]?.locked) return prev;
        const entry = { ...materials[materialType], playerId, didNotDrop: false };

        if (playerId && isSlotAugmentationMaterial(materialType as MaterialType)) {
          const player = mainRosterPlayers.find((p) => p.id === playerId);
          if (player) {
            const eligibleSlots = getEligibleSlotsForAugmentation(player, materialType as MaterialType);
            if (materialType === 'solvent') {
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
        if (materials[materialType]?.locked) return prev;
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
    let alreadyLogged = 0;

    for (let i = 1; i <= 4; i++) {
      const floorNum = i as FloorNumber;
      if (!clearedFloors.has(floorNum)) continue;
      const floor = floorData[floorNum];
      if (!floor) continue;

      for (const entry of [...Object.values(floor.gear), ...Object.values(floor.materials)]) {
        if (entry.locked) {
          alreadyLogged++;
          continue;
        }
        if (entry.playerId && !entry.didNotDrop) {
          if (entry.slot in floor.gear) gearDrops++;
          else materialDrops++;
        }
        if (entry.didNotDrop) skipped++;
      }
      bookClears += floor.booksCleared.length;
    }

    return { gearDrops, materialDrops, bookClears, skipped, alreadyLogged, total: gearDrops + materialDrops + bookClears };
  }, [floorData, clearedFloors]);

  // Submit all entries
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      interface TrackedEntry {
        promise: Promise<void>;
        label: string;
        source: { floor: FloorNumber; type: 'gear' | 'materials' | 'books'; slot?: string };
      }
      const tracked: TrackedEntry[] = [];

      for (let floorNum = 1; floorNum <= 4; floorNum++) {
        const fn = floorNum as FloorNumber;
        if (!clearedFloors.has(fn)) continue;
        const floor = floorData[fn];
        if (!floor) continue;

        const floorName = floors[floorNum - 1];

        // Gear drops (a locked slot is already in the week's log: never sent)
        for (const [slot, entry] of Object.entries(floor.gear)) {
          if (entry.playerId && !entry.didNotDrop && !entry.locked) {
            const playerName = mainRosterPlayers.find((p) => p.id === entry.playerId)?.name ?? 'Unknown';
            const slotName = GEAR_SLOT_NAMES[slot as GearSlot] || slot;
            const data: LootLogEntryCreate = {
              recipientPlayerId: entry.playerId,
              itemSlot: slot,
              floor: floorName,
              weekNumber: selectedWeek,
              method: 'drop',
            };
            tracked.push({
              promise: logLootAndUpdateGear(groupId, tierId, data, { updateGear: entry.updateGear }),
              label: `${slotName} → ${playerName}`,
              source: { floor: fn, type: 'gear', slot },
            });
          }
        }

        // Material drops (same lock rule)
        for (const [materialType, entry] of Object.entries(floor.materials)) {
          if (entry.playerId && !entry.didNotDrop && !entry.locked) {
            const playerName = mainRosterPlayers.find((p) => p.id === entry.playerId)?.name ?? 'Unknown';
            const matName = UPGRADE_MATERIAL_DISPLAY_NAMES[materialType as UpgradeMaterialType] || materialType;
            tracked.push({
              promise: logMaterialAndUpdateGear(
                groupId,
                tierId,
                {
                  weekNumber: selectedWeek,
                  floor: floorName,
                  materialType: materialType as MaterialType,
                  recipientPlayerId: entry.playerId,
                },
                {
                  updateGear: entry.updateGear,
                  slotToAugment: entry.selectedSlot || undefined,
                  augmentTomeWeapon: entry.augmentTomeWeapon,
                }
              ),
              label: `${matName} → ${playerName}`,
              source: { floor: fn, type: 'materials', slot: materialType },
            });
          }
        }

        // Book clears
        if (floor.booksCleared.length > 0) {
          const clearRequest: MarkFloorClearedRequest = {
            weekNumber: selectedWeek,
            floor: floorName,
            playerIds: floor.booksCleared,
          };
          tracked.push({
            promise: markFloorCleared(groupId, tierId, clearRequest),
            label: `${floorName} book clears`,
            source: { floor: fn, type: 'books' },
          });
        }
      }

      const results = await Promise.allSettled(tracked.map((t) => t.promise));
      const failed = results
        .map((r, i) => (r.status === 'rejected' ? tracked[i].label : null))
        .filter((label): label is string => label !== null);
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;

      if (failed.length === 0) {
        const toastMsg = singleFloorMode
          ? `Logged ${summary.total} entries for ${floors[initialFloor - 1]}!`
          : `Logged ${summary.total} entries for Week ${selectedWeek}!`;
        toast.success(toastMsg);
        onSuccess?.(selectedWeek);
        onClose();
      } else if (succeeded === 0) {
        const firstError = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
        const message = firstError.reason instanceof Error ? firstError.reason.message : 'Failed to log entries';
        setError(message);
        toast.error(message);
      } else {
        // Partial failure: LOCK the entries that succeeded (they are in the
        // week's log now) so a retry — or "Restore All" before it — can only
        // resubmit the failures.
        setFloorData((prev) => {
          const next = { ...prev };
          for (let i = 0; i < results.length; i++) {
            if (results[i].status !== 'fulfilled') continue;
            const { floor: fn, type, slot } = tracked[i].source;
            const floorCopy = { ...next[fn] };
            if (type === 'gear' && slot) {
              const gear = { ...floorCopy.gear };
              const recipientName = mainRosterPlayers.find((p) => p.id === gear[slot].playerId)?.name ?? 'Unknown';
              gear[slot] = { ...gear[slot], playerId: null, didNotDrop: true, locked: { recipientName, method: 'drop' } };
              floorCopy.gear = gear;
            } else if (type === 'materials' && slot) {
              const materials = { ...floorCopy.materials };
              const recipientName = mainRosterPlayers.find((p) => p.id === materials[slot].playerId)?.name ?? 'Unknown';
              materials[slot] = { ...materials[slot], playerId: null, didNotDrop: true, locked: { recipientName, method: 'drop' } };
              floorCopy.materials = materials;
            } else if (type === 'books') {
              floorCopy.booksCleared = [];
            }
            next[fn] = floorCopy;
          }
          return next;
        });
        toast.warning(
          `${succeeded} of ${results.length} logged. Failed: ${failed.join(', ')}`,
          6000,
        );
        setError(`${failed.length} entries failed. You can retry — only failed entries will be resubmitted.`);
      }
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          {singleFloorMode ? `Log ${floors[initialFloor - 1]}` : 'Log Week'}
          <NumberInput
            value={selectedWeek}
            onChange={(val) => {
              const raw = val ?? currentWeek;
              setSelectedWeek(Math.min(effectiveMaxWeek, Math.max(1, Math.trunc(raw))));
            }}
            min={1}
            max={effectiveMaxWeek}
            step={1}
            size="sm"
          />
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
          {step === 'gear' && (
            <GearStep
              floors={floors}
              selectedFloor={selectedFloor}
              setSelectedFloor={setSelectedFloor}
              floorData={floorData}
              clearedFloors={clearedFloors}
              singleFloorMode={singleFloorMode}
              mainRosterPlayers={mainRosterPlayers}
              handleSlotChange={handleSlotChange}
              handleDidNotDrop={handleDidNotDrop}
              handleMaterialPlayerChange={handleMaterialPlayerChange}
              handleMaterialSlotChange={handleMaterialSlotChange}
              toggleAllNoDrops={toggleAllNoDrops}
              toggleFloorCleared={toggleFloorCleared}
              getRecipientOptions={getRecipientOptions}
              getMaterialRecipientOptions={getMaterialRecipientOptions}
            />
          )}

          {step === 'books' && (
            <BooksStep
              floors={floors}
              floorData={floorData}
              clearedFloors={clearedFloors}
              mainRosterPlayers={mainRosterPlayers}
              singleFloorMode={singleFloorMode}
              initialFloor={initialFloor}
              handleBookToggle={handleBookToggle}
              handleSelectAllBooks={handleSelectAllBooks}
              handleClearAllBooks={handleClearAllBooks}
              setFloorData={setFloorData}
            />
          )}

          {step === 'confirm' && (
            <ConfirmStep
              floors={floors}
              floorData={floorData}
              clearedFloors={clearedFloors}
              mainRosterPlayers={mainRosterPlayers}
              singleFloorMode={singleFloorMode}
              summary={summary}
            />
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
                    {singleFloorMode ? `Log ${floors[initialFloor - 1]}` : `Log Week ${selectedWeek}`}
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
