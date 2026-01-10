/**
 * Sectioned Log View
 *
 * Layout for the Log tab with Loot Log (main) and Book Balances (sidebar).
 * - Loot Log takes majority of space (left side)
 * - Book Balances shown as compact sidebar (right side)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../primitives/Dropdown';
import { Button } from '../primitives';
import { logLootAndUpdateGear, deleteLootAndRevertGear, updateLootAndSyncGear } from '../../utils/lootCoordination';
import { toast } from '../../stores/toastStore';
import type { SnapshotPlayer, LootLogEntry, LootLogEntryUpdate, MaterialLogEntry, MaterialLogEntryUpdate, MaterialType } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';
import { parseFloorName, FLOOR_COLORS, type FloorNumber } from '../../gamedata/loot-tables';
import { Pencil, Link, Trash2, UserRound } from 'lucide-react';

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
  onNavigateToPlayer?: (playerId: string) => void;
  /** External highlighted entry ID (e.g., from navigation) */
  highlightedEntryId?: string | null;
  /** External highlighted entry type */
  highlightedEntryType?: 'loot' | 'material' | null;
  /** Open Log Loot modal (from keyboard shortcut) */
  openLogLootModal?: boolean;
  onLogLootModalClose?: () => void;
  /** Open Log Material modal (from keyboard shortcut) */
  openLogMaterialModal?: boolean;
  onLogMaterialModalClose?: () => void;
  /** Open Mark Floor Cleared modal (from keyboard shortcut) */
  openMarkFloorClearedModal?: boolean;
  onMarkFloorClearedModalClose?: () => void;
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
  onNavigateToPlayer,
  highlightedEntryId: externalHighlightedEntryId,
  highlightedEntryType: externalHighlightedEntryType,
  openLogLootModal,
  onLogLootModalClose,
  openLogMaterialModal,
  onLogMaterialModalClose,
  openMarkFloorClearedModal,
  onMarkFloorClearedModalClose,
}: SectionedLogViewProps) {
  const {
    lootLog,
    materialLog,
    pageBalances,
    maxWeek,
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

  // Sync external modal state (from keyboard shortcuts) with internal state
  useEffect(() => {
    if (openLogLootModal && !showLootModal) {
      setShowLootModal(true);
      setGridModalState(null);
      setEntryToEdit(undefined);
    }
  }, [openLogLootModal, showLootModal]);

  useEffect(() => {
    if (openLogMaterialModal && !showMaterialModal) {
      setShowMaterialModal(true);
      setGridModalState(null);
      setMaterialEntryToEdit(undefined);
    }
  }, [openLogMaterialModal, showMaterialModal]);

  useEffect(() => {
    if (openMarkFloorClearedModal && !showFloorClearedModal) {
      setShowFloorClearedModal(true);
    }
  }, [openMarkFloorClearedModal, showFloorClearedModal]);
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
  const [materialEntryToEdit, setMaterialEntryToEdit] = useState<MaterialLogEntry | undefined>(undefined);
  const [resetModalType, setResetModalType] = useState<ResetType | null>(null);

  // Confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    type: 'deleteLoot' | 'deleteMaterial' | 'resetRow' | 'resetColumn' | 'resetAll';
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Fetch loot and material data on mount (no week filter - get all data for client-side filtering)
  // This allows cross-week navigation and better performance with client-side filtering
  useEffect(() => {
    fetchLootLog(groupId, tierId);
    fetchMaterialLog(groupId, tierId);
  }, [groupId, tierId, fetchLootLog, fetchMaterialLog]);

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
    await fetchLootLog(groupId, tierId);
    // Refresh week data types to update week selector (may add new weeks)
    await fetchWeekDataTypes(groupId, tierId);
    toast.success('Loot entry logged');
  }, [groupId, tierId, onWeekChange, fetchLootLog, fetchWeekDataTypes]);

  const handleUpdateLoot = useCallback(async (updates: LootLogEntryUpdate) => {
    if (!entryToEdit) return;
    // Use updateLootAndSyncGear to properly update player gear when recipient changes
    await updateLootAndSyncGear(groupId, tierId, entryToEdit.id, entryToEdit, updates, { syncGear: true });
    await fetchLootLog(groupId, tierId);
    toast.success('Loot entry updated');
  }, [groupId, tierId, entryToEdit, fetchLootLog]);

  const handleDeleteLoot = useCallback((entry: LootLogEntry) => {
    setConfirmState({
      type: 'deleteLoot',
      title: 'Delete Loot Entry',
      message: `Delete the ${GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] || entry.itemSlot} drop?`,
      onConfirm: async () => {
        await deleteLootAndRevertGear(groupId, tierId, entry.id, entry, { revertGear: true });
        await fetchLootLog(groupId, tierId);
        await fetchWeekDataTypes(groupId, tierId);
        toast.success('Loot entry deleted');
        setConfirmState(null);
      },
    });
  }, [groupId, tierId, fetchLootLog, fetchWeekDataTypes]);

  const handleDeleteMaterial = useCallback((entryId: number) => {
    setConfirmState({
      type: 'deleteMaterial',
      title: 'Delete Material Entry',
      message: 'Delete this material entry?',
      onConfirm: async () => {
        await deleteMaterialEntry(groupId, tierId, entryId);
        await fetchMaterialLog(groupId, tierId);
        await fetchWeekDataTypes(groupId, tierId);
        toast.success('Material entry deleted');
        setConfirmState(null);
      },
    });
  }, [groupId, tierId, deleteMaterialEntry, fetchMaterialLog, fetchWeekDataTypes]);

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
    await fetchMaterialLog(groupId, tierId);
    // Refresh week data types to update week selector (may add new weeks)
    await fetchWeekDataTypes(groupId, tierId);
    toast.success('Material entry logged');
  }, [groupId, tierId, onWeekChange, fetchMaterialLog, fetchWeekDataTypes]);

  const handleUpdateMaterial = useCallback(async (updates: MaterialLogEntryUpdate) => {
    if (!materialEntryToEdit) return;
    const { updateMaterialEntry } = useLootTrackingStore.getState();
    await updateMaterialEntry(groupId, tierId, materialEntryToEdit.id, updates);
    await fetchMaterialLog(groupId, tierId);
    toast.success('Material entry updated');
  }, [groupId, tierId, materialEntryToEdit, fetchMaterialLog]);

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

    const { deleteMaterialEntry, clearAllPageLedger } = useLootTrackingStore.getState();

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

      // Reset book balances - actually delete ledger history (not just zero out with adjustments)
      if (resetModalType === 'books' || resetModalType === 'all') {
        await clearAllPageLedger(groupId, tierId);
      }

      // Refresh all data
      await Promise.all([
        fetchLootLog(groupId, tierId),
        fetchMaterialLog(groupId, tierId),
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
  }, [resetModalType, groupId, tierId, fetchLootLog, fetchMaterialLog, fetchPageBalances, fetchWeekDataTypes, getBalanceWeekParam]);


  // URL params for deep linking
  const [searchParams, setSearchParams] = useSearchParams();

  // Layout mode: 'grid' (weekly loot grid) or 'split' (traditional list view)
  // Priority: URL param > localStorage > default
  const [layoutMode, setLayoutMode] = useState<'split' | 'grid'>(() => {
    const urlLayout = searchParams.get('logLayout');
    if (urlLayout === 'split' || urlLayout === 'grid') return urlLayout;
    try {
      const saved = localStorage.getItem('log-layout-mode');
      return saved === 'split' ? 'split' : 'grid';
    } catch {
      return 'grid';
    }
  });

  // Persist layout mode and update URL
  const handleLayoutModeChange = useCallback((mode: 'split' | 'grid') => {
    setLayoutMode(mode);
    try {
      localStorage.setItem('log-layout-mode', mode);
    } catch {
      // Ignore localStorage errors
    }
    // Update URL - only include if not default
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (mode === 'grid') {
        params.delete('logLayout');
      } else {
        params.set('logLayout', mode);
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

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

  // View mode for loot log: 'chronological' (timeline) or 'byFloor'
  // Priority: URL param > default
  const [lootViewMode, setLootViewModeState] = useState<'chronological' | 'byFloor'>(() => {
    const urlView = searchParams.get('logView');
    if (urlView === 'timeline') return 'chronological';
    if (urlView === 'byFloor') return 'byFloor';
    return 'byFloor';
  });

  // Wrapper to update lootViewMode and URL
  const setLootViewMode = useCallback((mode: 'chronological' | 'byFloor') => {
    setLootViewModeState(mode);
    // Update URL - only include if not default
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (mode === 'byFloor') {
        params.delete('logView');
      } else {
        params.set('logView', 'timeline');
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Internal highlighted entry for deep-link scroll animation (from URL params)
  const [internalHighlightedEntryId, setInternalHighlightedEntryId] = useState<string | null>(null);
  const [internalHighlightedEntryType, setInternalHighlightedEntryType] = useState<'loot' | 'material' | null>(null);

  // Combined highlighted entry - prefer external (navigation) over internal (URL)
  const highlightedEntryId = externalHighlightedEntryId || internalHighlightedEntryId;
  const highlightedEntryType = externalHighlightedEntryType || internalHighlightedEntryType;

  // Handle entry deep link - scroll to and highlight entry
  useEffect(() => {
    const entryParam = searchParams.get('entry');
    const entryTypeParam = searchParams.get('entryType') as 'loot' | 'material' | null;
    if (!entryParam) return;

    // Find the entry (entry.id is a number, URL param is string)
    const entryId = parseInt(entryParam, 10);

    // Determine entry type and find the entry
    let entryType: 'loot' | 'material' = entryTypeParam || 'loot';
    let elementId: string;

    if (entryType === 'material' && materialLog) {
      const entry = materialLog.find(e => e.id === entryId);
      if (!entry) return;
      elementId = `material-entry-${entryParam}`;
    } else if (lootLog) {
      const entry = lootLog.find(e => e.id === entryId);
      if (!entry) return;
      elementId = `loot-entry-${entryParam}`;
      entryType = 'loot';
    } else {
      return;
    }

    // Set highlighted entry (store as string for consistency)
    setInternalHighlightedEntryId(entryParam);
    setInternalHighlightedEntryType(entryType);

    // Scroll to the entry after a short delay
    setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    // Clear highlight after animation
    const timer = setTimeout(() => {
      setInternalHighlightedEntryId(null);
      setInternalHighlightedEntryType(null);
      // Clear entry params from URL
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.delete('entry');
        params.delete('entryType');
        return params;
      }, { replace: true });
    }, 2500);

    return () => clearTimeout(timer);
  }, [searchParams, lootLog, materialLog, setSearchParams]);

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

  // Track expanded state for each floor section (persisted to localStorage)
  const [expandedFloors, setExpandedFloorsState] = useState<Set<FloorNumber>>(() => {
    try {
      const saved = localStorage.getItem('log-floor-expanded');
      if (saved) {
        const parsed = JSON.parse(saved) as number[];
        return new Set(parsed.filter(n => [1, 2, 3, 4].includes(n)) as FloorNumber[]);
      }
    } catch {
      // Ignore localStorage errors
    }
    return new Set([1, 2, 3, 4]);
  });

  // Wrapper to persist expanded state to localStorage
  const setExpandedFloors = useCallback((update: Set<FloorNumber> | ((prev: Set<FloorNumber>) => Set<FloorNumber>)) => {
    setExpandedFloorsState(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      try {
        localStorage.setItem('log-floor-expanded', JSON.stringify(Array.from(next)));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, []);

  // Handlers for expand/collapse all floor sections
  const handleExpandAllFloors = useCallback(() => {
    setExpandedFloors(new Set([1, 2, 3, 4]));
  }, [setExpandedFloors]);

  const handleCollapseAllFloors = useCallback(() => {
    setExpandedFloors(new Set());
  }, [setExpandedFloors]);

  // Handler for individual floor expand/collapse
  const handleFloorExpandChange = useCallback((floor: FloorNumber, expanded: boolean) => {
    setExpandedFloors(prev => {
      const next = new Set(prev);
      if (expanded) {
        next.add(floor);
      } else {
        next.delete(floor);
      }
      return next;
    });
  }, [setExpandedFloors]);

  // State for grid view pre-filled modal
  const [gridModalState, setGridModalState] = useState<{
    type: 'loot' | 'material';
    floor: FloorNumber;
    slot?: string;
    materialType?: string;
  } | null>(null);

  // Counter to force fresh modal mount when opening from grid
  const [lootModalKey, setLootModalKey] = useState(0);

  // Keyboard shortcut event listeners
  useEffect(() => {
    const handleSetView = (e: CustomEvent<'byFloor' | 'chronological'>) => {
      setLootViewMode(e.detail);
    };
    const handleToggleExpandAll = () => {
      // If all are expanded, collapse all; otherwise expand all
      if (expandedFloors.size === 4) {
        handleCollapseAllFloors();
      } else {
        handleExpandAllFloors();
      }
    };
    const handleToggleLayout = () => {
      handleLayoutModeChange(layoutMode === 'grid' ? 'split' : 'grid');
    };
    const handlePrevWeek = () => {
      if (currentWeek > 1) {
        onWeekChange?.(currentWeek - 1);
      }
    };
    const handleNextWeek = () => {
      if (currentWeek < maxWeek) {
        onWeekChange?.(currentWeek + 1);
      }
    };

    window.addEventListener('log:set-view', handleSetView as EventListener);
    window.addEventListener('log:toggle-expand-all', handleToggleExpandAll);
    window.addEventListener('log:toggle-layout', handleToggleLayout);
    window.addEventListener('log:prev-week', handlePrevWeek);
    window.addEventListener('log:next-week', handleNextWeek);

    return () => {
      window.removeEventListener('log:set-view', handleSetView as EventListener);
      window.removeEventListener('log:toggle-expand-all', handleToggleExpandAll);
      window.removeEventListener('log:toggle-layout', handleToggleLayout);
      window.removeEventListener('log:prev-week', handlePrevWeek);
      window.removeEventListener('log:next-week', handleNextWeek);
    };
  }, [expandedFloors.size, layoutMode, currentWeek, maxWeek, setLootViewMode, handleCollapseAllFloors, handleExpandAllFloors, handleLayoutModeChange, onWeekChange]);

  // Context menu state for list view entries
  const [listContextMenu, setListContextMenu] = useState<{
    x: number;
    y: number;
    entry: LootLogEntry | MaterialLogEntry;
    type: 'loot' | 'material';
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

  // Helper to copy entry URL
  const handleCopyEntryUrl = useCallback((entryId: string, entryType: 'loot' | 'material' = 'loot') => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'log');
    url.searchParams.set('entry', entryId);
    if (entryType === 'material') {
      url.searchParams.set('entryType', 'material');
    } else {
      url.searchParams.delete('entryType'); // Default is loot, no need to include
    }
    navigator.clipboard.writeText(url.toString());
    toast.success('Link copied to clipboard');
  }, []);

  // Helper to render a single loot or material entry
  const renderEntry = (entry: CombinedEntry) => {
    if (entry.entryType === 'loot') {
      const slotName = GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] || entry.itemSlot;
      const isWeapon = entry.itemSlot === 'weapon';
      // Compare as strings since highlightedEntryId is string and entry.id is number
      const isHighlighted = highlightedEntryId === String(entry.id);
      return (
        <div
          key={`loot-${entry.id}`}
          id={`loot-entry-${entry.id}`}
          className={`bg-surface-elevated border-l-2 border-l-accent rounded-lg p-3 ${isHighlighted ? 'highlight-pulse' : ''}`}
          onContextMenu={(e) => handleListContextMenu(e, entry, 'loot')}
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
            <div className="flex items-center gap-3 ml-4">
              <button
                onClick={() => handleCopyEntryUrl(String(entry.id))}
                className="text-text-muted hover:text-accent text-sm"
                title="Copy link to this entry"
              >
                Copy URL
              </button>
              {canEdit && (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
      );
    } else {
      const isMatHighlighted = highlightedEntryId === String(entry.id) && highlightedEntryType === 'material';
      return (
        <div
          key={`mat-${entry.id}`}
          id={`material-entry-${entry.id}`}
          className={`bg-surface-elevated border-l-2 border-l-accent rounded-lg p-3 ${isMatHighlighted ? 'highlight-pulse' : ''}`}
          onContextMenu={(e) => handleListContextMenu(e, entry, 'material')}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border-subtle">
                  {entry.floor}
                </span>
                <span className={`font-medium ${
                  entry.materialType === 'twine' ? 'text-material-twine' :
                  entry.materialType === 'glaze' ? 'text-material-glaze' :
                  'text-material-solvent'
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
            <div className="flex items-center gap-3 ml-4">
              <button
                onClick={() => handleCopyEntryUrl(String(entry.id), 'material')}
                className="text-text-muted hover:text-accent text-sm"
                title="Copy link to this entry"
              >
                Copy URL
              </button>
              {canEdit && (
                <>
                  <button
                    onClick={() => { setMaterialEntryToEdit(entry); setShowMaterialModal(true); }}
                    className="text-text-muted hover:text-accent text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteMaterial(entry.id)}
                    className="text-status-error hover:text-status-error/80 text-sm"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }
  };

  // Handle grid view log clicks
  const handleGridLogLoot = useCallback((floor: FloorNumber, slot: string) => {
    setGridModalState({ type: 'loot', floor, slot });
    setEntryToEdit(undefined);
    setLootModalKey(k => k + 1); // Force fresh mount
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

  // Handler for editing loot from grid
  const handleGridEditLoot = useCallback((entry: LootLogEntry) => {
    setEntryToEdit(entry);
    setGridModalState(null);
    setShowLootModal(true);
  }, []);

  // Handler for editing material from grid
  const handleGridEditMaterial = useCallback((entry: MaterialLogEntry) => {
    setMaterialEntryToEdit(entry);
    setGridModalState(null);
    setShowMaterialModal(true);
  }, []);

  // Handler for copying entry URL (used by both list and grid)
  const handleCopyEntryUrlById = useCallback((entryId: number, entryType: 'loot' | 'material' = 'loot') => {
    handleCopyEntryUrl(String(entryId), entryType);
  }, [handleCopyEntryUrl]);

  // Handle right-click on list view entries
  const handleListContextMenu = useCallback((
    e: React.MouseEvent,
    entry: LootLogEntry | MaterialLogEntry,
    type: 'loot' | 'material'
  ) => {
    e.preventDefault();
    setListContextMenu({ x: e.clientX, y: e.clientY, entry, type });
  }, []);

  // Get context menu items for list view entries
  const getListContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (!listContextMenu) return [];
    const { entry, type } = listContextMenu;
    const items: ContextMenuItem[] = [];

    if (type === 'loot' && canEdit) {
      items.push({
        label: 'Edit',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => {
          setEntryToEdit(entry as LootLogEntry);
          setShowLootModal(true);
        },
      });
    }

    if (type === 'material' && canEdit) {
      items.push({
        label: 'Edit',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => {
          setMaterialEntryToEdit(entry as MaterialLogEntry);
          setShowMaterialModal(true);
        },
      });
    }

    items.push({
      label: 'Copy URL',
      icon: <Link className="w-4 h-4" />,
      onClick: () => handleCopyEntryUrl(String(entry.id), type),
    });

    // Go to Player - navigate to recipient's player card
    if (onNavigateToPlayer) {
      const recipientName = 'recipientPlayerName' in entry ? entry.recipientPlayerName : '';
      const recipientId = 'recipientPlayerId' in entry ? entry.recipientPlayerId : '';
      if (recipientId) {
        items.push({
          label: `Go to ${recipientName}`,
          icon: <UserRound className="w-4 h-4" />,
          onClick: () => onNavigateToPlayer(recipientId),
        });
      }
    }

    if (canEdit) {
      items.push({ separator: true });

      if (type === 'loot') {
        items.push({
          label: 'Delete',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleDeleteLoot(entry as LootLogEntry),
          danger: true,
        });
      } else {
        items.push({
          label: 'Delete',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleDeleteMaterial(entry.id),
          danger: true,
        });
      }
    }

    return items;
  }, [listContextMenu, canEdit, handleCopyEntryUrl, handleDeleteLoot, handleDeleteMaterial, onNavigateToPlayer]);

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
                <button className="px-3 py-1.5 text-sm font-semibold text-status-error bg-status-error/10 border border-status-error/40 rounded-lg cursor-pointer
                                    hover:bg-status-error/20 hover:border-status-error/60 active:bg-status-error/30 transition-colors flex items-center gap-1.5">
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
                <DropdownItem
                  onSelect={() => setResetModalType('loot')}
                  className="text-status-error focus:text-status-error"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Reset Loot Log
                  </span>
                </DropdownItem>
                <DropdownItem
                  onSelect={() => setResetModalType('books')}
                  className="text-status-error focus:text-status-error"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Reset Book Balances
                  </span>
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem
                  onSelect={() => setResetModalType('all')}
                  className="text-status-error focus:text-status-error font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Reset All Data
                  </span>
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          )}
        </div>

        {/* Action buttons */}
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => { setGridModalState(null); setEntryToEdit(undefined); setShowLootModal(true); }}
              title="Log loot drop (Alt+L)"
            >
              + Log Loot
            </Button>
            <Button
              size="sm"
              onClick={() => { setGridModalState(null); setShowMaterialModal(true); }}
              title="Log material drop (Alt+M)"
            >
              + Log Material
            </Button>
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
              highlightedEntryId={highlightedEntryId}
              highlightedEntryType={highlightedEntryType}
              onLogLoot={handleGridLogLoot}
              onLogMaterial={handleGridLogMaterial}
              onDeleteLoot={handleGridDeleteLoot}
              onDeleteMaterial={handleDeleteMaterial}
              onEditLoot={handleGridEditLoot}
              onEditMaterial={handleGridEditMaterial}
              onCopyEntryUrl={handleCopyEntryUrlById}
              onNavigateToPlayer={onNavigateToPlayer}
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
                {/* Floor filter - hidden in Timeline mode but still rendered to prevent layout shift */}
                <div className={`flex items-center gap-2 ${lootViewMode !== 'byFloor' ? 'invisible' : ''}`}>
                  <span className="text-xs text-text-muted mr-1">Floor:</span>
                  {([1, 2, 3, 4] as FloorNumber[]).map(floor => {
                    const isSelected = visibleFloors.has(floor);
                    const floorColors = FLOOR_COLORS[floor];
                    return (
                      <button
                        key={floor}
                        onClick={() => toggleFloorVisibility(floor)}
                        aria-label={`Filter by Floor ${floor}`}
                        aria-pressed={isSelected}
                        className={`
                          px-3 py-1.5 rounded text-xs font-bold transition-colors border
                          ${isSelected
                            ? `${floorColors.bg} ${floorColors.text} ${floorColors.border}`
                            : 'border-transparent bg-surface-interactive text-text-secondary hover:text-text-primary'
                          }
                        `}
                      >
                        {floors[floor - 1]?.split(' ')[0] || `F${floor}`}
                      </button>
                    );
                  })}
                </div>
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
                        expanded={expandedFloors.has(floorNum)}
                        onExpandChange={(expanded) => handleFloorExpandChange(floorNum, expanded)}
                        onExpandAll={handleExpandAllFloors}
                        onCollapseAll={handleCollapseAllFloors}
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
        <div className={`transition-all duration-200 ${booksSidebarCollapsed ? 'w-10' : 'w-80'} flex-shrink-0`}>
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
                      className={`px-2 py-0.5 text-xs rounded transition-colors font-bold ${
                        bookViewMode === 'week'
                          ? 'bg-accent text-accent-contrast'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      W{currentWeek}
                    </button>
                    <button
                      onClick={() => setBookViewMode('allTime')}
                      className={`px-2 py-0.5 text-xs rounded transition-colors font-bold ${
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
                  <p className="text-text-muted text-sm p-2">No book data.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-muted">
                        <th className="text-left py-1.5 px-1">Player</th>
                        {(['I', 'II', 'III', 'IV'] as const).map((book) => (
                          <th key={book} className="text-center py-1.5 px-1 w-9">{book}</th>
                        ))}
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageBalances.map((balance) => {
                        const player = players.find(p => p.id === balance.playerId);
                        // Skip substitute players
                        if (!player || player.isSubstitute) return null;

                        return (
                          <tr key={balance.playerId} className="border-t border-border-subtle hover:bg-surface-elevated/50">
                            <td className="py-2 px-1">
                              <div className="flex items-center gap-1.5">
                                <JobIcon job={player.job} size="sm" />
                                <span className="text-text-primary truncate max-w-[100px]">{player.name}</span>
                              </div>
                            </td>
                            {(['I', 'II', 'III', 'IV'] as const).map((book) => {
                              const value = balance[`book${book}` as keyof typeof balance] as number;
                              return (
                                <td
                                  key={book}
                                  className={`text-center py-2 px-1 ${canEdit ? 'cursor-pointer hover:bg-accent/20 rounded transition-colors' : ''}`}
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
                            <td className="py-1.5 px-1">
                              <button
                                onClick={() => setLedgerState({ playerId: balance.playerId, playerName: player.name })}
                                className="p-1 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                                title={`View book history for ${player.name}`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* Mark Floor Cleared - at bottom of Books section */}
                {canEdit && (
                  <div className="p-2 border-t border-border-subtle">
                    <button
                      onClick={() => setShowFloorClearedModal(true)}
                      className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 hover:border-accent transition-colors"
                      title="Award books to party (Alt+B)"
                    >
                      Mark Floor Cleared
                    </button>
                  </div>
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
          key={lootModalKey}
          isOpen={showLootModal}
          onClose={() => { setShowLootModal(false); setEntryToEdit(undefined); setGridModalState(null); onLogLootModalClose?.(); }}
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
          onClose={() => { setShowMaterialModal(false); setGridModalState(null); setMaterialEntryToEdit(undefined); onLogMaterialModalClose?.(); }}
          onSubmit={handleMaterialSubmit}
          onUpdate={handleUpdateMaterial}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
          presetFloor={gridModalState?.floor ? floors[gridModalState.floor - 1] : undefined}
          suggestedMaterial={gridModalState?.materialType as 'twine' | 'glaze' | 'solvent' | undefined}
          editEntry={materialEntryToEdit}
        />
      )}

      {showFloorClearedModal && (
        <MarkFloorClearedModal
          isOpen={showFloorClearedModal}
          onClose={() => { setShowFloorClearedModal(false); onMarkFloorClearedModalClose?.(); }}
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

      {/* List View Context Menu */}
      {listContextMenu && (
        <ContextMenu
          x={listContextMenu.x}
          y={listContextMenu.y}
          items={getListContextMenuItems()}
          onClose={() => setListContextMenu(null)}
        />
      )}
    </div>
  );
}
