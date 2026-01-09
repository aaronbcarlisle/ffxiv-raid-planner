/**
 * Sectioned Log View
 *
 * Layout for the Log tab with Loot Log (main) and Book Balances (sidebar).
 * - Loot Log takes majority of space (left side)
 * - Book Balances shown as compact sidebar (right side)
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
import { WeeklyLootGrid, LootFairnessLegend } from './WeeklyLootGrid';
import { ResetConfirmModal, type ResetType } from '../ui/ResetConfirmModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../primitives/Dropdown';
import { logLootAndUpdateGear, deleteLootAndRevertGear } from '../../utils/lootCoordination';
import { toast } from '../../stores/toastStore';
import type { SnapshotPlayer, LootLogEntry, LootLogEntryUpdate, MaterialLogEntry, MaterialType } from '../../types';
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
  universal_tomestone: 'Universal Tomestone',
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
    materialType: MaterialType;
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

    const { deleteMaterialEntry, adjustBookBalance } = useLootTrackingStore.getState();

    try {
      // Reset loot log (all entries for this tier)
      if (resetModalType === 'loot' || resetModalType === 'all') {
        // Get all loot entries (not just current week)
        const allLootLog = useLootTrackingStore.getState().lootLog;
        for (const entry of allLootLog) {
          // Use deleteLootAndRevertGear to sync gear state (uncheck items)
          await deleteLootAndRevertGear(groupId, tierId, entry.id, entry, { revertGear: true });
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


  // Layout mode: 'grid' (weekly loot grid) or 'split' (traditional list view)
  // Default to 'grid' for first-time users
  const [layoutMode, setLayoutMode] = useState<'split' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem('log-layout-mode');
      return saved === 'split' ? 'split' : 'grid';
    } catch {
      return 'grid';
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

  // Book balances sidebar collapsed state
  const [booksSidebarCollapsed, setBooksSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('books-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Persist sidebar collapsed state
  const toggleBooksSidebar = useCallback(() => {
    setBooksSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('books-sidebar-collapsed', String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
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
      const isWeapon = entry.itemSlot === 'weapon';
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
                {isWeapon && entry.weaponJob && (
                  <JobIcon job={entry.weaponJob} size="sm" />
                )}
                <span className="text-text-primary font-medium">
                  {isWeapon && entry.weaponJob ? `Weapon (${entry.weaponJob})` : slotName}
                </span>
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
                {entry.isExtra && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border-subtle">
                    Extra
                  </span>
                )}
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
      {/* Header Controls */}
      <div className="flex items-center justify-between border-b border-border-default pb-3">
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

          {/* Reset dropdown */}
          {canEdit && (
            <Dropdown>
              <DropdownTrigger asChild>
                <button className="px-3 py-1.5 text-sm text-status-error border border-status-error/30 rounded cursor-pointer
                                    hover:bg-status-error/10 transition-colors flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Reset
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </DropdownTrigger>
              <DropdownContent align="start">
                <DropdownItem onSelect={() => setResetModalType('loot')}>
                  Reset Loot Log
                </DropdownItem>
                <DropdownItem onSelect={() => setResetModalType('books')}>
                  Reset Book Balances
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem
                  onSelect={() => setResetModalType('all')}
                  className="text-status-error focus:text-status-error"
                >
                  Reset All Data
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          )}
        </div>

        {/* Action buttons */}
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFloorClearedModal(true)}
              className="px-3 py-1.5 text-sm rounded bg-surface-interactive text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
            >
              Mark Floor Cleared
            </button>
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

      {/* Main Content - Side by Side Layout */}
      <div className="flex gap-4 items-stretch">
        {/* Loot Log - Main Area */}
        <div className="flex-1 min-w-0">
          {/* Grid Layout */}
          {layoutMode === 'grid' && (
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

          {/* List Layout */}
          {layoutMode === 'split' && (
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
        </div>

        {/* Book Balances - Sidebar */}
        <div className={`transition-all duration-200 ${booksSidebarCollapsed ? 'w-10' : 'w-72'} flex-shrink-0`}>
          <section className="bg-surface-card border border-border-default rounded-lg h-full">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
              {!booksSidebarCollapsed && (
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm text-text-primary">Books</h3>
                  {/* Week / All Time toggle */}
                  <div className="flex bg-surface-base rounded p-0.5">
                    <button
                      onClick={() => setBookViewMode('week')}
                      className={`px-1.5 py-0.5 text-[10px] rounded transition-colors font-bold ${
                        bookViewMode === 'week'
                          ? 'bg-accent text-accent-contrast'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      W{currentWeek}
                    </button>
                    <button
                      onClick={() => setBookViewMode('allTime')}
                      className={`px-1.5 py-0.5 text-[10px] rounded transition-colors font-bold ${
                        bookViewMode === 'allTime'
                          ? 'bg-accent text-accent-contrast'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      All
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={toggleBooksSidebar}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
                title={booksSidebarCollapsed ? 'Expand' : 'Collapse'}
              >
                <svg className={`w-4 h-4 transition-transform ${booksSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Sidebar Content */}
            {!booksSidebarCollapsed && (
              <div className="p-2 max-h-[600px] overflow-y-auto">
                {pageBalances.length === 0 ? (
                  <p className="text-text-muted text-xs p-2">No book data.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-text-muted">
                        <th className="text-left py-1 px-1">Player</th>
                        {(['I', 'II', 'III', 'IV'] as const).map((book) => (
                          <th key={book} className="text-center py-1 px-0.5 w-7">{book}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageBalances.map((balance) => {
                        const player = players.find(p => p.id === balance.playerId);
                        if (!player) return null;

                        return (
                          <tr key={balance.playerId} className="border-t border-border-subtle hover:bg-surface-elevated/50">
                            <td className="py-1.5 px-1">
                              <div className="flex items-center gap-1.5">
                                <JobIcon job={player.job} size="xs" />
                                <span className="text-text-primary truncate max-w-[80px]">{player.name}</span>
                              </div>
                            </td>
                            {(['I', 'II', 'III', 'IV'] as const).map((book) => {
                              const value = balance[`book${book}` as keyof typeof balance] as number;
                              return (
                                <td
                                  key={book}
                                  className={`text-center py-1.5 px-0.5 ${canEdit ? 'cursor-pointer hover:bg-accent/20 rounded transition-colors' : ''}`}
                                  onClick={canEdit ? () => setEditBookState({
                                    playerId: balance.playerId,
                                    playerName: player.name,
                                    bookType: book,
                                    currentValue: value,
                                  }) : undefined}
                                >
                                  <span className={`font-medium ${value > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                                    {value}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Loot Fairness Legend - rendered outside flex container so sidebar aligns with grid */}
      {layoutMode === 'grid' && <LootFairnessLegend />}

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
          onClose={() => { setShowMaterialModal(false); setGridModalState(null); }}
          onSubmit={handleMaterialSubmit}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
          presetFloor={gridModalState?.floor ? floors[gridModalState.floor - 1] : undefined}
          suggestedMaterial={gridModalState?.materialType as 'twine' | 'glaze' | 'solvent' | undefined}
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
