/**
 * Log Week Wizard
 *
 * Multi-step wizard for logging an entire week's worth of loot drops.
 * Streamlines the process of recording gear drops, materials, and book clears.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Package,
  Book,
  ClipboardList,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Modal, Select, Checkbox, Label } from '../ui';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import { toast } from '../../stores/toastStore';
import { logLootAndUpdateGear } from '../../utils/lootCoordination';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { getPriorityForItem, type PriorityEntry } from '../../utils/priority';
import { FLOOR_LOOT_TABLES, type FloorNumber } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES, GEAR_SLOT_ICONS, type GearSlot } from '../../types';
import type { SnapshotPlayer, StaticSettings, LootLogEntry, LootLogEntryCreate } from '../../types';

// Wizard steps
type WizardStep = 'gear' | 'books' | 'summary' | 'confirm';

const WIZARD_STEPS: { id: WizardStep; label: string; icon: typeof Package }[] = [
  { id: 'gear', label: 'Gear Drops', icon: Package },
  { id: 'books', label: 'Books', icon: Book },
  { id: 'summary', label: 'Summary', icon: ClipboardList },
  { id: 'confirm', label: 'Confirm', icon: Check },
];

// Material types
type MaterialSlot = 'twine' | 'glaze' | 'solvent' | 'tomestone';
const MATERIAL_NAMES: Record<MaterialSlot, string> = {
  twine: 'Twine',
  glaze: 'Glaze',
  solvent: 'Solvent',
  tomestone: 'Tomestone',
};

interface SlotEntry {
  slot: string;
  playerId: string | null;
  didNotDrop: boolean;
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
  onSuccess?: () => void;
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
  lootLog = [],
  onSuccess,
}: LogWeekWizardProps) {
  const [step, setStep] = useState<WizardStep>('gear');
  const [selectedFloor, setSelectedFloor] = useState<FloorNumber>(1);
  const [floorData, setFloorData] = useState<Record<FloorNumber, FloorEntries>>(() => initFloorData());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { markFloorCleared } = useLootTrackingStore();

  // Configured main roster players
  const mainRosterPlayers = useMemo(() => {
    return players.filter((p) => p.configured && !p.isSubstitute);
  }, [players]);

  // Initialize floor data with empty entries
  function initFloorData(): Record<FloorNumber, FloorEntries> {
    const data: Record<FloorNumber, FloorEntries> = {} as Record<FloorNumber, FloorEntries>;
    for (let i = 1; i <= 4; i++) {
      const floorNum = i as FloorNumber;
      const lootTable = FLOOR_LOOT_TABLES[floorNum];
      if (!lootTable) continue;

      const gear: Record<string, SlotEntry> = {};
      const materials: Record<string, SlotEntry> = {};

      // Initialize gear slots
      lootTable.gearSlots.forEach((slot) => {
        gear[slot] = { slot, playerId: null, didNotDrop: false };
      });

      // Initialize material slots
      if (lootTable.hasTwine) materials.twine = { slot: 'twine', playerId: null, didNotDrop: false };
      if (lootTable.hasGlaze) materials.glaze = { slot: 'glaze', playerId: null, didNotDrop: false };
      if (lootTable.hasSolvent) materials.solvent = { slot: 'solvent', playerId: null, didNotDrop: false };
      if (lootTable.hasTomestone) materials.tomestone = { slot: 'tomestone', playerId: null, didNotDrop: false };

      data[floorNum] = { gear, materials, booksCleared: [] };
    }
    return data;
  }

  // Get priority-ordered players for a slot
  const getPriorityPlayers = useCallback(
    (floorNum: FloorNumber, slot: GearSlot): PriorityEntry[] => {
      const floorName = floors[floorNum - 1];
      return getPriorityForItem(
        mainRosterPlayers,
        slot,
        settings,
        lootLog,
        floorName,
        currentWeek
      );
    },
    [mainRosterPlayers, settings, lootLog, floors, currentWeek]
  );

  // Get suggested player for a slot (highest priority who needs it)
  const getSuggestedPlayer = useCallback(
    (floorNum: FloorNumber, slot: GearSlot): string | null => {
      const entries = getPriorityPlayers(floorNum, slot);
      const topPlayer = entries.find((e) => e.needsItem);
      return topPlayer?.player.id || null;
    },
    [getPriorityPlayers]
  );

  // Auto-fill with suggested players
  const autoFillFloor = useCallback(
    (floorNum: FloorNumber) => {
      const lootTable = FLOOR_LOOT_TABLES[floorNum];
      if (!lootTable) return;

      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        const gear = { ...floor.gear };

        // Auto-fill gear slots
        lootTable.gearSlots.forEach((slot) => {
          if (!gear[slot].didNotDrop && !gear[slot].playerId) {
            const suggested = getSuggestedPlayer(floorNum, slot as GearSlot);
            if (suggested) {
              gear[slot] = { ...gear[slot], playerId: suggested };
            }
          }
        });

        return { ...prev, [floorNum]: { ...floor, gear } };
      });
    },
    [getSuggestedPlayer]
  );

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

  // Handle did not drop toggle
  const handleDidNotDrop = useCallback(
    (floorNum: FloorNumber, type: 'gear' | 'materials', slot: string, didNotDrop: boolean) => {
      setFloorData((prev) => {
        const floor = { ...prev[floorNum] };
        const slots = { ...floor[type] };
        slots[slot] = { ...slots[slot], didNotDrop, playerId: didNotDrop ? null : slots[slot].playerId };
        return { ...prev, [floorNum]: { ...floor, [type]: slots } };
      });
    },
    []
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

  // Calculate summary counts
  const summary = useMemo(() => {
    let gearDrops = 0;
    let materialDrops = 0;
    let bookClears = 0;
    let skipped = 0;

    Object.values(floorData).forEach((floor) => {
      Object.values(floor.gear).forEach((entry) => {
        if (entry.playerId) gearDrops++;
        if (entry.didNotDrop) skipped++;
      });
      Object.values(floor.materials).forEach((entry) => {
        if (entry.playerId) materialDrops++;
        if (entry.didNotDrop) skipped++;
      });
      bookClears += floor.booksCleared.length;
    });

    return { gearDrops, materialDrops, bookClears, skipped, total: gearDrops + materialDrops + bookClears };
  }, [floorData]);

  // Submit all entries
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const promises: Promise<void>[] = [];

      // Log gear and material drops
      for (let floorNum = 1; floorNum <= 4; floorNum++) {
        const floor = floorData[floorNum as FloorNumber];
        if (!floor) continue;

        const floorName = floors[floorNum - 1];

        // Gear drops
        for (const [slot, entry] of Object.entries(floor.gear)) {
          if (entry.playerId && !entry.didNotDrop) {
            const data: LootLogEntryCreate = {
              recipientPlayerId: entry.playerId,
              itemSlot: slot as GearSlot,
              floor: floorName,
              week: currentWeek,
              method: 'drop',
            };
            promises.push(logLootAndUpdateGear(groupId, tierId, data, { updateGear: true }));
          }
        }

        // Material drops (materials don't update gear)
        for (const [slot, entry] of Object.entries(floor.materials)) {
          if (entry.playerId && !entry.didNotDrop) {
            const data: LootLogEntryCreate = {
              recipientPlayerId: entry.playerId,
              itemSlot: slot as GearSlot, // Materials use the slot name
              floor: floorName,
              week: currentWeek,
              method: 'drop',
            };
            promises.push(logLootAndUpdateGear(groupId, tierId, data, { updateGear: false }));
          }
        }

        // Book clears
        if (floor.booksCleared.length > 0) {
          promises.push(
            markFloorCleared(groupId, tierId, floorName, currentWeek, floor.booksCleared)
          );
        }
      }

      await Promise.all(promises);
      toast.success(`Logged ${summary.total} entries for Week ${currentWeek}!`);
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

  // Reset wizard when closing
  const handleClose = () => {
    setStep('gear');
    setSelectedFloor(1);
    setFloorData(initFloorData());
    setError(null);
    onClose();
  };

  // Navigation
  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);
  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < WIZARD_STEPS.length - 1;
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  const goNext = () => {
    if (canGoNext) {
      setStep(WIZARD_STEPS[stepIndex + 1].id);
    }
  };

  const goBack = () => {
    if (canGoBack) {
      setStep(WIZARD_STEPS[stepIndex - 1].id);
    }
  };

  // Current floor data
  const currentFloorData = floorData[selectedFloor];
  const currentLootTable = FLOOR_LOOT_TABLES[selectedFloor];
  const currentFloorName = floors[selectedFloor - 1];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Log Week ${currentWeek} Drops`}
      icon={<Package className="w-5 h-5" />}
      size="lg"
    >
      <div className="space-y-6">
        {/* Step indicator */}
        <div className="flex items-center justify-between">
          {WIZARD_STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isPast = i < stepIndex;

            return (
              <div key={s.id} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                    isActive
                      ? 'bg-accent text-white'
                      : isPast
                        ? 'bg-status-success/20 text-status-success'
                        : 'bg-surface-elevated text-text-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < WIZARD_STEPS.length - 1 && (
                  <ChevronRight className="w-5 h-5 text-text-muted mx-2" />
                )}
              </div>
            );
          })}
        </div>

        {/* Error display */}
        {error && (
          <div className="p-3 bg-status-error/10 border border-status-error/30 rounded text-status-error text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Step content */}
        <div className="min-h-[300px]">
          {/* Gear Drops Step */}
          {step === 'gear' && currentLootTable && (
            <div className="space-y-4">
              {/* Floor selector */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label>Floor</Label>
                  <Select
                    value={String(selectedFloor)}
                    onChange={(v) => setSelectedFloor(Number(v) as FloorNumber)}
                    options={floors.map((name, i) => ({ value: String(i + 1), label: name }))}
                    className="w-28"
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={() => autoFillFloor(selectedFloor)}>
                  Auto-fill with Priority
                </Button>
              </div>

              {/* Gear slots */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-text-primary">{currentFloorName} - Gear</h4>
                {currentLootTable.gearSlots.map((slot) => {
                  const entry = currentFloorData.gear[slot];

                  return (
                    <div
                      key={slot}
                      className="flex items-center gap-3 py-2 px-3 bg-surface-base rounded border border-border-default"
                    >
                      <div className="flex items-center gap-2 w-28 flex-shrink-0">
                        <span>{GEAR_SLOT_ICONS[slot as GearSlot]}</span>
                        <span className="text-sm">{GEAR_SLOT_NAMES[slot as GearSlot]}</span>
                      </div>
                      <Select
                        value={entry?.playerId || ''}
                        onChange={(v) => handleSlotChange(selectedFloor, 'gear', slot, v || null)}
                        options={[
                          { value: '', label: 'Select player...' },
                          ...mainRosterPlayers.map((p) => ({
                            value: p.id,
                            label: `${p.name} (${p.job || '?'})`,
                          })),
                        ]}
                        disabled={entry?.didNotDrop}
                        className="flex-1"
                      />
                      <Checkbox
                        checked={entry?.didNotDrop || false}
                        onChange={(checked) => handleDidNotDrop(selectedFloor, 'gear', slot, checked)}
                        label="Skip"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Material slots */}
              {Object.keys(currentFloorData.materials).length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="text-sm font-medium text-text-primary">{currentFloorName} - Materials</h4>
                  {Object.entries(currentFloorData.materials).map(([slot, entry]) => (
                    <div
                      key={slot}
                      className="flex items-center gap-3 py-2 px-3 bg-surface-base rounded border border-border-default"
                    >
                      <div className="w-28 flex-shrink-0">
                        <span className="text-sm">{MATERIAL_NAMES[slot as MaterialSlot]}</span>
                      </div>
                      <Select
                        value={entry.playerId || ''}
                        onChange={(v) => handleSlotChange(selectedFloor, 'materials', slot, v || null)}
                        options={[
                          { value: '', label: 'Select player...' },
                          ...mainRosterPlayers.map((p) => ({
                            value: p.id,
                            label: `${p.name} (${p.job || '?'})`,
                          })),
                        ]}
                        disabled={entry.didNotDrop}
                        className="flex-1"
                      />
                      <Checkbox
                        checked={entry.didNotDrop}
                        onChange={(checked) => handleDidNotDrop(selectedFloor, 'materials', slot, checked)}
                        label="Skip"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Books Step */}
          {step === 'books' && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">
                Select which players cleared each floor this week to add their book entries.
              </p>

              {floors.map((floorName, i) => {
                const floorNum = (i + 1) as FloorNumber;
                const floor = floorData[floorNum];
                if (!floor) return null;

                return (
                  <div key={floorName} className="space-y-2">
                    <h4 className="text-sm font-medium text-text-primary">{floorName}</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {mainRosterPlayers.map((player) => (
                        <label
                          key={player.id}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                            floor.booksCleared.includes(player.id)
                              ? 'bg-accent/10 border-accent'
                              : 'bg-surface-base border-border-default hover:border-border-hover'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={floor.booksCleared.includes(player.id)}
                            onChange={(e) => handleBookToggle(floorNum, player.id, e.target.checked)}
                            className="sr-only"
                          />
                          {player.job && <JobIcon job={player.job} size="sm" />}
                          <span className="text-sm truncate">{player.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary Step */}
          {step === 'summary' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface-elevated rounded-lg">
                  <div className="text-2xl font-bold text-accent">{summary.gearDrops}</div>
                  <div className="text-sm text-text-muted">Gear Drops</div>
                </div>
                <div className="p-4 bg-surface-elevated rounded-lg">
                  <div className="text-2xl font-bold text-material-twine">{summary.materialDrops}</div>
                  <div className="text-sm text-text-muted">Material Drops</div>
                </div>
                <div className="p-4 bg-surface-elevated rounded-lg">
                  <div className="text-2xl font-bold text-status-info">{summary.bookClears}</div>
                  <div className="text-sm text-text-muted">Book Clears</div>
                </div>
                <div className="p-4 bg-surface-elevated rounded-lg">
                  <div className="text-2xl font-bold text-text-muted">{summary.skipped}</div>
                  <div className="text-sm text-text-muted">Skipped (Didn't Drop)</div>
                </div>
              </div>

              {/* Detailed list */}
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {floors.map((floorName, i) => {
                  const floorNum = (i + 1) as FloorNumber;
                  const floor = floorData[floorNum];
                  if (!floor) return null;

                  const entries = [
                    ...Object.entries(floor.gear)
                      .filter(([_, e]) => e.playerId)
                      .map(([slot, e]) => ({
                        slot,
                        player: mainRosterPlayers.find((p) => p.id === e.playerId),
                        type: 'gear' as const,
                      })),
                    ...Object.entries(floor.materials)
                      .filter(([_, e]) => e.playerId)
                      .map(([slot, e]) => ({
                        slot,
                        player: mainRosterPlayers.find((p) => p.id === e.playerId),
                        type: 'material' as const,
                      })),
                  ];

                  if (entries.length === 0 && floor.booksCleared.length === 0) return null;

                  return (
                    <div key={floorName}>
                      <h5 className="text-sm font-medium text-text-primary mb-1">{floorName}</h5>
                      <ul className="text-sm text-text-secondary space-y-0.5">
                        {entries.map(({ slot, player, type }) => (
                          <li key={slot} className="flex items-center gap-2">
                            <span className="w-20 text-text-muted">
                              {type === 'gear'
                                ? GEAR_SLOT_NAMES[slot as GearSlot]
                                : MATERIAL_NAMES[slot as MaterialSlot]}
                            </span>
                            <span>→</span>
                            {player?.job && <JobIcon job={player.job} size="sm" />}
                            <span>{player?.name || 'Unknown'}</span>
                          </li>
                        ))}
                        {floor.booksCleared.length > 0 && (
                          <li className="flex items-center gap-2 text-status-info">
                            <span className="w-20">Books</span>
                            <span>→</span>
                            <span>{floor.booksCleared.length} players cleared</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confirm Step */}
          {step === 'confirm' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-2">
                Ready to Log Week {currentWeek}
              </h3>
              <p className="text-text-muted mb-6">
                This will create {summary.total} log entries and update player gear accordingly.
              </p>
              {summary.total === 0 && (
                <p className="text-status-warning text-sm">
                  No entries to log. Go back and add some drops or book clears.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-border-default">
          <Button variant="ghost" onClick={goBack} disabled={!canGoBack || isSubmitting}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
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
                    Log Week {currentWeek}
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
