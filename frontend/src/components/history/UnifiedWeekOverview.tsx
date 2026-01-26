/**
 * Unified Week Overview
 *
 * Main unified table combining loot, materials, and book changes per player.
 * Replaces the previous two-panel layout (LootLogPanel + PageBalancesPanel).
 */

import { useState, useEffect, useCallback, memo } from 'react';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useWeekSummary, formatBookChange, MATERIAL_INFO } from '../../hooks/useWeekSummary';
import { LogMaterialModal } from './LogMaterialModal';
import { AddLootEntryModal } from './AddLootEntryModal';
import { MarkFloorClearedModal } from './MarkFloorClearedModal';
import { DeleteLootConfirmModal } from './DeleteLootConfirmModal';
import { EditBookBalanceModal } from './EditBookBalanceModal';
import { PlayerLedgerModal } from './PlayerLedgerModal';
import { Tooltip } from '../primitives/Tooltip';
import { JobIcon } from '../ui/JobIcon';
import { logLootAndUpdateGear, deleteLootAndRevertGear } from '../../utils/lootCoordination';
import { deleteMaterialAndRevertGear } from '../../utils/materialCoordination';
import { toast } from '../../stores/toastStore';
import type { SnapshotPlayer, LootLogEntry, MaterialType } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';

interface UnifiedWeekOverviewProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  canEdit: boolean;
  onWeekChange?: (weekNumber: number) => void;
}

// Memoized player row component to prevent unnecessary re-renders
const WeekSummaryRow = memo(function WeekSummaryRow({
  summary,
  canEdit,
  onEditLoot,
  onDeleteLoot,
  onDeleteMaterial,
  onEditBook,
  onViewHistory,
}: {
  summary: ReturnType<typeof useWeekSummary>[number];
  canEdit: boolean;
  onEditLoot: (entryId: number) => void;
  onDeleteLoot: (entryId: number) => void;
  onDeleteMaterial: (entryId: number) => void;
  onEditBook: (playerId: string, playerName: string, bookType: 'I' | 'II' | 'III' | 'IV', currentValue: number) => void;
  onViewHistory: (playerId: string, playerName: string) => void;
}) {
  const { player, lootReceived, materialEntries, bookChanges, floorsCleared } = summary;

  const bookCellClass = canEdit
    ? 'px-2 py-2 text-center text-sm cursor-pointer hover:bg-accent/10 rounded transition-colors'
    : 'px-2 py-2 text-center text-sm';

  return (
    <tr className="border-b border-border-default last:border-b-0 hover:bg-surface-elevated/50 transition-colors">
      {/* Player */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <JobIcon job={player.job} size="sm" />
          <span className="text-sm font-medium text-text-primary">{player.name}</span>
        </div>
        {floorsCleared.length > 0 && (
          <div className="text-xs text-text-muted mt-0.5">
            Cleared: {floorsCleared.join(', ')}
          </div>
        )}
      </td>

      {/* Loot Received */}
      <td className="px-3 py-2">
        {lootReceived.length === 0 ? (
          <span className="text-sm text-text-muted">-</span>
        ) : (
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            {lootReceived.map((loot, index) => (
              <span key={loot.entryId} className="inline-flex items-center gap-1 group">
                <span className="text-sm text-text-primary">{loot.slotName}</span>
                <span
                  className={`text-xs px-1 py-0.5 rounded ${
                    loot.method === 'drop'
                      ? 'bg-status-success/20 text-status-success'
                      : loot.method === 'book'
                      ? 'bg-status-warning/20 text-status-warning'
                      : 'bg-accent/20 text-accent'
                  }`}
                >
                  {loot.method}
                </span>
                {canEdit && (
                  <>
                    <Tooltip content="Edit entry">
                      <button
                        onClick={() => onEditLoot(loot.entryId)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </Tooltip>
                    <Tooltip content="Delete entry">
                      <button
                        onClick={() => onDeleteLoot(loot.entryId)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-status-error hover:bg-status-error/20 rounded transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </Tooltip>
                  </>
                )}
                {index < lootReceived.length - 1 && (
                  <span className="text-text-muted mx-0.5">•</span>
                )}
              </span>
            ))}
          </div>
        )}
      </td>

      {/* Materials */}
      <td className="px-3 py-2">
        {materialEntries.length === 0 ? (
          <span className="text-sm text-text-muted">-</span>
        ) : (
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            {materialEntries.map((entry, index) => {
              const info = MATERIAL_INFO[entry.materialType];
              return (
                <span key={entry.entryId} className="inline-flex items-center gap-1 group">
                  <span className={`text-sm ${info.color}`}>
                    {info.shortLabel}
                  </span>
                  {canEdit && (
                    <Tooltip content="Delete material entry">
                      <button
                        onClick={() => onDeleteMaterial(entry.entryId)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-status-error hover:bg-status-error/20 rounded transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </Tooltip>
                  )}
                  {index < materialEntries.length - 1 && (
                    <span className="text-text-muted mx-0.5">•</span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </td>

      {/* Book I */}
      <td
        className={bookCellClass}
        onClick={canEdit ? () => onEditBook(player.id, player.name, 'I', bookChanges.I) : undefined}
        title={canEdit ? 'Click to adjust' : undefined}
      >
        <span className={bookChanges.I !== 0 ? (bookChanges.I > 0 ? 'text-status-success' : 'text-status-error') : 'text-text-muted'}>
          {formatBookChange(bookChanges.I)}
        </span>
      </td>

      {/* Book II */}
      <td
        className={bookCellClass}
        onClick={canEdit ? () => onEditBook(player.id, player.name, 'II', bookChanges.II) : undefined}
        title={canEdit ? 'Click to adjust' : undefined}
      >
        <span className={bookChanges.II !== 0 ? (bookChanges.II > 0 ? 'text-status-success' : 'text-status-error') : 'text-text-muted'}>
          {formatBookChange(bookChanges.II)}
        </span>
      </td>

      {/* Book III */}
      <td
        className={bookCellClass}
        onClick={canEdit ? () => onEditBook(player.id, player.name, 'III', bookChanges.III) : undefined}
        title={canEdit ? 'Click to adjust' : undefined}
      >
        <span className={bookChanges.III !== 0 ? (bookChanges.III > 0 ? 'text-status-success' : 'text-status-error') : 'text-text-muted'}>
          {formatBookChange(bookChanges.III)}
        </span>
      </td>

      {/* Book IV */}
      <td
        className={bookCellClass}
        onClick={canEdit ? () => onEditBook(player.id, player.name, 'IV', bookChanges.IV) : undefined}
        title={canEdit ? 'Click to adjust' : undefined}
      >
        <span className={bookChanges.IV !== 0 ? (bookChanges.IV > 0 ? 'text-status-success' : 'text-status-error') : 'text-text-muted'}>
          {formatBookChange(bookChanges.IV)}
        </span>
      </td>

      {/* History button */}
      <td className="px-1 py-2">
        <button
          onClick={() => onViewHistory(player.id, player.name)}
          className="p-1 rounded hover:bg-accent/10 transition-colors"
          title={`View history for ${player.name}`}
        >
          <img
            src="/icons/history-transparent-bg.png"
            alt="View history"
            className="w-4 h-4"
          />
        </button>
      </td>
    </tr>
  );
});

export function UnifiedWeekOverview({
  groupId,
  tierId,
  players,
  floors,
  currentWeek,
  canEdit,
  onWeekChange,
}: UnifiedWeekOverviewProps) {
  const {
    lootLog,
    materialLog,
    pageLedger,
    isLoading,
    fetchLootLog,
    fetchMaterialLog,
    fetchPageLedger,
    fetchPageBalances,
    markFloorCleared,
    adjustBookBalance,
    createMaterialEntry,
    updateLootEntry,
  } = useLootTrackingStore();

  // Modal states
  const [showAddLootModal, setShowAddLootModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showMarkClearedModal, setShowMarkClearedModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<LootLogEntry | null>(null);
  const [entryToEdit, setEntryToEdit] = useState<LootLogEntry | null>(null);
  const [editBookState, setEditBookState] = useState<{
    playerId: string;
    playerName: string;
    bookType: 'I' | 'II' | 'III' | 'IV';
    currentValue: number;
  } | null>(null);
  const [ledgerPlayer, setLedgerPlayer] = useState<{ id: string; name: string } | null>(null);

  // Fetch all data for the current week
  useEffect(() => {
    fetchLootLog(groupId, tierId, currentWeek);
    fetchMaterialLog(groupId, tierId, currentWeek);
    fetchPageLedger(groupId, tierId, currentWeek);
    fetchPageBalances(groupId, tierId, currentWeek);
  }, [groupId, tierId, currentWeek, fetchLootLog, fetchMaterialLog, fetchPageLedger, fetchPageBalances]);

  // Use the week summary hook
  const weekSummaries = useWeekSummary({
    players,
    lootLog,
    materialLog,
    pageLedger,
    week: currentWeek,
  });

  // Handle add loot
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
    const player = players.find((p) => p.id === entry.recipientPlayerId);
    const slotName = GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] || entry.itemSlot;
    toast.success(`Logged ${slotName} for ${player?.name || 'player'}`);
  }, [groupId, tierId, players, onWeekChange, fetchLootLog]);

  // Handle delete loot
  const handleDeleteLoot = useCallback((entryId: number) => {
    const entry = lootLog.find(e => e.id === entryId);
    if (entry) {
      setEntryToDelete(entry);
    }
  }, [lootLog]);

  const handleDeleteConfirm = useCallback(async (revertGear: boolean) => {
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
  }, [entryToDelete, groupId, tierId, currentWeek, fetchLootLog]);

  // Handle edit loot
  const handleEditLoot = useCallback((entryId: number) => {
    const entry = lootLog.find(e => e.id === entryId);
    if (entry) {
      setEntryToEdit(entry);
    }
  }, [lootLog]);

  const handleUpdateLoot = useCallback(async (updates: import('../../types').LootLogEntryUpdate) => {
    if (!entryToEdit) return;
    try {
      await updateLootEntry(groupId, tierId, entryToEdit.id, updates);
      await fetchLootLog(groupId, tierId, currentWeek);
      toast.success('Loot entry updated');
    } catch {
      toast.error('Failed to update entry');
      throw new Error('Failed to update');
    } finally {
      setEntryToEdit(null);
    }
  }, [entryToEdit, groupId, tierId, currentWeek, updateLootEntry, fetchLootLog]);

  // Handle material logging
  const handleLogMaterial = useCallback(async (data: {
    weekNumber: number;
    floor: string;
    materialType: MaterialType;
    recipientPlayerId: string;
    notes?: string;
  }) => {
    await createMaterialEntry(groupId, tierId, data);
    await fetchMaterialLog(groupId, tierId, currentWeek);
    const player = players.find(p => p.id === data.recipientPlayerId);
    toast.success(`Logged ${MATERIAL_INFO[data.materialType].label} for ${player?.name || 'player'}`);
  }, [groupId, tierId, currentWeek, players, createMaterialEntry, fetchMaterialLog]);

  // Handle delete material
  const handleDeleteMaterial = useCallback(async (entryId: number) => {
    const entry = materialLog.find(e => e.id === entryId);
    if (!entry) {
      toast.error('Material entry not found');
      return;
    }
    try {
      await deleteMaterialAndRevertGear(groupId, tierId, entryId, entry, {
        revertGear: true,
      });
      await fetchMaterialLog(groupId, tierId, currentWeek);
      toast.success('Deleted material entry');
    } catch {
      toast.error('Failed to delete material entry');
    }
  }, [groupId, tierId, currentWeek, materialLog, fetchMaterialLog]);

  // Handle mark floor cleared
  const handleMarkFloorCleared = useCallback(async (request: Parameters<typeof markFloorCleared>[2]) => {
    await markFloorCleared(groupId, tierId, request);
    await Promise.all([
      fetchPageLedger(groupId, tierId, currentWeek),
      fetchPageBalances(groupId, tierId, currentWeek),
    ]);
    toast.success(`Marked ${request.floor} as cleared for ${request.playerIds.length} players`);
  }, [groupId, tierId, currentWeek, markFloorCleared, fetchPageLedger, fetchPageBalances]);

  // Handle book editing
  const handleEditBook = useCallback((playerId: string, playerName: string, bookType: 'I' | 'II' | 'III' | 'IV', currentValue: number) => {
    setEditBookState({ playerId, playerName, bookType, currentValue });
  }, []);

  const handleBookAdjust = useCallback(async (adjustment: number, notes?: string) => {
    if (!editBookState) return;
    try {
      await adjustBookBalance(
        groupId,
        tierId,
        editBookState.playerId,
        editBookState.bookType,
        adjustment,
        currentWeek,
        notes
      );
      await Promise.all([
        fetchPageLedger(groupId, tierId, currentWeek),
        fetchPageBalances(groupId, tierId, currentWeek),
      ]);
      toast.success(`Adjusted Book ${editBookState.bookType} for ${editBookState.playerName}`);
    } catch {
      toast.error('Failed to adjust book balance');
      throw new Error('Failed to adjust');
    }
  }, [editBookState, groupId, tierId, currentWeek, adjustBookBalance, fetchPageLedger, fetchPageBalances]);

  // Handle view history
  const handleViewHistory = useCallback((playerId: string, playerName: string) => {
    setLedgerPlayer({ id: playerId, name: playerName });
  }, []);

  const hasAnyActivity = weekSummaries.some(s =>
    s.lootReceived.length > 0 ||
    s.materialsReceived.twine > 0 ||
    s.materialsReceived.glaze > 0 ||
    s.materialsReceived.solvent > 0 ||
    s.bookChanges.I !== 0 ||
    s.bookChanges.II !== 0 ||
    s.bookChanges.III !== 0 ||
    s.bookChanges.IV !== 0
  );

  return (
    <div className="bg-surface-card rounded-lg border border-border-default">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between p-4 border-b border-border-default">
        <h3 className="text-lg font-medium text-text-primary">Week {currentWeek} Overview</h3>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMarkClearedModal(true)}
              className="px-3 py-1.5 rounded bg-surface-interactive text-text-primary text-sm hover:bg-surface-raised transition-colors"
            >
              Mark Floor Cleared
            </button>
            <button
              onClick={() => setShowAddLootModal(true)}
              className="px-3 py-1.5 rounded bg-accent text-accent-contrast text-sm font-bold hover:bg-accent-hover transition-colors"
            >
              + Log Loot
            </button>
            <button
              onClick={() => setShowMaterialModal(true)}
              className="px-3 py-1.5 rounded bg-membership-lead text-white text-sm hover:bg-membership-lead/80 transition-colors"
            >
              + Log Material
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-text-muted">Loading...</div>
      ) : weekSummaries.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          No configured players to display
        </div>
      ) : !hasAnyActivity ? (
        <div className="text-center py-12 text-text-muted">
          <p className="mb-2">No activity recorded for Week {currentWeek}</p>
          {canEdit && (
            <p className="text-sm">
              Use the buttons above to log loot, materials, or mark floors as cleared.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-surface-elevated/50">
                <th className="px-3 py-3 text-left text-sm font-medium text-text-secondary">Player</th>
                <th className="px-3 py-3 text-left text-sm font-medium text-text-secondary">Loot Received</th>
                <th className="px-3 py-3 text-left text-sm font-medium text-text-secondary">Materials</th>
                <th className="px-2 py-3 text-center text-sm font-medium text-text-secondary w-16">I</th>
                <th className="px-2 py-3 text-center text-sm font-medium text-text-secondary w-16">II</th>
                <th className="px-2 py-3 text-center text-sm font-medium text-text-secondary w-16">III</th>
                <th className="px-2 py-3 text-center text-sm font-medium text-text-secondary w-16">IV</th>
                <th className="px-1 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {weekSummaries.map((summary) => (
                <WeekSummaryRow
                  key={summary.player.id}
                  summary={summary}
                  canEdit={canEdit}
                  onEditLoot={handleEditLoot}
                  onDeleteLoot={handleDeleteLoot}
                  onDeleteMaterial={handleDeleteMaterial}
                  onEditBook={handleEditBook}
                  onViewHistory={handleViewHistory}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showAddLootModal && (
        <AddLootEntryModal
          isOpen={showAddLootModal}
          onClose={() => setShowAddLootModal(false)}
          onSubmit={handleAddLoot}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
        />
      )}

      {showMaterialModal && (
        <LogMaterialModal
          isOpen={showMaterialModal}
          onClose={() => setShowMaterialModal(false)}
          onSubmit={handleLogMaterial}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
          groupId={groupId}
          tierId={tierId}
        />
      )}

      {showMarkClearedModal && (
        <MarkFloorClearedModal
          isOpen={showMarkClearedModal}
          onClose={() => setShowMarkClearedModal(false)}
          onSubmit={handleMarkFloorCleared}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
        />
      )}

      {entryToDelete && (
        <DeleteLootConfirmModal
          isOpen={!!entryToDelete}
          onClose={() => setEntryToDelete(null)}
          onConfirm={handleDeleteConfirm}
          entry={entryToDelete}
          playerName={entryToDelete.recipientPlayerName}
        />
      )}

      {entryToEdit && (
        <AddLootEntryModal
          isOpen={!!entryToEdit}
          onClose={() => setEntryToEdit(null)}
          onSubmit={handleAddLoot}
          onUpdate={handleUpdateLoot}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
          editEntry={entryToEdit}
        />
      )}

      {editBookState && (
        <EditBookBalanceModal
          isOpen={!!editBookState}
          onClose={() => setEditBookState(null)}
          onSubmit={handleBookAdjust}
          playerName={editBookState.playerName}
          bookType={editBookState.bookType}
          currentBalance={editBookState.currentValue}
        />
      )}

      {ledgerPlayer && (
        <PlayerLedgerModal
          isOpen={!!ledgerPlayer}
          onClose={() => setLedgerPlayer(null)}
          groupId={groupId}
          tierId={tierId}
          playerId={ledgerPlayer.id}
          playerName={ledgerPlayer.name}
        />
      )}
    </div>
  );
}
