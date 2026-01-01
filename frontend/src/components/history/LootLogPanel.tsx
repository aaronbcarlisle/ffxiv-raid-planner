/**
 * Loot Log Panel
 *
 * Displays loot log history with week filtering.
 */

import { useState, useEffect } from 'react';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { AddLootEntryModal } from './AddLootEntryModal';
import type { SnapshotPlayer } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';

interface LootLogPanelProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  canEdit: boolean;
}

export function LootLogPanel({
  groupId,
  tierId,
  players,
  floors,
  currentWeek,
  canEdit,
}: LootLogPanelProps) {
  const { lootLog, isLoading, fetchLootLog, createLootEntry, deleteLootEntry } =
    useLootTrackingStore();
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch loot log for current week on mount
  useEffect(() => {
    fetchLootLog(groupId, tierId, currentWeek);
  }, [groupId, tierId, currentWeek, fetchLootLog]);

  const handleDeleteEntry = async (entryId: number) => {
    if (!confirm('Delete this loot entry?')) return;

    try {
      await deleteLootEntry(groupId, tierId, entryId);
    } catch (error) {
      // Error handled by store
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
            className="px-3 py-1.5 rounded bg-accent text-white text-sm hover:bg-accent-bright transition-colors"
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
              </div>

              {canEdit && (
                <button
                  onClick={() => handleDeleteEntry(entry.id)}
                  className="ml-3 px-2 py-1 rounded text-xs text-status-error hover:bg-status-error/20 transition-colors"
                  title="Delete entry"
                >
                  Delete
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add loot modal */}
      {showAddModal && (
        <AddLootEntryModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={async (entry) => {
            await createLootEntry(groupId, tierId, entry);
            await fetchLootLog(groupId, tierId, currentWeek);
          }}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
        />
      )}
    </div>
  );
}
