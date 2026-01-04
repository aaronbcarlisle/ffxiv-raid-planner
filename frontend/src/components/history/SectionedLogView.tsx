/**
 * Sectioned Log View
 *
 * Sub-tab layout for the Log tab:
 * - Loot: Combined Loot & Materials section with Grid or Split view
 * - Books: Book Balances table with full-width display
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { JobIcon } from '../ui/JobIcon';
import { AddLootEntryModal } from './AddLootEntryModal';
import { LogMaterialModal } from './LogMaterialModal';
import { MarkFloorClearedModal } from './MarkFloorClearedModal';
import { EditBookBalanceModal } from './EditBookBalanceModal';
import { PlayerLedgerModal } from './PlayerLedgerModal';
import { LootCountBar } from './LootCountBar';
import { FloorSection } from './FloorSection';
import { WeeklyLootGrid } from './WeeklyLootGrid';
import { ResetConfirmModal, type ResetType } from '../ui/ResetConfirmModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { logLootAndUpdateGear, deleteLootAndRevertGear } from '../../utils/lootCoordination';
import { toast } from '../../stores/toastStore';
import type { SnapshotPlayer, LootLogEntry, LootLogEntryUpdate, MaterialLogEntry } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';
import { parseFloorName, type FloorNumber } from '../../gamedata/loot-tables';

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
    updateLootEntry,
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
  const [resetModalType, setResetModalType] = useState<ResetType | null>(null);

  // Confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    type: 'deleteLoot' | 'deleteMaterial' | 'resetRow' | 'resetColumn' | 'resetAll';
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

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

  const handleUpdateLoot = useCallback(async (updates: LootLogEntryUpdate) => {
    if (!entryToEdit) return;
    await updateLootEntry(groupId, tierId, entryToEdit.id, updates);
    await fetchLootLog(groupId, tierId, currentWeek);
    toast.success('Loot entry updated');
  }, [groupId, tierId, currentWeek, entryToEdit, updateLootEntry, fetchLootLog]);

  const handleDeleteLoot = useCallback((entry: LootLogEntry) => {
    setConfirmState({
      type: 'deleteLoot',
      title: 'Delete Loot Entry',
      message: `Delete the ${GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] || entry.itemSlot} drop?`,
      onConfirm: async () => {
        await deleteLootAndRevertGear(groupId, tierId, entry.id, entry, { revertGear: true });
        await fetchLootLog(groupId, tierId, currentWeek);
        await fetchWeekDataTypes(groupId, tierId);
        toast.success('Loot entry deleted');
        setConfirmState(null);
      },
    });
  }, [groupId, tierId, currentWeek, fetchLootLog, fetchWeekDataTypes]);

  const handleDeleteMaterial = useCallback((entryId: number) => {
    setConfirmState({
      type: 'deleteMaterial',
      title: 'Delete Material Entry',
      message: 'Delete this material entry?',
      onConfirm: async () => {
        await deleteMaterialEntry(groupId, tierId, entryId);
        await fetchMaterialLog(groupId, tierId, currentWeek);
        await fetchWeekDataTypes(groupId, tierId);
        toast.success('Material entry deleted');
        setConfirmState(null);
      },
    });
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
  const handleResetRow = useCallback((playerId: string, playerName: string) => {
    setConfirmState({
      type: 'resetRow',
      title: 'Reset Player Books',
      message: `Reset all book balances for ${playerName}?`,
      onConfirm: async () => {
        const { adjustBookBalance } = useLootTrackingStore.getState();
        const balance = pageBalances.find(b => b.playerId === playerId);
        if (!balance) {
          setConfirmState(null);
          return;
        }

        const books = ['I', 'II', 'III', 'IV'] as const;
        for (const book of books) {
          const value = balance[`book${book}` as keyof typeof balance] as number;
          if (value !== 0) {
            await adjustBookBalance(groupId, tierId, playerId, book, -value, currentWeek, 'Reset');
          }
        }
        await fetchPageBalances(groupId, tierId, getBalanceWeekParam());
        await fetchWeekDataTypes(groupId, tierId);
        toast.success(`Reset books for ${playerName}`);
        setConfirmState(null);
      },
    });
  }, [groupId, tierId, currentWeek, pageBalances, fetchPageBalances, getBalanceWeekParam, fetchWeekDataTypes]);

  // Reset a specific book type for all players (column)
  const handleResetColumn = useCallback((bookType: 'I' | 'II' | 'III' | 'IV') => {
    setConfirmState({
      type: 'resetColumn',
      title: 'Reset Book Column',
      message: `Reset Book ${bookType} for all players?`,
      onConfirm: async () => {
        const { adjustBookBalance } = useLootTrackingStore.getState();
        for (const balance of pageBalances) {
          const value = balance[`book${bookType}` as keyof typeof balance] as number;
          if (value !== 0) {
            await adjustBookBalance(groupId, tierId, balance.playerId, bookType, -value, currentWeek, 'Reset');
          }
        }
        await fetchPageBalances(groupId, tierId, getBalanceWeekParam());
        await fetchWeekDataTypes(groupId, tierId);
        toast.success(`Reset Book ${bookType} for all players`);
        setConfirmState(null);
      },
    });
  }, [groupId, tierId, currentWeek, pageBalances, fetchPageBalances, getBalanceWeekParam, fetchWeekDataTypes]);

  // Reset all books for all players
  const handleResetAll = useCallback(() => {
    setConfirmState({
      type: 'resetAll',
      title: 'Reset All Books',
      message: 'Reset ALL book balances for all players? This cannot be undone.',
      onConfirm: async () => {
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
        await fetchWeekDataTypes(groupId, tierId);
        toast.success('Reset all book balances');
        setConfirmState(null);
      },
    });
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

  // Handle reset confirmation (for the type-to-confirm modal)
  const handleResetConfirm = useCallback(async () => {
    if (!resetModalType) return;

    const { deleteLootEntry, deleteMaterialEntry, adjustBookBalance } = useLootTrackingStore.getState();

    try {
      // Reset loot log (all entries for this tier)
      if (resetModalType === 'loot' || resetModalType === 'all') {
        // Get all loot entries (not just current week)
        const allLootLog = useLootTrackingStore.getState().lootLog;
        for (const entry of allLootLog) {
          await deleteLootEntry(groupId, tierId, entry.id);
        }
        // Also delete all material entries
        const allMaterialLog = useLootTrackingStore.getState().materialLog;
        for (const entry of allMaterialLog) {
          await deleteMaterialEntry(groupId, tierId, entry.id);
        }
      }

      // Reset book balances
      if (resetModalType === 'books' || resetModalType === 'all') {
        const books = ['I', 'II', 'III', 'IV'] as const;
        for (const balance of pageBalances) {
          for (const book of books) {
            const value = balance[`book${book}` as keyof typeof balance] as number;
            if (value !== 0) {
              await adjustBookBalance(groupId, tierId, balance.playerId, book, -value, currentWeek, 'Reset all');
            }
          }
        }
      }

      // Refresh all data
      await Promise.all([
        fetchLootLog(groupId, tierId, currentWeek),
        fetchMaterialLog(groupId, tierId, currentWeek),
        fetchPageBalances(groupId, tierId, getBalanceWeekParam()),
        fetchWeekDataTypes(groupId, tierId),
      ]);

      const resetLabel = resetModalType === 'loot' ? 'loot log' : resetModalType === 'books' ? 'book balances' : 'all data';
      toast.success(`Reset ${resetLabel} complete`);
    } catch (error) {
      console.error('Reset failed:', error);
      toast.error('Reset failed');
    } finally {
      setResetModalType(null);
    }
  }, [resetModalType, groupId, tierId, currentWeek, pageBalances, fetchLootLog, fetchMaterialLog, fetchPageBalances, fetchWeekDataTypes, getBalanceWeekParam]);


  // Layout mode: 'split' (traditional 2-column) or 'grid' (weekly loot grid)
  const [layoutMode, setLayoutMode] = useState<'split' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem('log-layout-mode');
      return saved === 'grid' ? 'grid' : 'split';
    } catch {
      return 'split';
    }
  });

  // Persist layout mode
  const handleLayoutModeChange = useCallback((mode: 'split' | 'grid') => {
    setLayoutMode(mode);
    try {
      localStorage.setItem('log-layout-mode', mode);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Sub-tab state: 'loot' or 'books'
  const [subTab, setSubTab] = useState<'loot' | 'books'>(() => {
    try {
      const saved = localStorage.getItem('log-subtab');
      return saved === 'books' ? 'books' : 'loot';
    } catch {
      return 'loot';
    }
  });

  // Persist sub-tab selection
  const handleSubTabChange = useCallback((tab: 'loot' | 'books') => {
    setSubTab(tab);
    try {
      localStorage.setItem('log-subtab', tab);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // View mode for loot log: 'chronological' or 'byFloor'
  const [lootViewMode, setLootViewMode] = useState<'chronological' | 'byFloor'>('byFloor');

  // Floor filter for By Floor view (which floors to show)
  const [visibleFloors, setVisibleFloors] = useState<Set<FloorNumber>>(new Set([1, 2, 3, 4]));

  const toggleFloorVisibility = useCallback((floor: FloorNumber) => {
    setVisibleFloors(prev => {
      const next = new Set(prev);
      if (next.has(floor)) {
        // Don't allow hiding all floors
        if (next.size > 1) {
          next.delete(floor);
        }
      } else {
        next.add(floor);
      }
      return next;
    });
  }, []);

  // State for grid view pre-filled modal
  const [gridModalState, setGridModalState] = useState<{
    type: 'loot' | 'material';
    floor: FloorNumber;
    slot?: string;
    materialType?: string;
  } | null>(null);

  // Combine loot and material entries, sorted by creation time (newest first)
  const combinedEntries = useMemo(() => {
    const lootWithType = weekLootEntries.map(e => ({ ...e, entryType: 'loot' as const }));
    const materialWithType = weekMaterialEntries.map(e => ({ ...e, entryType: 'material' as const }));
    return [...lootWithType, ...materialWithType].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [weekLootEntries, weekMaterialEntries]);

  // Group entries by floor for floor view mode
  type CombinedEntry = (LootLogEntry & { entryType: 'loot' }) | (MaterialLogEntry & { entryType: 'material' });
  const entriesByFloor = useMemo(() => {
    const grouped = new Map<FloorNumber, CombinedEntry[]>();
    // Initialize all floors
    ([1, 2, 3, 4] as FloorNumber[]).forEach(f => grouped.set(f, []));

    combinedEntries.forEach(entry => {
      const floorNum = parseFloorName(entry.floor);
      const arr = grouped.get(floorNum) || [];
      arr.push(entry);
      grouped.set(floorNum, arr);
    });

    return grouped;
  }, [combinedEntries]);

  // Helper to render a single loot or material entry
  const renderEntry = (entry: CombinedEntry) => {
    if (entry.entryType === 'loot') {
      const slotName = GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] || entry.itemSlot;
      return (
        <div
          key={`loot-${entry.id}`}
          className="bg-surface-elevated border-l-2 border-l-accent rounded-lg p-3"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border-subtle">
                  {entry.floor}
                </span>
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
          className="bg-surface-elevated border-l-2 border-l-accent rounded-lg p-3"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border-subtle">
                  {entry.floor}
                </span>
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
  };

  // Handle grid view log clicks
  const handleGridLogLoot = useCallback((floor: FloorNumber, slot: string) => {
    setGridModalState({ type: 'loot', floor, slot });
    setEntryToEdit(undefined);
    setShowLootModal(true);
  }, []);

  const handleGridLogMaterial = useCallback((floor: FloorNumber, materialType: string) => {
    setGridModalState({ type: 'material', floor, materialType });
    setShowMaterialModal(true);
  }, []);

  const handleGridDeleteLoot = useCallback(async (entryId: number) => {
    const entry = weekLootEntries.find(e => e.id === entryId);
    if (entry) {
      await handleDeleteLoot(entry);
    }
  }, [weekLootEntries, handleDeleteLoot]);

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between border-b border-border-default pb-3">
        <div className="flex gap-1">
          <button
            onClick={() => handleSubTabChange('loot')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              subTab === 'loot'
                ? 'bg-surface-card text-accent border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            Loot Log
          </button>
          <button
            onClick={() => handleSubTabChange('books')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              subTab === 'books'
                ? 'bg-surface-card text-accent border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            Book Balances
          </button>

          {/* Reset dropdown */}
          {canEdit && (
            <div className="relative ml-4">
              <details className="group">
                <summary className="px-3 py-1.5 text-sm text-status-error border border-status-error/30 rounded cursor-pointer
                                    hover:bg-status-error/10 transition-colors flex items-center gap-1.5 list-none">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Reset
                  <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="absolute left-0 top-full mt-1 bg-surface-card border border-border-default rounded-lg shadow-lg z-20 min-w-[160px]">
                  <button
                    onClick={() => setResetModalType('loot')}
                    className="w-full px-4 py-2 text-sm text-left text-text-primary hover:bg-surface-elevated transition-colors first:rounded-t-lg"
                  >
                    Reset Loot Log
                  </button>
                  <button
                    onClick={() => setResetModalType('books')}
                    className="w-full px-4 py-2 text-sm text-left text-text-primary hover:bg-surface-elevated transition-colors"
                  >
                    Reset Book Balances
                  </button>
                  <div className="border-t border-border-default" />
                  <button
                    onClick={() => setResetModalType('all')}
                    className="w-full px-4 py-2 text-sm text-left text-status-error font-medium hover:bg-status-error/10 transition-colors last:rounded-b-lg"
                  >
                    Reset All Data
                  </button>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Loot-specific controls (only show on loot tab) */}
        {subTab === 'loot' && (
          <div className="flex items-center gap-3">
            {/* Layout Mode Toggle */}
            <div className="flex bg-surface-base rounded-lg p-0.5">
              <button
                onClick={() => handleLayoutModeChange('grid')}
                className={`px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 font-bold ${
                  layoutMode === 'grid'
                    ? 'bg-accent text-accent-contrast'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Grid
              </button>
              <button
                onClick={() => handleLayoutModeChange('split')}
                className={`px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 font-bold ${
                  layoutMode === 'split'
                    ? 'bg-accent text-accent-contrast'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                </svg>
                List
              </button>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setGridModalState(null); setEntryToEdit(undefined); setShowLootModal(true); }}
                  className="px-3 py-1.5 text-sm rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors"
                >
                  + Log Loot
                </button>
                <button
                  onClick={() => { setGridModalState(null); setShowMaterialModal(true); }}
                  className="px-3 py-1.5 text-sm rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors"
                >
                  + Log Material
                </button>
              </div>
            )}
          </div>
        )}

        {/* Books-specific controls (only show on books tab) */}
        {subTab === 'books' && canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFloorClearedModal(true)}
              className="px-3 py-1.5 text-sm rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors"
            >
              Mark Floor Cleared
            </button>
          </div>
        )}
      </div>

      {/* Loot Tab - Grid Layout */}
      {subTab === 'loot' && layoutMode === 'grid' && (
        <WeeklyLootGrid
          players={players}
          lootLog={lootLog}
          materialLog={materialLog}
          floors={floors}
          currentWeek={currentWeek}
          canEdit={canEdit}
          onLogLoot={handleGridLogLoot}
          onLogMaterial={handleGridLogMaterial}
          onDeleteLoot={handleGridDeleteLoot}
          onDeleteMaterial={handleDeleteMaterial}
        />
      )}

      {/* Loot Tab - List Layout */}
      {subTab === 'loot' && layoutMode === 'split' && (
        <section className="bg-surface-card border border-border-default rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-lg text-text-primary">Loot Log</h3>
              {/* View mode toggle */}
              <div className="flex bg-surface-base rounded-lg p-0.5">
                <button
                  onClick={() => setLootViewMode('byFloor')}
                  className={`px-2.5 py-1 text-xs rounded transition-colors font-bold ${
                    lootViewMode === 'byFloor'
                      ? 'bg-accent text-accent-contrast'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  By Floor
                </button>
                <button
                  onClick={() => setLootViewMode('chronological')}
                  className={`px-2.5 py-1 text-xs rounded transition-colors font-bold ${
                    lootViewMode === 'chronological'
                      ? 'bg-accent text-accent-contrast'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Timeline
                </button>
              </div>
            </div>
            {/* Floor filter - only shown in By Floor mode */}
            {lootViewMode === 'byFloor' && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-muted mr-1">Floors:</span>
                {([1, 2, 3, 4] as FloorNumber[]).map(floor => (
                  <button
                    key={floor}
                    onClick={() => toggleFloorVisibility(floor)}
                    className={`px-2 py-0.5 text-xs rounded transition-colors font-bold ${
                      visibleFloors.has(floor)
                        ? 'bg-accent text-accent-contrast'
                        : 'bg-surface-base text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {floors[floor - 1]?.split(' ')[0] || `F${floor}`}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto">
            {/* Loot Count Summary Bar */}
            <LootCountBar
              players={players}
              lootLog={lootLog}
              currentWeek={currentWeek}
            />
            {combinedEntries.length === 0 ? (
              <p className="text-text-muted text-sm">No loot or materials logged this week.</p>
            ) : lootViewMode === 'byFloor' ? (
              /* Floor-grouped view with filter */
              ([4, 3, 2, 1] as FloorNumber[]).filter(f => visibleFloors.has(f)).map(floorNum => {
                const floorEntries = entriesByFloor.get(floorNum) || [];
                if (floorEntries.length === 0) return null;
                const floorName = floorEntries[0]?.floor || floors[floorNum - 1] || `Floor ${floorNum}`;

                return (
                  <FloorSection
                    key={floorNum}
                    floor={floorNum}
                    floorName={floorName}
                    entryCount={floorEntries.length}
                  >
                    {floorEntries.map(entry => renderEntry(entry))}
                  </FloorSection>
                );
              })
            ) : (
              /* Chronological view */
              combinedEntries.map(entry => renderEntry(entry))
            )}
          </div>
        </section>
      )}

      {/* Books Tab - Full Width */}
      {subTab === 'books' && (
        <section className="bg-surface-card border border-border-default rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-lg text-text-primary">Book Balances</h3>
              {/* Week / All Time toggle */}
              <div className="flex bg-surface-base rounded-lg p-0.5">
                <button
                  onClick={() => setBookViewMode('week')}
                  className={`px-2.5 py-1 text-sm rounded transition-colors font-bold ${
                    bookViewMode === 'week'
                      ? 'bg-accent text-accent-contrast'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Week {currentWeek}
                </button>
                <button
                  onClick={() => setBookViewMode('allTime')}
                  className={`px-2.5 py-1 text-sm rounded transition-colors font-bold ${
                    bookViewMode === 'allTime'
                      ? 'bg-accent text-accent-contrast'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  All Time
                </button>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={handleResetAll}
                className="px-3 py-1.5 text-sm rounded bg-status-error/20 text-status-error hover:bg-status-error/30 transition-colors"
              >
                Reset All
              </button>
            )}
          </div>
          <div className="p-4">
            {pageBalances.length === 0 ? (
              <p className="text-text-muted text-sm">No book data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-auto">
                  <thead>
                    <tr className="text-text-secondary text-sm">
                      <th className="text-left py-2 px-2 whitespace-nowrap">Player</th>
                      {(['I', 'II', 'III', 'IV'] as const).map((book) => (
                        <th key={book} className="text-center py-2 px-2 w-16">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs">{book}</span>
                            {canEdit && (
                              <button
                                onClick={() => handleResetColumn(book)}
                                className="text-[10px] text-text-muted hover:text-status-error transition-colors"
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
                          <td className="py-2 px-2">
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
                                <span className={`text-base font-medium ${value > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                                  {value}
                                </span>
                              </td>
                            );
                          })}
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1 justify-end">
                              {canEdit && (
                                <button
                                  onClick={() => handleResetRow(balance.playerId, player.name)}
                                  className="p-1 text-text-muted hover:text-status-error transition-colors"
                                  title="Reset all books for this player"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={() => setLedgerState({ playerId: balance.playerId, playerName: player.name })}
                                className="p-1 text-text-muted hover:text-accent transition-colors"
                                title="View history"
                              >
                                <img src="/icons/history-transparent-bg.png" alt="View history" className="w-3.5 h-3.5" />
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
      )}

      {/* Modals */}
      {showLootModal && (
        <AddLootEntryModal
          isOpen={showLootModal}
          onClose={() => { setShowLootModal(false); setEntryToEdit(undefined); setGridModalState(null); }}
          onSubmit={handleAddLoot}
          onUpdate={handleUpdateLoot}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
          editEntry={entryToEdit}
          presetFloor={gridModalState?.floor ? floors[gridModalState.floor - 1] : undefined}
          presetSlot={gridModalState?.slot}
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
          canEdit={canEdit}
          onHistoryCleared={() => {
            // Refresh page balances and week data after clearing history
            fetchPageBalances(groupId, tierId, getBalanceWeekParam());
            fetchWeekDataTypes(groupId, tierId);
          }}
        />
      )}

      {/* Reset Confirmation Modal */}
      {resetModalType && (
        <ResetConfirmModal
          isOpen={!!resetModalType}
          resetType={resetModalType}
          onConfirm={handleResetConfirm}
          onCancel={() => setResetModalType(null)}
        />
      )}

      {/* Generic Confirmation Modal */}
      {confirmState && (
        <ConfirmModal
          isOpen={!!confirmState}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.type.startsWith('delete') ? 'Delete' : 'Reset'}
          variant="danger"
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
