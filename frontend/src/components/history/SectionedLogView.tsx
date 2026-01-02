/**
 * Sectioned Log View
 *
 * Two-column layout for the Log tab:
 * - Left: Combined Loot & Materials section with card-style entries
 * - Right: Book Balances table with actions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { JobIcon } from '../ui/JobIcon';
import { AddLootEntryModal } from './AddLootEntryModal';
import { LogMaterialModal } from './LogMaterialModal';
import { MarkFloorClearedModal } from './MarkFloorClearedModal';
import { EditBookBalanceModal } from './EditBookBalanceModal';
import { PlayerLedgerModal } from './PlayerLedgerModal';
import { logLootAndUpdateGear, deleteLootAndRevertGear } from '../../utils/lootCoordination';
import { toast } from '../../stores/toastStore';
import type { SnapshotPlayer, LootLogEntry } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

interface SectionedLogViewProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  canEdit: boolean;
  onWeekChange?: (weekNumber: number) => void;
}

const MATERIAL_LABELS: Record<string, string> = {
  twine: 'Twine',
  glaze: 'Glaze',
  solvent: 'Solvent',
};

export function SectionedLogView({
  groupId,
  tierId,
  players,
  floors,
  currentWeek,
  canEdit,
  onWeekChange,
}: SectionedLogViewProps) {
  const {
    lootLog,
    materialLog,
    pageBalances,
    fetchLootLog,
    fetchMaterialLog,
    fetchPageBalances,
    fetchWeekDataTypes,
    deleteMaterialEntry,
  } = useLootTrackingStore();

  // Modal states
  const [showLootModal, setShowLootModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showFloorClearedModal, setShowFloorClearedModal] = useState(false);
  const [bookViewMode, setBookViewMode] = useState<'week' | 'allTime'>('allTime');
  const [editBookState, setEditBookState] = useState<{
    playerId: string;
    playerName: string;
    bookType: 'I' | 'II' | 'III' | 'IV';
    currentValue: number;
  } | null>(null);
  const [ledgerState, setLedgerState] = useState<{
    playerId: string;
    playerName: string;
  } | null>(null);
  const [entryToEdit, setEntryToEdit] = useState<LootLogEntry | undefined>(undefined);

  // Fetch loot and material data on mount and week change
  useEffect(() => {
    fetchLootLog(groupId, tierId, currentWeek);
    fetchMaterialLog(groupId, tierId, currentWeek);
  }, [groupId, tierId, currentWeek, fetchLootLog, fetchMaterialLog]);

  // Fetch page balances based on view mode (week-specific or all-time)
  useEffect(() => {
    const weekParam = bookViewMode === 'week' ? currentWeek : undefined;
    fetchPageBalances(groupId, tierId, weekParam);
  }, [groupId, tierId, currentWeek, bookViewMode, fetchPageBalances]);

  // Filter entries to current week
  const weekLootEntries = useMemo(() =>
    lootLog.filter(e => e.weekNumber === currentWeek),
    [lootLog, currentWeek]
  );

  const weekMaterialEntries = useMemo(() =>
    materialLog.filter(e => e.weekNumber === currentWeek),
    [materialLog, currentWeek]
  );

  // Handlers
  const handleAddLoot = useCallback(async (
    entry: Parameters<typeof logLootAndUpdateGear>[2],
    options: { updateGear: boolean }
  ) => {
    await logLootAndUpdateGear(groupId, tierId, entry, {
      updateGear: options.updateGear,
      updateWeaponPriority: entry.itemSlot === 'weapon' && options.updateGear,
    });
    onWeekChange?.(entry.weekNumber);
    await fetchLootLog(groupId, tierId, entry.weekNumber);
    // Refresh week data types to update week selector (may add new weeks)
    await fetchWeekDataTypes(groupId, tierId);
    toast.success('Loot entry logged');
  }, [groupId, tierId, onWeekChange, fetchLootLog, fetchWeekDataTypes]);

  const handleDeleteLoot = useCallback(async (entry: LootLogEntry) => {
    if (!confirm('Delete this loot entry?')) return;
    await deleteLootAndRevertGear(groupId, tierId, entry.id, entry, { revertGear: true });
    await fetchLootLog(groupId, tierId, currentWeek);
    // Refresh week data types to update week selector (may remove empty weeks)
    await fetchWeekDataTypes(groupId, tierId);
    toast.success('Loot entry deleted');
  }, [groupId, tierId, currentWeek, fetchLootLog, fetchWeekDataTypes]);

  const handleDeleteMaterial = useCallback(async (entryId: number) => {
    if (!confirm('Delete this material entry?')) return;
    await deleteMaterialEntry(groupId, tierId, entryId);
    await fetchMaterialLog(groupId, tierId, currentWeek);
    // Refresh week data types to update week selector (may remove empty weeks)
    await fetchWeekDataTypes(groupId, tierId);
    toast.success('Material entry deleted');
  }, [groupId, tierId, currentWeek, deleteMaterialEntry, fetchMaterialLog, fetchWeekDataTypes]);

  const handleMaterialSubmit = useCallback(async (data: {
    weekNumber: number;
    floor: string;
    materialType: 'twine' | 'glaze' | 'solvent';
    recipientPlayerId: string;
    notes?: string;
  }) => {
    const { createMaterialEntry } = useLootTrackingStore.getState();
    await createMaterialEntry(groupId, tierId, data);
    onWeekChange?.(data.weekNumber);
    await fetchMaterialLog(groupId, tierId, data.weekNumber);
    // Refresh week data types to update week selector (may add new weeks)
    await fetchWeekDataTypes(groupId, tierId);
    toast.success('Material entry logged');
  }, [groupId, tierId, onWeekChange, fetchMaterialLog, fetchWeekDataTypes]);

  // Get the week parameter for fetching page balances based on view mode
  const getBalanceWeekParam = useCallback(() => {
    return bookViewMode === 'week' ? currentWeek : undefined;
  }, [bookViewMode, currentWeek]);

  // Reset all books for a specific player (row)
  const handleResetRow = useCallback(async (playerId: string, playerName: string) => {
    if (!confirm(`Reset all book balances for ${playerName}?`)) return;

    const { adjustBookBalance } = useLootTrackingStore.getState();
    const balance = pageBalances.find(b => b.playerId === playerId);
    if (!balance) return;

    const books = ['I', 'II', 'III', 'IV'] as const;
    for (const book of books) {
      const value = balance[`book${book}` as keyof typeof balance] as number;
      if (value !== 0) {
        await adjustBookBalance(groupId, tierId, playerId, book, -value, currentWeek, 'Reset');
      }
    }
    await fetchPageBalances(groupId, tierId, getBalanceWeekParam());
    // Refresh week data types to update week selector (may remove empty weeks)
    await fetchWeekDataTypes(groupId, tierId);
    toast.success(`Reset books for ${playerName}`);
  }, [groupId, tierId, currentWeek, pageBalances, fetchPageBalances, getBalanceWeekParam, fetchWeekDataTypes]);

  // Reset a specific book type for all players (column)
  const handleResetColumn = useCallback(async (bookType: 'I' | 'II' | 'III' | 'IV') => {
    if (!confirm(`Reset Book ${bookType} for all players?`)) return;

    const { adjustBookBalance } = useLootTrackingStore.getState();
    for (const balance of pageBalances) {
      const value = balance[`book${bookType}` as keyof typeof balance] as number;
      if (value !== 0) {
        await adjustBookBalance(groupId, tierId, balance.playerId, bookType, -value, currentWeek, 'Reset');
      }
    }
    await fetchPageBalances(groupId, tierId, getBalanceWeekParam());
    // Refresh week data types to update week selector (may remove empty weeks)
    await fetchWeekDataTypes(groupId, tierId);
    toast.success(`Reset Book ${bookType} for all players`);
  }, [groupId, tierId, currentWeek, pageBalances, fetchPageBalances, getBalanceWeekParam, fetchWeekDataTypes]);

  // Reset all books for all players
  const handleResetAll = useCallback(async () => {
    if (!confirm('Reset ALL book balances for all players?')) return;

    const { adjustBookBalance } = useLootTrackingStore.getState();
    const books = ['I', 'II', 'III', 'IV'] as const;
    for (const balance of pageBalances) {
      for (const book of books) {
        const value = balance[`book${book}` as keyof typeof balance] as number;
        if (value !== 0) {
          await adjustBookBalance(groupId, tierId, balance.playerId, book, -value, currentWeek, 'Reset');
        }
      }
    }
    await fetchPageBalances(groupId, tierId, getBalanceWeekParam());
    // Refresh week data types to update week selector (may remove empty weeks)
    await fetchWeekDataTypes(groupId, tierId);
    toast.success('Reset all book balances');
  }, [groupId, tierId, currentWeek, pageBalances, fetchPageBalances, getBalanceWeekParam, fetchWeekDataTypes]);

  const getPlayerName = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player?.name || 'Unknown';
  };

  // Handler for MarkFloorClearedModal
  const handleMarkFloorCleared = useCallback(async (request: import('../../types').MarkFloorClearedRequest) => {
    const { markFloorCleared } = useLootTrackingStore.getState();
    await markFloorCleared(groupId, tierId, request);
    await fetchPageBalances(groupId, tierId, getBalanceWeekParam());
    // Refresh week data types to update week selector (may add new weeks)
    await fetchWeekDataTypes(groupId, tierId);
    toast.success('Floor marked as cleared');
  }, [groupId, tierId, fetchPageBalances, getBalanceWeekParam, fetchWeekDataTypes]);

  // Handler for EditBookBalanceModal
  const handleEditBookBalance = useCallback(async (adjustment: number, notes?: string) => {
    if (!editBookState) return;
    const { adjustBookBalance } = useLootTrackingStore.getState();
    await adjustBookBalance(
      groupId,
      tierId,
      editBookState.playerId,
      editBookState.bookType,
      adjustment,
      currentWeek,
      notes
    );
    await fetchPageBalances(groupId, tierId, getBalanceWeekParam());
    // Refresh week data types to update week selector (may affect week indicators)
    await fetchWeekDataTypes(groupId, tierId);
    toast.success('Book balance updated');
  }, [groupId, tierId, currentWeek, editBookState, fetchPageBalances, getBalanceWeekParam, fetchWeekDataTypes]);

  // Combine loot and material entries, sorted by creation time (newest first)
  const combinedEntries = useMemo(() => {
    const lootWithType = weekLootEntries.map(e => ({ ...e, entryType: 'loot' as const }));
    const materialWithType = weekMaterialEntries.map(e => ({ ...e, entryType: 'material' as const }));
    return [...lootWithType, ...materialWithType].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [weekLootEntries, weekMaterialEntries]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Loot & Materials Section */}
      <section className="bg-surface-card border border-border-default rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h3 className="font-display text-lg text-text-primary">Loot Log</h3>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEntryToEdit(undefined); setShowLootModal(true); }}
                className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-accent-bright transition-colors"
              >
                + Log Loot
              </button>
              <button
                onClick={() => setShowMaterialModal(true)}
                className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-accent-bright transition-colors"
              >
                + Log Material
              </button>
            </div>
          )}
        </div>
        <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
          {combinedEntries.length === 0 ? (
            <p className="text-text-muted text-sm">No loot or materials logged this week.</p>
          ) : (
            combinedEntries.map((entry) => {
              if (entry.entryType === 'loot') {
                const slotName = GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] || entry.itemSlot;
                return (
                  <div
                    key={`loot-${entry.id}`}
                    className="bg-[#121218] border-l-2 border-l-accent rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-text-primary">{entry.floor}</span>
                          <span className="text-text-muted">→</span>
                          <span className="text-text-primary font-medium">{slotName}</span>
                          <span className="text-text-muted">→</span>
                          <span className="text-text-primary">{getPlayerName(entry.recipientPlayerId)}</span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              entry.method === 'drop'
                                ? 'bg-status-success/20 text-status-success'
                                : 'bg-status-warning/20 text-status-warning'
                            }`}
                          >
                            {entry.method}
                          </span>
                        </div>
                        <div className="text-xs text-text-muted mt-1">
                          {formatDate(entry.createdAt)}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-3 ml-4">
                          <button
                            onClick={() => { setEntryToEdit(entry); setShowLootModal(true); }}
                            className="text-text-muted hover:text-accent text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteLoot(entry)}
                            className="text-status-error hover:text-status-error/80 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={`mat-${entry.id}`}
                    className="bg-[#121218] border-l-2 border-l-accent rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-text-primary">{entry.floor}</span>
                          <span className="text-text-muted">→</span>
                          <span className={`font-medium ${
                            entry.materialType === 'twine' ? 'text-blue-400' :
                            entry.materialType === 'glaze' ? 'text-green-400' :
                            'text-purple-400'
                          }`}>
                            {MATERIAL_LABELS[entry.materialType]}
                          </span>
                          <span className="text-text-muted">→</span>
                          <span className="text-text-primary">{getPlayerName(entry.recipientPlayerId)}</span>
                        </div>
                        <div className="text-xs text-text-muted mt-1">
                          {formatDate(entry.createdAt)}
                        </div>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteMaterial(entry.id)}
                          className="text-status-error hover:text-status-error/80 text-sm ml-4"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              }
            })
          )}
        </div>
      </section>

      {/* Right: Books Section */}
      <section className="bg-surface-card border border-border-default rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-lg text-text-primary">Book Balances</h3>
            {/* Week / All Time toggle */}
            <div className="flex bg-surface-base rounded-lg p-0.5">
              <button
                onClick={() => setBookViewMode('week')}
                className={`px-2.5 py-1 text-sm rounded transition-colors ${
                  bookViewMode === 'week'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Week {currentWeek}
              </button>
              <button
                onClick={() => setBookViewMode('allTime')}
                className={`px-2.5 py-1 text-sm rounded transition-colors ${
                  bookViewMode === 'allTime'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                All Time
              </button>
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetAll}
                className="px-3 py-1.5 text-sm rounded bg-status-error/20 text-status-error hover:bg-status-error/30 transition-colors"
              >
                Reset All
              </button>
              <button
                onClick={() => setShowFloorClearedModal(true)}
                className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-accent-bright transition-colors"
              >
                Mark Floor Cleared
              </button>
            </div>
          )}
        </div>
        <div className="p-4">
          {pageBalances.length === 0 ? (
            <p className="text-text-muted text-sm">No book data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-text-secondary text-sm">
                    <th className="text-left py-2 px-3">Player</th>
                    {(['I', 'II', 'III', 'IV'] as const).map((book) => (
                      <th key={book} className="text-center py-2 px-2 w-16">
                        <div className="flex flex-col items-center gap-1">
                          <span>{book}</span>
                          {canEdit && (
                            <button
                              onClick={() => handleResetColumn(book)}
                              className="text-xs text-text-muted hover:text-status-error transition-colors"
                              title={`Reset Book ${book} for all`}
                            >
                              reset
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageBalances.map((balance) => {
                    const player = players.find(p => p.id === balance.playerId);
                    if (!player) return null;

                    return (
                      <tr key={balance.playerId} className="border-t border-border-default">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <JobIcon job={player.job} size="sm" />
                            <span className="text-text-primary text-sm">{player.name}</span>
                          </div>
                        </td>
                        {(['I', 'II', 'III', 'IV'] as const).map((book) => {
                          const value = balance[`book${book}` as keyof typeof balance] as number;
                          return (
                            <td
                              key={book}
                              className={`text-center py-2 px-2 ${canEdit ? 'cursor-pointer hover:bg-accent/10 rounded transition-colors' : ''}`}
                              onClick={canEdit ? () => setEditBookState({
                                playerId: balance.playerId,
                                playerName: player.name,
                                bookType: book,
                                currentValue: value,
                              }) : undefined}
                            >
                              <span className={value > 0 ? 'text-text-primary' : 'text-text-muted'}>
                                {value}
                              </span>
                            </td>
                          );
                        })}
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            {canEdit && (
                              <button
                                onClick={() => handleResetRow(balance.playerId, player.name)}
                                className="p-1 text-text-muted hover:text-status-error transition-colors"
                                title="Reset all books for this player"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => setLedgerState({ playerId: balance.playerId, playerName: player.name })}
                              className="p-1 text-text-muted hover:text-accent transition-colors"
                              title="View history"
                            >
                              <img src="/icons/history-transparent-bg.png" alt="View history" className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Modals */}
      {showLootModal && (
        <AddLootEntryModal
          isOpen={showLootModal}
          onClose={() => { setShowLootModal(false); setEntryToEdit(undefined); }}
          onSubmit={handleAddLoot}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
          editEntry={entryToEdit}
        />
      )}

      {showMaterialModal && (
        <LogMaterialModal
          isOpen={showMaterialModal}
          onClose={() => setShowMaterialModal(false)}
          onSubmit={handleMaterialSubmit}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
        />
      )}

      {showFloorClearedModal && (
        <MarkFloorClearedModal
          isOpen={showFloorClearedModal}
          onClose={() => setShowFloorClearedModal(false)}
          onSubmit={handleMarkFloorCleared}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
        />
      )}

      {editBookState && (
        <EditBookBalanceModal
          isOpen={!!editBookState}
          onClose={() => setEditBookState(null)}
          onSubmit={handleEditBookBalance}
          playerName={editBookState.playerName}
          bookType={editBookState.bookType}
          currentBalance={editBookState.currentValue}
        />
      )}

      {ledgerState && (
        <PlayerLedgerModal
          isOpen={!!ledgerState}
          onClose={() => setLedgerState(null)}
          groupId={groupId}
          tierId={tierId}
          playerId={ledgerState.playerId}
          playerName={ledgerState.playerName}
        />
      )}
    </div>
  );
}
