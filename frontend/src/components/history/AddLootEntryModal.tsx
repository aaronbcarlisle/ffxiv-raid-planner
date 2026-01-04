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
import { Modal } from '../ui/Modal';
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

  // Reset form when editEntry or presets change
  useEffect(() => {
    if (editEntry) {
      // Edit mode: use existing entry values
      setWeekNumber(editEntry.weekNumber);
      setFloor(editEntry.floor);
      setItemSlot(editEntry.itemSlot);
      setRecipientPlayerId(editEntry.recipientPlayerId);
      setMethod(editEntry.method as LootMethod);
      setNotes(editEntry.notes || '');
      setShowAllRecipients(false);
    } else {
      // Add mode: use presets if provided, otherwise defaults
      setWeekNumber(currentWeek || 1);
      setFloor(presetFloor || floors[0] || '');
      if (presetSlot) {
        setItemSlot(presetSlot);
      }
      setMethod('drop');
      setNotes('');
      setShowAllRecipients(false);
    }
  }, [editEntry, currentWeek, floors, presetFloor, presetSlot]);

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
    const configuredPlayers = players.filter((p) => p.configured);

    if (!itemSlot) return configuredPlayers.map(p => ({ player: p, priority: 0, needsItem: false }));

    // Get priority entries for this slot
    const priorityEntries = itemSlot === 'ring1' || itemSlot === 'ring2'
      ? getPriorityForRing(configuredPlayers, DEFAULT_SETTINGS)
      : getPriorityForItem(configuredPlayers, itemSlot as GearSlot, DEFAULT_SETTINGS);

    // Create a map of player ID to priority rank
    const priorityMap = new Map(priorityEntries.map((e, i) => [e.player.id, { rank: i + 1, score: e.score }]));

    // Sort all players: those with priority first (by rank), then others alphabetically
    return configuredPlayers
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
  }, [players, itemSlot]);

  // Filter to only show players who need the item (unless showAllRecipients)
  const visibleRecipients = useMemo(() => {
    if (showAllRecipients) return sortedRecipients;
    return sortedRecipients.filter(r => r.needsItem);
  }, [sortedRecipients, showAllRecipients]);

  // Auto-select top priority recipient when slot changes (add mode only)
  useEffect(() => {
    // Skip auto-selection in edit mode - preserve the original recipient
    if (isEditMode) return;

    if (sortedRecipients.length > 0) {
      const topPriority = sortedRecipients.find(r => r.needsItem);
      if (topPriority) {
        setRecipientPlayerId(topPriority.player.id);
      } else if (sortedRecipients.length > 0) {
        // Fall back to first player if no one needs the item
        setRecipientPlayerId(sortedRecipients[0].player.id);
      }
    }
  }, [itemSlot, sortedRecipients, isEditMode]);

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Edit Loot Entry" : "Log Loot Drop"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Week and Floor */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Week</label>
            <input
              type="number"
              min={1}
              value={weekNumber}
              onChange={(e) => setWeekNumber(Number(e.target.value))}
              className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Floor</label>
            <select
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none"
            >
              {floors.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Item Slot - filtered by floor */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Item Slot</label>
          <select
            value={itemSlot}
            onChange={(e) => setItemSlot(e.target.value)}
            className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none"
          >
            {availableSlots.map((slot) => (
              <option key={slot} value={slot}>
                {/* Show "Ring" for ring1 on floor 1 since it's a generic ring drop */}
                {slot === 'ring1' && getFloorNumber(floor) === 1 ? 'Ring' : GEAR_SLOT_NAMES[slot]}
              </option>
            ))}
          </select>
          <div className="text-xs text-text-muted mt-1">
            Showing items that drop from {floor}
          </div>
        </div>

        {/* Recipient - sorted by priority */}
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
            value={recipientPlayerId}
            onChange={(e) => setRecipientPlayerId(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="">Select player...</option>
            {visibleRecipients.map(({ player, priority, needsItem }) => (
              <option key={player.id} value={player.id}>
                {player.name} ({player.job}){getPriorityLabel(priority, needsItem)}
              </option>
            ))}
          </select>
          {visibleRecipients.length === 0 && !showAllRecipients && (
            <div className="text-xs text-status-success mt-1">
              No one needs this item! Enable "Show all players" to assign anyway.
            </div>
          )}
        </div>

        {/* Method */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Method</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="drop"
                checked={method === 'drop'}
                onChange={() => setMethod('drop')}
                className="cursor-pointer"
              />
              <span className="text-sm text-text-primary">Drop</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="book"
                checked={method === 'book'}
                onChange={() => setMethod('book')}
                className="cursor-pointer"
              />
              <span className="text-sm text-text-primary">Book</span>
            </label>
          </div>
        </div>

        {/* Update gear checkbox - for drops and books in add mode */}
        {!isEditMode && (method === 'drop' || method === 'book') && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={updateGear}
              onChange={(e) => setUpdateGear(e.target.checked)}
              className="w-4 h-4 rounded border-border-default text-accent focus:ring-accent cursor-pointer"
            />
            <span className="text-sm text-text-primary">
              Also mark {slotName.toLowerCase()} as acquired for {selectedPlayer?.name || 'player'}
            </span>
          </label>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Traded for tomestone piece"
            rows={2}
            className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-surface-interactive text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!recipientPlayerId || isSaving}
            className="px-4 py-2 rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (isEditMode ? 'Saving...' : 'Logging...') : (isEditMode ? 'Save Changes' : 'Log Loot')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
