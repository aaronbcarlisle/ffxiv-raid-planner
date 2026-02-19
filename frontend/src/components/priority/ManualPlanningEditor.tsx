/**
 * Manual Planning Editor
 *
 * Allows leads/owners to pre-assign loot to players for each week.
 * Shows floor-by-floor slot assignments with player dropdowns.
 */

import { useState, useMemo, useCallback } from 'react';
import { Plus, X, Check, AlertCircle, Calendar, Loader2 } from 'lucide-react';
import { Button, IconButton } from '../primitives';
import { Select, Checkbox, Label } from '../ui';
import { JobIcon } from '../ui/JobIcon';
import { useWeeklyAssignments } from '../../hooks/useWeeklyAssignments';
import { FLOOR_LOOT_TABLES, type FloorNumber } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES, GEAR_SLOT_ICONS, type GearSlot } from '../../types';
import type { SnapshotPlayer, WeeklyAssignment } from '../../types';

// Material slot types
type MaterialSlot = 'twine' | 'glaze' | 'solvent' | 'tomestone';

// Display names for material slots
const MATERIAL_SLOT_NAMES: Record<MaterialSlot, string> = {
  twine: 'Twine',
  glaze: 'Glaze',
  solvent: 'Solvent',
  tomestone: 'Tomestone',
};

interface ManualPlanningEditorProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  maxWeek?: number;
  disabled?: boolean;
  onLogWeek?: (week: number) => void;
}

// Slot assignment row component
function SlotAssignmentRow({
  floor,
  slot,
  slotLabel,
  slotIcon,
  assignment,
  eligiblePlayers,
  disabled,
  onAssign,
  onRemove,
  onToggleDidNotDrop,
}: {
  floor: string;
  slot: string;
  slotLabel: string;
  slotIcon?: string;
  assignment?: WeeklyAssignment;
  eligiblePlayers: SnapshotPlayer[];
  disabled?: boolean;
  onAssign: (floor: string, slot: string, playerId: string) => void;
  onRemove: (assignmentId: string) => void;
  onToggleDidNotDrop: (floor: string, slot: string, didNotDrop: boolean) => void;
}) {
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectPlayer = (playerId: string) => {
    onAssign(floor, slot, playerId);
    setIsSelecting(false);
  };

  // Find the assigned player
  const assignedPlayer = assignment?.playerId
    ? eligiblePlayers.find((p) => p.id === assignment.playerId) ||
      // Player might not be in eligible list if they already have item
      { id: assignment.playerId, name: assignment.playerName || 'Unknown', job: assignment.playerJob }
    : null;

  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-surface-base rounded-lg border border-border-default">
      {/* Slot icon and name */}
      <div className="flex items-center gap-2 w-32 flex-shrink-0">
        {slotIcon && <span className="text-lg">{slotIcon}</span>}
        <span className="text-sm text-text-primary">{slotLabel}</span>
      </div>

      {/* Assignment area */}
      <div className="flex-1 flex items-center gap-2">
        {assignment?.didNotDrop ? (
          <span className="text-sm text-text-muted italic">Did not drop</span>
        ) : assignedPlayer ? (
          <div className="flex items-center gap-2 px-2 py-1 bg-surface-elevated rounded border border-border-default">
            {assignedPlayer.job && <JobIcon job={assignedPlayer.job} size="sm" />}
            <span className="text-sm text-text-primary">{assignedPlayer.name}</span>
            {!disabled && (
              <IconButton
                icon={<X className="w-3.5 h-3.5" />}
                onClick={() => onRemove(assignment!.id)}
                variant="ghost"
                size="sm"
                aria-label="Remove assignment"
                className="text-status-error hover:text-status-error ml-1"
              />
            )}
          </div>
        ) : isSelecting ? (
          <div className="flex items-center gap-2 flex-1">
            <Select
              value=""
              onChange={(value) => value && handleSelectPlayer(value)}
              disabled={disabled}
              options={[
                { value: '', label: 'Select player...' },
                ...eligiblePlayers.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.job || '?'})`,
                })),
              ]}
              className="flex-1"
            />
            <IconButton
              icon={<X className="w-4 h-4" />}
              onClick={() => setIsSelecting(false)}
              variant="ghost"
              size="sm"
              aria-label="Cancel"
            />
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSelecting(true)}
            disabled={disabled || eligiblePlayers.length === 0}
          >
            <Plus className="w-4 h-4 mr-1" />
            {eligiblePlayers.length > 0 ? 'Assign Player' : 'No eligible players'}
          </Button>
        )}
      </div>

      {/* Did not drop checkbox */}
      <Checkbox
        checked={assignment?.didNotDrop ?? false}
        onChange={(checked) => onToggleDidNotDrop(floor, slot, checked)}
        disabled={disabled}
        label="Didn't drop"
      />
    </div>
  );
}

export function ManualPlanningEditor({
  groupId,
  tierId,
  players,
  floors,
  currentWeek,
  maxWeek,
  disabled,
  onLogWeek,
}: ManualPlanningEditorProps) {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [selectedFloor, setSelectedFloor] = useState<FloorNumber>(1);

  // Fetch assignments for selected week
  const {
    assignments,
    isLoading,
    error,
    create,
    update,
    remove,
    getAssignment,
  } = useWeeklyAssignments({
    groupId,
    tierId,
    week: selectedWeek,
  });

  // Get floor data
  const floorName = floors[selectedFloor - 1] || `Floor ${selectedFloor}`;
  const lootTable = FLOOR_LOOT_TABLES[selectedFloor];

  // Get gear slots for current floor
  const gearSlots = useMemo((): GearSlot[] => {
    if (!lootTable) return [];
    return lootTable.gearDrops.filter((slot) => slot !== 'weapon');
  }, [lootTable]);

  // Get material slots for current floor
  const materialSlots = useMemo(() => {
    if (!lootTable) return [];
    const slots: MaterialSlot[] = [];
    if (lootTable.upgradeMaterials.includes('twine')) slots.push('twine');
    if (lootTable.upgradeMaterials.includes('glaze')) slots.push('glaze');
    if (lootTable.upgradeMaterials.includes('solvent')) slots.push('solvent');
    if (lootTable.upgradeMaterials.includes('universal_tomestone')) slots.push('tomestone');
    return slots;
  }, [lootTable]);

  // Configured main roster players
  const mainRosterPlayers = useMemo(() => {
    return players.filter((p) => p.configured && !p.isSubstitute);
  }, [players]);

  // Get eligible players for a slot (those who still need the item)
  const getEligiblePlayers = useCallback(
    (_slot: GearSlot | MaterialSlot) => {
      // For manual planning, show all configured players
      // In the future, we could filter by who needs the item
      return mainRosterPlayers;
    },
    [mainRosterPlayers]
  );

  // Handle assignment
  const handleAssign = useCallback(
    async (floor: string, slot: string, playerId: string) => {
      const existing = getAssignment(floor, slot);
      if (existing) {
        await update(existing.id, { playerId });
      } else {
        await create({ floor, slot, playerId });
      }
    },
    [getAssignment, update, create]
  );

  // Handle remove assignment
  const handleRemove = useCallback(
    async (assignmentId: string) => {
      await remove(assignmentId);
    },
    [remove]
  );

  // Handle toggle did not drop
  const handleToggleDidNotDrop = useCallback(
    async (floor: string, slot: string, didNotDrop: boolean) => {
      const existing = getAssignment(floor, slot);
      if (existing) {
        await update(existing.id, { didNotDrop, playerId: didNotDrop ? null : existing.playerId });
      } else if (didNotDrop) {
        await create({ floor, slot, playerId: null, didNotDrop: true });
      }
    },
    [getAssignment, update, create]
  );

  // Week options
  const weekOptions = useMemo(() => {
    const max = maxWeek ?? currentWeek;
    return Array.from({ length: max + 2 }, (_, i) => ({
      value: String(i + 1),
      label: `Week ${i + 1}`,
    }));
  }, [maxWeek, currentWeek]);

  // Floor options
  const floorOptions = useMemo(() => {
    return floors.map((name, i) => ({
      value: String(i + 1),
      label: name,
    }));
  }, [floors]);

  return (
    <div className="space-y-6">
      {/* Week and Floor selectors */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-text-muted" />
          <Label className="text-sm">Week</Label>
          <Select
            value={String(selectedWeek)}
            onChange={(value) => setSelectedWeek(Number(value))}
            options={weekOptions}
            disabled={disabled}
            className="w-28"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm">Floor</Label>
          <Select
            value={String(selectedFloor)}
            onChange={(value) => setSelectedFloor(Number(value) as FloorNumber)}
            options={floorOptions}
            disabled={disabled}
            className="w-28"
          />
        </div>

        <div className="flex-1" />

        {onLogWeek && (
          <Button
            variant="primary"
            onClick={() => onLogWeek(selectedWeek)}
            disabled={disabled || assignments.length === 0}
          >
            <Check className="w-4 h-4 mr-1.5" />
            Log Week {selectedWeek} Drops
          </Button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 bg-status-error/10 border border-status-error/30 rounded text-status-error text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading assignments...
        </div>
      )}

      {/* Floor content */}
      {!isLoading && lootTable && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-primary">
            {floorName} - Gear Drops
          </h3>

          {/* Gear slots */}
          <div className="space-y-2">
            {gearSlots.map((slot) => (
              <SlotAssignmentRow
                key={`${floorName}-${slot}`}
                floor={floorName}
                slot={slot}
                slotLabel={GEAR_SLOT_NAMES[slot as GearSlot] || slot}
                slotIcon={GEAR_SLOT_ICONS[slot as GearSlot]}
                assignment={getAssignment(floorName, slot)}
                eligiblePlayers={getEligiblePlayers(slot as GearSlot)}
                disabled={disabled}
                onAssign={handleAssign}
                onRemove={handleRemove}
                onToggleDidNotDrop={handleToggleDidNotDrop}
              />
            ))}
          </div>

          {/* Material slots */}
          {materialSlots.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-text-primary mt-6">
                {floorName} - Materials
              </h3>
              <div className="space-y-2">
                {materialSlots.map((slot) => (
                  <SlotAssignmentRow
                    key={`${floorName}-${slot}`}
                    floor={floorName}
                    slot={slot}
                    slotLabel={MATERIAL_SLOT_NAMES[slot]}
                    assignment={getAssignment(floorName, slot)}
                    eligiblePlayers={getEligiblePlayers(slot)}
                    disabled={disabled}
                    onAssign={handleAssign}
                    onRemove={handleRemove}
                    onToggleDidNotDrop={handleToggleDidNotDrop}
                  />
                ))}
              </div>
            </>
          )}

          {/* Weapon slot for floor 4 */}
          {selectedFloor === 4 && (
            <>
              <h3 className="text-sm font-medium text-text-primary mt-6">
                {floorName} - Weapon
              </h3>
              <div className="space-y-2">
                <SlotAssignmentRow
                  floor={floorName}
                  slot="weapon"
                  slotLabel="Weapon"
                  slotIcon={GEAR_SLOT_ICONS.weapon}
                  assignment={getAssignment(floorName, 'weapon')}
                  eligiblePlayers={mainRosterPlayers}
                  disabled={disabled}
                  onAssign={handleAssign}
                  onRemove={handleRemove}
                  onToggleDidNotDrop={handleToggleDidNotDrop}
                />
              </div>
            </>
          )}

          {/* Summary */}
          <div className="mt-6 p-4 bg-surface-elevated rounded-lg border border-border-default">
            <p className="text-sm text-text-muted">
              {assignments.filter((a) => a.floor === floorName && a.playerId).length} assignments for {floorName} this week.
              {assignments.filter((a) => a.floor === floorName && a.didNotDrop).length > 0 && (
                <span className="ml-1">
                  ({assignments.filter((a) => a.floor === floorName && a.didNotDrop).length} marked as didn't drop)
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* No loot table */}
      {!isLoading && !lootTable && (
        <div className="text-center py-8 text-text-muted">
          No loot table available for this floor.
        </div>
      )}
    </div>
  );
}
