/**
 * Loot Log Panel
 *
 * Displays loot log history with week filtering.
 */

import { useState, useEffect } from 'react';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { AddLootEntryModal } from './AddLootEntryModal';
import { DeleteLootConfirmModal } from './DeleteLootConfirmModal';
import { Tooltip } from '../primitives/Tooltip';
import { logLootAndUpdateGear, deleteLootAndRevertGear, updateLootAndSyncGear } from '../../utils/lootCoordination';
import { toast } from '../../stores/toastStore';
import type { SnapshotPlayer, LootLogEntry, LootLogEntryUpdate } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';

interface LootLogPanelProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  canEdit: boolean;
  onLootLogged?: (weekNumber: number) => void;
}

export function LootLogPanel({
  groupId,
  tierId,
  players,
  floors,
  currentWeek,
  canEdit,
  onLootLogged,
}: LootLogPanelProps) {
  const { lootLog, isLoading, fetchLootLog } = useLootTrackingStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<LootLogEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<LootLogEntry | null>(null);

  // Fetch loot log for current week on mount
  useEffect(() => {
    fetchLootLog(groupId, tierId, currentWeek);
  }, [groupId, tierId, currentWeek, fetchLootLog]);

  const handleAddLoot = async (
    entry: Parameters<typeof logLootAndUpdateGear>[2],
    options: { updateGear: boolean }
  ) => {
    await logLootAndUpdateGear(groupId, tierId, entry, {
      updateGear: options.updateGear,
      updateWeaponPriority: entry.itemSlot === 'weapon' && options.updateGear,
    });
    // Switch to the logged week and fetch its entries
    onLootLogged?.(entry.weekNumber);
    await fetchLootLog(groupId, tierId, entry.weekNumber);
    const player = players.find((p) => p.id === entry.recipientPlayerId);
    const slotName = GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] || entry.itemSlot;
    toast.success(`Logged ${slotName} for ${player?.name || 'player'}`);
  };

  const handleDeleteConfirm = async (revertGear: boolean) => {
    if (!entryToDelete) return;
    try {
      await deleteLootAndRevertGear(groupId, tierId, entryToDelete.id, entryToDelete, {
        revertGear,
      });
      await fetchLootLog(groupId, tierId, currentWeek);
      const slotName = GEAR_SLOT_NAMES[entryToDelete.itemSlot as keyof typeof GEAR_SLOT_NAMES] || entryToDelete.itemSlot;
      toast.success(`Deleted ${slotName} entry${revertGear ? ' and reverted gear' : ''}`);
    } catch {
      toast.error('Failed to delete entry');
    } finally {
      setEntryToDelete(null);
    }
  };

  return (
    <div className="bg-surface-card rounded-lg p-4 border border-border-default">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-text-primary">Loot Log</h3>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 rounded bg-accent text-accent-contrast text-sm font-bold hover:bg-accent-hover transition-colors"
          >
            + Log Loot
          </button>
        )}
      </div>

      {/* Loot entries */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-text-muted">Loading...</div>
        ) : lootLog.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            No loot logged for Week {currentWeek}
          </div>
        ) : (
          lootLog.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3 rounded bg-surface-elevated border border-border-default"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {entry.floor}
                  </span>
                  <span className="text-sm text-text-muted">→</span>
                  <span className="text-sm text-text-primary">
                    {GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] ||
                      entry.itemSlot}
                  </span>
                  <span className="text-sm text-text-muted">→</span>
                  <span className="text-sm text-text-primary">
                    {entry.recipientPlayerName}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      entry.method === 'drop'
                        ? 'bg-status-success/20 text-status-success'
                        : entry.method === 'book'
                        ? 'bg-status-warning/20 text-status-warning'
                        : 'bg-accent/20 text-accent'
                    }`}
                  >
                    {entry.method}
                  </span>
                </div>
                {entry.notes && (
                  <div className="text-xs text-text-muted mt-1">{entry.notes}</div>
                )}
                {entry.createdAt && (
                  <div className="text-xs text-text-muted mt-1">
                    {new Date(entry.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="flex items-center gap-1 ml-3">
                  <Tooltip content="Edit entry">
                    <button
                      onClick={() => setEntryToEdit(entry)}
                      className="px-2 py-1 rounded text-xs text-accent hover:bg-accent/20 transition-colors"
                    >
                      Edit
                    </button>
                  </Tooltip>
                  <Tooltip content="Delete entry">
                    <button
                      onClick={() => setEntryToDelete(entry)}
                      className="px-2 py-1 rounded text-xs text-status-error hover:bg-status-error/20 transition-colors"
                    >
                      Delete
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add/Edit loot modal - unified modal for both add and edit */}
      {(showAddModal || entryToEdit) && (
        <AddLootEntryModal
          isOpen={showAddModal || !!entryToEdit}
          onClose={() => {
            setShowAddModal(false);
            setEntryToEdit(null);
          }}
          onSubmit={handleAddLoot}
          onUpdate={entryToEdit ? async (updates: LootLogEntryUpdate) => {
            try {
              // Use coordinated update that syncs gear when recipient/slot changes
              await updateLootAndSyncGear(groupId, tierId, entryToEdit.id, entryToEdit, updates, {
                syncGear: entryToEdit.method === 'drop',
              });
              // Refresh loot log for the current week
              await fetchLootLog(groupId, tierId, currentWeek);
              const slot = updates.itemSlot || entryToEdit.itemSlot;
              const slotName = GEAR_SLOT_NAMES[slot as keyof typeof GEAR_SLOT_NAMES] || slot;
              toast.success(`Updated ${slotName} entry`);
            } catch {
              toast.error('Failed to update entry');
              throw new Error('Failed to update');
            }
          } : undefined}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
          editEntry={entryToEdit || undefined}
        />
      )}

      {/* Delete confirmation modal */}
      {entryToDelete && (
        <DeleteLootConfirmModal
          isOpen={!!entryToDelete}
          onClose={() => setEntryToDelete(null)}
          onConfirm={handleDeleteConfirm}
          entry={entryToDelete}
          playerName={entryToDelete.recipientPlayerName}
        />
      )}
    </div>
  );
}
