/**
 * Add/Edit Loot Entry Modal
 *
 * Modal for logging or editing a loot drop with coordinated gear updates.
 * Features:
 * - Floor-based item slot filtering
 * - Priority-sorted recipient list with labels
 * - Optional gear checkbox update (add mode only)
 * - Edit mode pre-populates from existing entry
 */

import { useState, useMemo, useEffect } from 'react';
import { Modal, Select, Checkbox, RadioGroup, TextArea, Label } from '../ui';
import { NumberInput } from '../ui/NumberInput';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import { FLOOR_LOOT_TABLES } from '../../gamedata/loot-tables';
import { getPriorityForItem, getPriorityForRing } from '../../utils/priority';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { LootLogEntry, LootLogEntryCreate, LootLogEntryUpdate, LootMethod, SnapshotPlayer, GearSlot } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';

interface AddLootEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (entry: LootLogEntryCreate, options: { updateGear: boolean }) => Promise<void>;
  onUpdate?: (updates: LootLogEntryUpdate) => Promise<void>;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  /** If provided, modal operates in edit mode */
  editEntry?: LootLogEntry;
  /** Pre-select floor when opening from grid view (add mode only) */
  presetFloor?: string;
  /** Pre-select slot when opening from grid view (add mode only) */
  presetSlot?: string;
}

// Map floor name to floor number (1-4)
function getFloorNumber(floorName: string): 1 | 2 | 3 | 4 {
  // Extract number from floor name like "M9S" -> 1, "M10S" -> 2, etc.
  // Supports M-series (M1S-M12S) and P-series (P1S-P12S) Pandaemonium
  const match = floorName.match(/[MP](\d+)S/i);
  if (match) {
    const num = parseInt(match[1], 10);
    // For 7.x tier (M9S-M12S): 9->1, 10->2, 11->3, 12->4
    // For 6.4 tier (P9S-P12S): 9->1, 10->2, 11->3, 12->4
    if (num >= 9) return ((num - 9) % 4 + 1) as 1 | 2 | 3 | 4;
    // For 7.0 tier (M5S-M8S): 5->1, 6->2, 7->3, 8->4
    // For 6.2 tier (P5S-P8S): 5->1, 6->2, 7->3, 8->4
    if (num >= 5) return ((num - 5) % 4 + 1) as 1 | 2 | 3 | 4;
    // For 6.0 tier (P1S-P4S) and older tiers: 1->1, 2->2, 3->3, 4->4
    return (num % 4 || 4) as 1 | 2 | 3 | 4;
  }
  return 1;
}

export function AddLootEntryModal({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  players,
  floors,
  currentWeek,
  editEntry,
  presetFloor,
  presetSlot,
}: AddLootEntryModalProps) {
  const isEditMode = !!editEntry;

  // Initialize state - use editEntry values in edit mode, presets in add mode
  const [weekNumber, setWeekNumber] = useState(editEntry?.weekNumber || currentWeek || 1);
  const [floor, setFloor] = useState(editEntry?.floor || presetFloor || floors[0] || '');
  const [itemSlot, setItemSlot] = useState<string>(editEntry?.itemSlot || presetSlot || '');
  const [recipientPlayerId, setRecipientPlayerId] = useState(editEntry?.recipientPlayerId || '');
  const [method, setMethod] = useState<LootMethod>((editEntry?.method as LootMethod) || 'drop');
  const [updateGear, setUpdateGear] = useState(true);
  const [notes, setNotes] = useState(editEntry?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [includeSubs, setIncludeSubs] = useState(false);

  // Reset form when modal opens with new preset values or edit entry
  useEffect(() => {
    if (!isOpen) return;

    if (editEntry) {
      // Edit mode: use existing entry values
      setWeekNumber(editEntry.weekNumber);
      setFloor(editEntry.floor);
      setItemSlot(editEntry.itemSlot);
      setRecipientPlayerId(editEntry.recipientPlayerId);
      setMethod(editEntry.method as LootMethod);
      setNotes(editEntry.notes || '');
      setShowAllRecipients(false);
      // If the recipient is a substitute, enable includeSubs so they appear in dropdown
      const recipient = players.find(p => p.id === editEntry.recipientPlayerId);
      setIncludeSubs(recipient?.isSubstitute ?? false);
    } else {
      // Add mode: use presets if provided, otherwise defaults
      setWeekNumber(currentWeek || 1);
      setFloor(presetFloor || floors[0] || '');
      if (presetSlot) {
        setItemSlot(presetSlot);
      } else {
        // Reset itemSlot if no preset - availableSlots effect will set it
        setItemSlot('');
      }
      setMethod('drop');
      setNotes('');
      setShowAllRecipients(false);
      setIncludeSubs(false);
      // Note: recipientPlayerId is set by auto-selection effect
    }
  }, [isOpen, editEntry, currentWeek, floors, presetFloor, presetSlot, players]);

  // Get available slots for selected floor
  const availableSlots = useMemo(() => {
    const floorNum = getFloorNumber(floor);
    const lootTable = FLOOR_LOOT_TABLES[floorNum];
    return lootTable.gearDrops;
  }, [floor]);

  // Reset item slot when floor changes
  useEffect(() => {
    if (availableSlots.length > 0 && !availableSlots.includes(itemSlot as GearSlot)) {
      setItemSlot(availableSlots[0]);
    }
  }, [availableSlots, itemSlot]);

  // Get priority-sorted recipients for selected slot
  const sortedRecipients = useMemo(() => {
    // Filter to configured players, excluding subs unless includeSubs is checked
    const eligiblePlayers = players.filter((p) => p.configured && (includeSubs || !p.isSubstitute));

    if (!itemSlot) return eligiblePlayers.map(p => ({ player: p, priority: 0, needsItem: false }));

    // Get priority entries for this slot
    const priorityEntries = itemSlot === 'ring1' || itemSlot === 'ring2'
      ? getPriorityForRing(eligiblePlayers, DEFAULT_SETTINGS)
      : getPriorityForItem(eligiblePlayers, itemSlot as GearSlot, DEFAULT_SETTINGS);

    // Create a map of player ID to priority rank
    const priorityMap = new Map(priorityEntries.map((e, i) => [e.player.id, { rank: i + 1, score: e.score }]));

    // Sort all players: those with priority first (by rank), then others alphabetically
    return eligiblePlayers
      .map(player => {
        const priority = priorityMap.get(player.id);
        return {
          player,
          priority: priority?.rank ?? 999,
          score: priority?.score ?? 0,
          needsItem: !!priority,
        };
      })
      .sort((a, b) => {
        if (a.needsItem && !b.needsItem) return -1;
        if (!a.needsItem && b.needsItem) return 1;
        if (a.needsItem && b.needsItem) return a.priority - b.priority;
        return a.player.name.localeCompare(b.player.name);
      });
  }, [players, itemSlot, includeSubs]);

  // Filter recipients based on checkbox states
  // Logic:
  // - Neither checked: Main roster who need item only
  // - Include Subs only: Main roster who need item + subs who need item.
  //                      If NO ONE needs it, show ONLY subs (fallback)
  // - Show All Players only: All main roster (excluding subs), regardless of need
  // - Both checked: Everyone (all main roster + all subs)
  // - In Edit mode: Always include the current recipient even if they don't need the item
  const visibleRecipients = useMemo(() => {
    let result: typeof sortedRecipients;

    if (showAllRecipients && includeSubs) {
      // Both checked: show everyone
      result = sortedRecipients;
    } else if (showAllRecipients && !includeSubs) {
      // Show all main roster (already filtered out subs in sortedRecipients when includeSubs is false)
      result = sortedRecipients;
    } else if (includeSubs && !showAllRecipients) {
      // Include Subs mode: show those who need + fallback to subs if none need
      const needsItem = sortedRecipients.filter(r => r.needsItem);
      if (needsItem.length > 0) {
        result = needsItem;
      } else {
        // No one needs it - show only subs as fallback
        result = sortedRecipients.filter(r => r.player.isSubstitute);
      }
    } else {
      // Default: only those who need the item
      result = sortedRecipients.filter(r => r.needsItem);
    }

    // In edit mode, ALWAYS ensure the current recipient is in the list
    // (they may no longer need the item if they already received it)
    if (isEditMode && editEntry?.recipientPlayerId) {
      const currentRecipientInList = result.some(r => r.player.id === editEntry.recipientPlayerId);
      if (!currentRecipientInList) {
        // Find the recipient directly from players prop (unfiltered)
        const player = players.find(p => p.id === editEntry.recipientPlayerId);
        if (player) {
          // Check if they're in sortedRecipients for priority info
          const sortedEntry = sortedRecipients.find(r => r.player.id === editEntry.recipientPlayerId);
          result = [{
            player,
            priority: sortedEntry?.priority ?? 999,
            score: sortedEntry?.score ?? 0,
            needsItem: sortedEntry?.needsItem ?? false,
          }, ...result];
        }
      }
    }

    return result;
  }, [sortedRecipients, showAllRecipients, includeSubs, isEditMode, editEntry, players]);

  // Auto-select top priority recipient when slot changes (add mode only)
  // Matches LogMaterialModal's pattern for consistency
  useEffect(() => {
    // Skip auto-selection in edit mode - preserve the original recipient
    if (editEntry) return;

    // Use visibleRecipients for auto-selection to match what's shown in dropdown
    if (visibleRecipients.length > 0) {
      // Select the first visible recipient (already sorted by priority)
      setRecipientPlayerId(visibleRecipients[0].player.id);
    } else {
      // No visible recipients - clear selection
      setRecipientPlayerId('');
    }
  }, [itemSlot, visibleRecipients, editEntry]);

  // Get priority label for a player
  const getPriorityLabel = (priority: number, needsItem: boolean): string => {
    if (!needsItem) return '';
    if (priority === 1) return ' - Top Priority';
    if (priority === 2) return ' - 2nd Priority';
    if (priority === 3) return ' - 3rd Priority';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientPlayerId) {
      return;
    }

    setIsSaving(true);
    try {
      if (isEditMode && onUpdate && editEntry) {
        // Build update object with only changed fields
        const updates: LootLogEntryUpdate = {};
        if (weekNumber !== editEntry.weekNumber) updates.weekNumber = weekNumber;
        if (floor !== editEntry.floor) updates.floor = floor;
        if (itemSlot !== editEntry.itemSlot) updates.itemSlot = itemSlot;
        if (recipientPlayerId !== editEntry.recipientPlayerId) updates.recipientPlayerId = recipientPlayerId;
        if (method !== editEntry.method) updates.method = method;
        if (notes !== (editEntry.notes || '')) updates.notes = notes || undefined;

        // Only submit if something changed
        if (Object.keys(updates).length > 0) {
          await onUpdate(updates);
        }
      } else {
        await onSubmit(
          {
            weekNumber,
            floor,
            itemSlot,
            recipientPlayerId,
            method,
            notes: notes || undefined,
          },
          { updateGear: (method === 'drop' || method === 'book') && updateGear }
        );

        // Reset form only in add mode
        setWeekNumber(currentWeek);
        setFloor(floors[0] || '');
        setItemSlot(availableSlots[0] || '');
        setRecipientPlayerId('');
        setMethod('drop');
        setUpdateGear(true);
        setNotes('');
        setShowAllRecipients(false);
      }

      onClose();
    } catch {
      // Error handled by caller
    } finally {
      setIsSaving(false);
    }
  };

  const selectedPlayer = players.find((p) => p.id === recipientPlayerId);
  // Show "Ring" for floor 1 ring drops since it's a generic ring drop
  const slotName = itemSlot === 'ring1' && getFloorNumber(floor) === 1
    ? 'Ring'
    : GEAR_SLOT_NAMES[itemSlot as keyof typeof GEAR_SLOT_NAMES] || itemSlot;

  // Build floor options for Select
  const floorOptions = floors.map(f => ({ value: f, label: f }));

  // Build slot options for Select
  const slotOptions = availableSlots.map(slot => ({
    value: slot,
    label: slot === 'ring1' && getFloorNumber(floor) === 1 ? 'Ring' : GEAR_SLOT_NAMES[slot],
  }));

  // Build recipient options for Select
  const recipientOptions = [
    { value: '', label: 'Select player...' },
    ...visibleRecipients.map(({ player, priority, needsItem }) => ({
      value: player.id,
      label: `${player.name}${getPriorityLabel(priority, needsItem)}`,
      icon: <JobIcon job={player.job} size="sm" />,
    })),
  ];

  // Build method options for RadioGroup
  const methodOptions = [
    { value: 'drop', label: 'Drop' },
    { value: 'book', label: 'Book' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Edit Loot Entry" : "Log Loot Drop"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Week and Floor */}
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
              value={floor}
              onChange={setFloor}
              options={floorOptions}
            />
          </div>
        </div>

        {/* Item Slot - filtered by floor */}
        <div>
          <Label htmlFor="slot">Item Slot</Label>
          <Select
            id="slot"
            value={itemSlot}
            onChange={setItemSlot}
            options={slotOptions}
          />
          <div className="text-xs text-text-muted mt-1">
            Showing items that drop from {floor}
          </div>
        </div>

        {/* Recipient - sorted by priority */}
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
            value={recipientPlayerId}
            onChange={setRecipientPlayerId}
            options={recipientOptions}
          />
          {visibleRecipients.length === 0 && !showAllRecipients && (
            <div className="text-xs text-status-success mt-1">
              No one needs this item! Enable "Show all players" to assign anyway.
            </div>
          )}
        </div>

        {/* Method */}
        <div>
          <Label>Method</Label>
          <RadioGroup
            name="method"
            value={method}
            onChange={(value) => setMethod(value as LootMethod)}
            options={methodOptions}
            orientation="horizontal"
          />
        </div>

        {/* Update gear checkbox - for drops and books in add mode */}
        {!isEditMode && (method === 'drop' || method === 'book') && (
          <Checkbox
            checked={updateGear}
            onChange={setUpdateGear}
            label={`Also mark ${slotName.toLowerCase()} as acquired for ${selectedPlayer?.name || 'player'}`}
          />
        )}

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <TextArea
            value={notes}
            onChange={setNotes}
            placeholder="e.g., Traded for tomestone piece"
            rows={2}
          />
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
            {isEditMode ? 'Save Changes' : 'Log Loot'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
