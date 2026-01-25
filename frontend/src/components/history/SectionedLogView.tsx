/**
 * Sectioned Log View
 *
 * Layout for the Log tab with Loot Log (main) and Book Balances (sidebar).
 * - Loot Log takes majority of space (left side)
 * - Book Balances shown as compact sidebar (right side)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSwipe } from '../../hooks/useSwipe';
import { useSearchParams } from 'react-router-dom';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useDevice } from '../../hooks/useDevice';
import { JobIcon } from '../ui/JobIcon';
import { LootLogFilters } from './LootLogFilters';
import { LootLogModals } from './LootLogModals';
import { LootCountBar } from './LootCountBar';
import { FloorSection } from './FloorSection';
import { LogFloatingActions } from './LogFloatingActions';
import { LogLayoutToggle } from './LogLayoutToggle';
import { WeeklyLootGrid, LootFairnessLegend } from './WeeklyLootGrid';
import { LootLogEntryItem, MaterialLogEntryItem } from './LogEntryItems';
import { type ResetType } from '../ui/ResetConfirmModal';
import { type ContextMenuItem } from '../ui/ContextMenu';
import { logLootAndUpdateGear, deleteLootAndRevertGear, updateLootAndSyncGear } from '../../utils/lootCoordination';
import { toast } from '../../stores/toastStore';
import type { SnapshotPlayer, LootLogEntry, LootLogEntryUpdate, MaterialLogEntry, MaterialLogEntryUpdate, MaterialType } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';
import { parseFloorName, FLOOR_COLORS, type FloorNumber } from '../../gamedata/loot-tables';
import { Pencil, Link, Trash2, UserRound } from 'lucide-react';
import { Tooltip } from '../primitives';
import { logger as baseLogger } from '../../lib/logger';
import { useSyncExternalModal } from '../../hooks/useSyncExternalModal';

const logger = baseLogger.scope('sectioned-log');

interface SectionedLogViewProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  canEdit: boolean;
  /** Current user ID for per-row edit permissions */
  currentUserId?: string;
  /** User role for per-row edit permissions */
  userRole?: 'owner' | 'lead' | 'member' | 'viewer' | null;
  /** Highlighted book player ID (from navigation) */
  highlightedBookPlayerId?: string | null;
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

export function SectionedLogView({
  groupId,
  tierId,
  players,
  floors,
  currentWeek,
  canEdit,
  currentUserId,
  userRole,
  highlightedBookPlayerId,
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

  // URL params for deep linking
  const [searchParams, setSearchParams] = useSearchParams();

  // Modal states
  const [showLootModal, setShowLootModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showFloorClearedModal, setShowFloorClearedModal] = useState(false);

  // State for grid view pre-filled modal and entry editing
  const [gridModalState, setGridModalState] = useState<{
    type: 'loot' | 'material';
    floor: FloorNumber;
    slot?: string;
    materialType?: string;
  } | null>(null);
  const [entryToEdit, setEntryToEdit] = useState<LootLogEntry | undefined>(undefined);
  const [materialEntryToEdit, setMaterialEntryToEdit] = useState<MaterialLogEntry | undefined>(undefined);

  // Sync external modal state (from keyboard shortcuts) with internal state
  // Note: useSyncExternalModal stores callbacks in refs, so memoization is not required
  useSyncExternalModal(openLogLootModal, showLootModal, setShowLootModal, () => {
    setGridModalState(null);
    setEntryToEdit(undefined);
  });

  useSyncExternalModal(openLogMaterialModal, showMaterialModal, setShowMaterialModal, () => {
    setGridModalState(null);
    setMaterialEntryToEdit(undefined);
  });

  useSyncExternalModal(openMarkFloorClearedModal, showFloorClearedModal, setShowFloorClearedModal);

  // Book view mode: 'week' or 'allTime'
  // Priority: URL param > default
  const [bookViewMode, setBookViewModeState] = useState<'week' | 'allTime'>(() => {
    const urlBookView = searchParams.get('bookView');
    if (urlBookView === 'week') return 'week';
    return 'allTime';
  });

  // Wrapper to update bookViewMode and sync to URL
  const setBookViewMode = useCallback((mode: 'week' | 'allTime') => {
    setBookViewModeState(mode);
    // Update URL - only include if not default
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (mode === 'allTime') {
        params.delete('bookView');
      } else {
        params.set('bookView', mode);
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);
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

  const getPlayerName = useCallback((playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player?.name || 'Unknown';
  }, [players]);

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
      logger.error('Reset failed:', error);
      toast.error('Reset failed');
    } finally {
      setResetModalType(null);
    }
  }, [resetModalType, groupId, tierId, fetchLootLog, fetchMaterialLog, fetchPageBalances, fetchWeekDataTypes, getBalanceWeekParam]);

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

  // Counter to force fresh modal mount when opening from grid
  const [lootModalKey, setLootModalKey] = useState(0);

  // Keyboard shortcut and controls sheet event listeners
  useEffect(() => {
    const handleSetView = (e: CustomEvent<'byFloor' | 'chronological'>) => {
      setLootViewMode(e.detail);
    };
    const handleSetLayout = (e: CustomEvent<'grid' | 'split'>) => {
      handleLayoutModeChange(e.detail);
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
    // Reset event handlers (from mobile controls panel)
    const handleResetLoot = () => setResetModalType('loot');
    const handleResetBooks = () => setResetModalType('books');
    const handleResetAll = () => setResetModalType('all');

    window.addEventListener('log:set-view', handleSetView as EventListener);
    window.addEventListener('log:set-layout', handleSetLayout as EventListener);
    window.addEventListener('log:toggle-expand-all', handleToggleExpandAll);
    window.addEventListener('log:toggle-layout', handleToggleLayout);
    window.addEventListener('log:prev-week', handlePrevWeek);
    window.addEventListener('log:next-week', handleNextWeek);
    window.addEventListener('log:reset-loot', handleResetLoot);
    window.addEventListener('log:reset-books', handleResetBooks);
    window.addEventListener('log:reset-all', handleResetAll);

    return () => {
      window.removeEventListener('log:set-view', handleSetView as EventListener);
      window.removeEventListener('log:set-layout', handleSetLayout as EventListener);
      window.removeEventListener('log:toggle-expand-all', handleToggleExpandAll);
      window.removeEventListener('log:toggle-layout', handleToggleLayout);
      window.removeEventListener('log:prev-week', handlePrevWeek);
      window.removeEventListener('log:next-week', handleNextWeek);
      window.removeEventListener('log:reset-loot', handleResetLoot);
      window.removeEventListener('log:reset-books', handleResetBooks);
      window.removeEventListener('log:reset-all', handleResetAll);
    };
  }, [expandedFloors.size, layoutMode, currentWeek, maxWeek, setLootViewMode, handleCollapseAllFloors, handleExpandAllFloors, handleLayoutModeChange, onWeekChange, setResetModalType]);

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

  // Handle right-click on list view entries (must be defined before wrappers)
  const handleListContextMenu = useCallback((
    e: React.MouseEvent,
    entry: LootLogEntry | MaterialLogEntry,
    type: 'loot' | 'material'
  ) => {
    e.preventDefault();
    setListContextMenu({ x: e.clientX, y: e.clientY, entry, type });
  }, []);

  // Stable callbacks for memoized entry components
  const handleEditLootEntry = useCallback((entry: LootLogEntry) => {
    setEntryToEdit(entry);
    setShowLootModal(true);
  }, []);

  const handleEditMaterialEntry = useCallback((entry: MaterialLogEntry) => {
    setMaterialEntryToEdit(entry);
    setShowMaterialModal(true);
  }, []);

  const handleLootContextMenu = useCallback((e: React.MouseEvent, entry: LootLogEntry) => {
    handleListContextMenu(e, entry, 'loot');
  }, [handleListContextMenu]);

  const handleMaterialContextMenu = useCallback((e: React.MouseEvent, entry: MaterialLogEntry) => {
    handleListContextMenu(e, entry, 'material');
  }, [handleListContextMenu]);

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

    // Jump to Player - navigate to recipient's player card
    if (onNavigateToPlayer) {
      const recipientName = 'recipientPlayerName' in entry ? entry.recipientPlayerName : '';
      const recipientId = 'recipientPlayerId' in entry ? entry.recipientPlayerId : '';
      if (recipientId) {
        items.push({
          label: `Jump to ${recipientName}`,
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

  // Mobile panel state for swipeable view
  const [mobilePanel, setMobilePanel] = useState<'loot' | 'books'>('loot');

  // Swipe gesture handling for mobile panel switching
  const mobilePanelSwipeHandlers = useSwipe({
    onSwipeLeft: () => {
      // Swipe left = go to books
      if (mobilePanel === 'loot') {
        setMobilePanel('books');
      }
    },
    onSwipeRight: () => {
      // Swipe right = go to loot
      if (mobilePanel === 'books') {
        setMobilePanel('loot');
      }
    },
    minSwipeDistance: 50,
  });

  // Device detection for mobile-specific features
  const { isSmallScreen } = useDevice();

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header Controls */}
      <div className="flex-shrink-0 pb-1 md:pb-2">
        <LootLogFilters
          layoutMode={layoutMode}
          onLayoutModeChange={handleLayoutModeChange}
          canEdit={canEdit}
          onResetLoot={() => setResetModalType('loot')}
          onResetBooks={() => setResetModalType('books')}
          onResetAll={() => setResetModalType('all')}
          onOpenLootModal={() => { setGridModalState(null); setEntryToEdit(undefined); setShowLootModal(true); }}
          onOpenMaterialModal={() => { setGridModalState(null); setShowMaterialModal(true); }}
        />

        {/* Mobile Panel Tabs */}
        <div className="md:hidden flex bg-surface-card border border-border-default rounded-lg p-1 mt-3">
          <button
            onClick={() => setMobilePanel('loot')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              mobilePanel === 'loot'
                ? 'bg-accent text-accent-contrast'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Loot Log
          </button>
          <button
            onClick={() => setMobilePanel('books')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              mobilePanel === 'books'
                ? 'bg-accent text-accent-contrast'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Books
          </button>
        </div>
      </div>

      {/* Main Content - Side by Side Layout (Desktop) */}
      <div
        className="hidden md:grid gap-4 flex-1 min-h-0 transition-[grid-template-columns] duration-200"
        style={{ gridTemplateColumns: booksSidebarCollapsed ? '1fr 2.5rem' : '1fr 20rem' }}
      >
        {/* Loot Log - Main Area */}
        <div className="min-w-0 overflow-hidden flex flex-col self-start"
          style={{ gap: '0' }}
        >
          {/* Shared LootCountBar - above both Grid and List views */}
          <div className="flex-shrink-0">
            <LootCountBar
              players={players}
              lootLog={lootLog}
              currentWeek={currentWeek}
            />
          </div>

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
            <section className="bg-surface-card border border-border-default rounded-lg flex flex-col max-h-[calc(100vh-20rem)]">
              <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border-default">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h3 className="font-display text-base sm:text-lg text-text-primary">Loot Log</h3>
                  {/* View mode toggle */}
                  <div className="flex bg-surface-base rounded-lg p-0.5">
                    <Tooltip
                      content={
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            By Floor
                            <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">Alt+1</kbd>
                          </div>
                          <div className="text-text-secondary text-xs mt-0.5">Group entries by raid floor</div>
                        </div>
                      }
                    >
                      {/* design-system-ignore: View mode toggle button requires specific toggle styling */}
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
                    </Tooltip>
                    <Tooltip
                      content={
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            Timeline
                            <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">Alt+2</kbd>
                          </div>
                          <div className="text-text-secondary text-xs mt-0.5">Show all entries chronologically</div>
                        </div>
                      }
                    >
                      {/* design-system-ignore: View mode toggle button requires specific toggle styling */}
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
                    </Tooltip>
                  </div>
                </div>
                {/* Floor filter - hidden in Timeline mode but still rendered to prevent layout shift */}
                <div className={`flex items-center gap-1.5 sm:gap-2 ${lootViewMode !== 'byFloor' ? 'invisible' : ''}`}>
                  <span className="text-xs text-text-muted">Floor:</span>
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
                          px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs font-bold transition-colors border
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
              <div className="relative p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
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
                        {floorEntries.map(entry =>
                          entry.entryType === 'loot' ? (
                            <LootLogEntryItem
                              key={`loot-${entry.id}`}
                              entry={entry}
                              highlightedEntryId={highlightedEntryId}
                              canEdit={canEdit}
                              getPlayerName={getPlayerName}
                              onCopyUrl={handleCopyEntryUrl}
                              onEdit={handleEditLootEntry}
                              onDelete={handleDeleteLoot}
                              onContextMenu={handleLootContextMenu}
                              onNavigateToPlayer={onNavigateToPlayer}
                            />
                          ) : (
                            <MaterialLogEntryItem
                              key={`mat-${entry.id}`}
                              entry={entry}
                              highlightedEntryId={highlightedEntryId}
                              highlightedEntryType={highlightedEntryType}
                              canEdit={canEdit}
                              getPlayerName={getPlayerName}
                              onCopyUrl={handleCopyEntryUrl}
                              onEdit={handleEditMaterialEntry}
                              onDelete={handleDeleteMaterial}
                              onContextMenu={handleMaterialContextMenu}
                              onNavigateToPlayer={onNavigateToPlayer}
                            />
                          )
                        )}
                      </FloorSection>
                    );
                  })
                ) : (
                  /* Chronological view */
                  combinedEntries.map(entry =>
                    entry.entryType === 'loot' ? (
                      <LootLogEntryItem
                        key={`loot-${entry.id}`}
                        entry={entry}
                        highlightedEntryId={highlightedEntryId}
                        canEdit={canEdit}
                        getPlayerName={getPlayerName}
                        onCopyUrl={handleCopyEntryUrl}
                        onEdit={handleEditLootEntry}
                        onDelete={handleDeleteLoot}
                        onContextMenu={handleLootContextMenu}
                        onNavigateToPlayer={onNavigateToPlayer}
                      />
                    ) : (
                      <MaterialLogEntryItem
                        key={`mat-${entry.id}`}
                        entry={entry}
                        highlightedEntryId={highlightedEntryId}
                        highlightedEntryType={highlightedEntryType}
                        canEdit={canEdit}
                        getPlayerName={getPlayerName}
                        onCopyUrl={handleCopyEntryUrl}
                        onEdit={handleEditMaterialEntry}
                        onDelete={handleDeleteMaterial}
                        onContextMenu={handleMaterialContextMenu}
                        onNavigateToPlayer={onNavigateToPlayer}
                      />
                    )
                  )
                )}
              </div>
            </section>
          )}
        </div>

        {/* Book Balances - Sidebar */}
        <div className="overflow-hidden self-start">
          <section className="bg-surface-card border border-border-default rounded-lg h-full w-80 flex flex-col">
            {/* Sidebar Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border-default">
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
              <Tooltip content={booksSidebarCollapsed ? 'Expand books sidebar' : 'Collapse books sidebar'}>
                <button
                  onClick={toggleBooksSidebar}
                  className="p-1 text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg className={`w-4 h-4 transition-transform ${booksSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </Tooltip>
            </div>

            {/* Sidebar Content - scrollable */}
            {!booksSidebarCollapsed && (
              <div className="flex-1 min-h-0 p-2 overflow-y-auto">
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

                        // Per-row edit check: members can only edit their own row
                        const isOwnRow = player.userId === currentUserId;
                        const canEditThisRow = canEdit || (userRole === 'member' && isOwnRow);
                        const isHighlightedRow = highlightedBookPlayerId === balance.playerId;

                        return (
                          <tr
                            key={balance.playerId}
                            id={`book-row-${balance.playerId}`}
                            className={`border-t border-border-subtle hover:bg-surface-elevated/50 ${isHighlightedRow ? 'highlight-pulse' : ''}`}
                          >
                            <td className="py-2 px-1">
                              <div className="flex items-center gap-1.5">
                                <JobIcon job={player.job} size="sm" />
                                <span className="text-text-primary truncate max-w-[100px]">{player.name}</span>
                              </div>
                            </td>
                            {(['I', 'II', 'III', 'IV'] as const).map((book) => {
                              const value = balance[`book${book}` as keyof typeof balance] as number;
                              return canEditThisRow ? (
                                <Tooltip key={book} content={`Book ${book}: ${value} — Click to adjust`}>
                                  <td
                                    className="text-center py-2 px-1 cursor-pointer hover:bg-accent/20 rounded transition-colors"
                                    onClick={() => setEditBookState({
                                      playerId: balance.playerId,
                                      playerName: player.name,
                                      bookType: book,
                                      currentValue: value,
                                    })}
                                  >
                                    <span className={`font-medium ${value > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                                      {value}
                                    </span>
                                  </td>
                                </Tooltip>
                              ) : (
                                <td key={book} className="text-center py-2 px-1">
                                  <span className={`font-medium ${value > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                                    {value}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="py-1.5 px-1">
                              {canEditThisRow ? (
                                <Tooltip content={`View book history for ${player.name}`}>
                                  <button
                                    onClick={() => setLedgerState({ playerId: balance.playerId, playerName: player.name })}
                                    className="p-1 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                  </button>
                                </Tooltip>
                              ) : (
                                <div className="w-6" /> // Empty spacer to keep layout consistent
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Mark Floor Cleared - sticky footer, hidden from members.
                Note: We check both canEdit AND userRole !== 'member' because:
                - canEdit is false for members (they can't edit all rows)
                - But we also want to hide this from members who have per-row edit access
                - This button awards books to ALL players, so it's a lead/owner action */}
            {!booksSidebarCollapsed && canEdit && userRole !== 'member' && (
              <div className="flex-shrink-0 p-2 border-t border-border-subtle">
                <Tooltip
                  content={
                    <span className="flex items-center gap-2">
                      Award books to party
                      <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">Alt+B</kbd>
                    </span>
                  }
                >
                  <button
                    onClick={() => setShowFloorClearedModal(true)}
                    className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 hover:border-accent transition-colors"
                  >
                    Mark Floor Cleared
                  </button>
                </Tooltip>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Mobile Swipeable Panels - fills remaining space, swipe left/right to switch */}
      <div
        className="md:hidden flex-1 min-h-0 flex flex-col overflow-hidden w-full"
        {...mobilePanelSwipeHandlers}
      >
        {/* Loot Log Panel */}
        {mobilePanel === 'loot' && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 w-full pt-1">
            {/* Shared LootCountBar - above both Grid and List views */}
            <LootCountBar
              players={players}
              lootLog={lootLog}
              currentWeek={currentWeek}
            />

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
            {layoutMode === 'split' && (
              <section className="bg-surface-card border border-border-default rounded-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border-default">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base text-text-primary">Loot Log</h3>
                    <div className="flex bg-surface-base rounded-lg p-0.5">
                      <button
                        onClick={() => setLootViewMode('byFloor')}
                        className={`px-2 py-1 text-xs rounded transition-colors font-bold ${
                          lootViewMode === 'byFloor'
                            ? 'bg-accent text-accent-contrast'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        Floor
                      </button>
                      <button
                        onClick={() => setLootViewMode('chronological')}
                        className={`px-2 py-1 text-xs rounded transition-colors font-bold ${
                          lootViewMode === 'chronological'
                            ? 'bg-accent text-accent-contrast'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        Time
                      </button>
                    </div>
                  </div>
                </div>
                {/* Mobile: no max-h constraint - parent handles scrolling */}
                <div className="p-3 space-y-3">
                  {combinedEntries.length === 0 ? (
                    <p className="text-text-muted text-sm">No loot or materials logged this week.</p>
                  ) : lootViewMode === 'byFloor' ? (
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
                          {floorEntries.map(entry =>
                            entry.entryType === 'loot' ? (
                              <LootLogEntryItem
                                key={`loot-${entry.id}`}
                                entry={entry}
                                highlightedEntryId={highlightedEntryId}
                                canEdit={canEdit}
                                getPlayerName={getPlayerName}
                                onCopyUrl={handleCopyEntryUrl}
                                onEdit={handleEditLootEntry}
                                onDelete={handleDeleteLoot}
                                onContextMenu={handleLootContextMenu}
                                onNavigateToPlayer={onNavigateToPlayer}
                              />
                            ) : (
                              <MaterialLogEntryItem
                                key={`mat-${entry.id}`}
                                entry={entry}
                                highlightedEntryId={highlightedEntryId}
                                highlightedEntryType={highlightedEntryType}
                                canEdit={canEdit}
                                getPlayerName={getPlayerName}
                                onCopyUrl={handleCopyEntryUrl}
                                onEdit={handleEditMaterialEntry}
                                onDelete={handleDeleteMaterial}
                                onContextMenu={handleMaterialContextMenu}
                                onNavigateToPlayer={onNavigateToPlayer}
                              />
                            )
                          )}
                        </FloorSection>
                      );
                    })
                  ) : (
                    combinedEntries.map(entry =>
                      entry.entryType === 'loot' ? (
                        <LootLogEntryItem
                          key={`loot-${entry.id}`}
                          entry={entry}
                          highlightedEntryId={highlightedEntryId}
                          canEdit={canEdit}
                          getPlayerName={getPlayerName}
                          onCopyUrl={handleCopyEntryUrl}
                          onEdit={handleEditLootEntry}
                          onDelete={handleDeleteLoot}
                          onContextMenu={handleLootContextMenu}
                          onNavigateToPlayer={onNavigateToPlayer}
                        />
                      ) : (
                        <MaterialLogEntryItem
                          key={`mat-${entry.id}`}
                          entry={entry}
                          highlightedEntryId={highlightedEntryId}
                          highlightedEntryType={highlightedEntryType}
                          canEdit={canEdit}
                          getPlayerName={getPlayerName}
                          onCopyUrl={handleCopyEntryUrl}
                          onEdit={handleEditMaterialEntry}
                          onDelete={handleDeleteMaterial}
                          onContextMenu={handleMaterialContextMenu}
                          onNavigateToPlayer={onNavigateToPlayer}
                        />
                      )
                    )
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Books Panel */}
        {mobilePanel === 'books' && (
          <section className="flex-1 min-h-0 flex flex-col bg-surface-card border border-border-default rounded-lg overflow-hidden mt-1">
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border-default">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm text-text-primary">Books</h3>
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
            </div>
            <div className="flex-1 min-h-0 p-2 overflow-y-auto overscroll-contain">
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
                    </tr>
                  </thead>
                  <tbody>
                    {pageBalances.map((balance) => {
                      const player = players.find(p => p.id === balance.playerId);
                      if (!player || player.isSubstitute) return null;
                      const isOwnRow = player.userId === currentUserId;
                      const canEditThisRow = canEdit || (userRole === 'member' && isOwnRow);
                      return (
                        <tr key={balance.playerId} className="border-t border-border-subtle">
                          <td className="py-2 px-1">
                            <div className="flex items-center gap-1.5">
                              <JobIcon job={player.job} size="sm" />
                              <span className="text-text-primary truncate max-w-[80px]">{player.name}</span>
                            </div>
                          </td>
                          {(['I', 'II', 'III', 'IV'] as const).map((book) => {
                            const value = balance[`book${book}` as keyof typeof balance] as number;
                            return (
                              <td
                                key={book}
                                className={`text-center py-2 px-1 ${canEditThisRow ? 'cursor-pointer active:bg-accent/20' : ''}`}
                                onClick={() => canEditThisRow && setEditBookState({
                                  playerId: balance.playerId,
                                  playerName: player.name,
                                  bookType: book,
                                  currentValue: value,
                                })}
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
            {/* Mark Floor Cleared - sticky footer */}
            {canEdit && userRole !== 'member' && (
              <div className="flex-shrink-0 p-2 border-t border-border-subtle">
                <button
                  onClick={() => setShowFloorClearedModal(true)}
                  className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 hover:border-accent transition-colors"
                >
                  Mark Floor Cleared
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Loot Fairness Legend - desktop only, rendered outside flex container so sidebar aligns with grid */}
      {layoutMode === 'grid' && (
        <div className="hidden md:block">
          <LootFairnessLegend />
        </div>
      )}

      {/* Mobile Floating Layout Toggle (bottom left) */}
      <LogLayoutToggle
        layoutMode={layoutMode}
        onLayoutChange={handleLayoutModeChange}
        visible={isSmallScreen && mobilePanel === 'loot'}
      />

      {/* Mobile Floating Action Buttons (bottom right) */}
      <LogFloatingActions
        onLogLoot={() => { setGridModalState(null); setEntryToEdit(undefined); setShowLootModal(true); }}
        onLogMaterial={() => { setGridModalState(null); setShowMaterialModal(true); }}
        visible={isSmallScreen && canEdit && mobilePanel === 'loot'}
      />

      {/* Modals */}
      <LootLogModals
        // Loot Entry Modal
        showLootModal={showLootModal}
        onCloseLootModal={() => { setShowLootModal(false); setEntryToEdit(undefined); setGridModalState(null); onLogLootModalClose?.(); }}
        onAddLoot={handleAddLoot}
        onUpdateLoot={handleUpdateLoot}
        lootModalKey={lootModalKey}
        entryToEdit={entryToEdit}
        players={players}
        floors={floors}
        currentWeek={currentWeek}
        gridModalState={gridModalState}
        // Material Modal
        showMaterialModal={showMaterialModal}
        onCloseMaterialModal={() => { setShowMaterialModal(false); setGridModalState(null); setMaterialEntryToEdit(undefined); onLogMaterialModalClose?.(); }}
        onMaterialSubmit={handleMaterialSubmit}
        onUpdateMaterial={handleUpdateMaterial}
        materialEntryToEdit={materialEntryToEdit}
        // Mark Floor Cleared Modal
        showFloorClearedModal={showFloorClearedModal}
        onCloseFloorClearedModal={() => { setShowFloorClearedModal(false); onMarkFloorClearedModalClose?.(); }}
        onMarkFloorCleared={handleMarkFloorCleared}
        // Edit Book Balance Modal
        editBookState={editBookState}
        onCloseEditBook={() => setEditBookState(null)}
        onEditBookBalance={handleEditBookBalance}
        // Player Ledger Modal
        ledgerState={ledgerState}
        onCloseLedger={() => setLedgerState(null)}
        groupId={groupId}
        tierId={tierId}
        canEdit={canEdit}
        onHistoryCleared={() => {
          fetchPageBalances(groupId, tierId, getBalanceWeekParam());
          fetchWeekDataTypes(groupId, tierId);
        }}
        // Reset Confirmation Modal
        resetModalType={resetModalType}
        onResetConfirm={handleResetConfirm}
        onCancelReset={() => setResetModalType(null)}
        // Generic Confirmation Modal
        confirmState={confirmState}
        onCancelConfirm={() => setConfirmState(null)}
        // Context Menu
        listContextMenu={listContextMenu}
        listContextMenuItems={getListContextMenuItems()}
        onCloseContextMenu={() => setListContextMenu(null)}
      />
    </div>
  );
}
