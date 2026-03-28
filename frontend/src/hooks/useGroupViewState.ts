/**
 * useGroupViewState Hook
 *
 * Manages all UI state for GroupView with URL param and localStorage sync.
 * Centralizes the complex state management that was previously in GroupView.tsx.
 */

import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { analytics } from '../services/analytics';
import type { PageMode, ViewMode, SortPreset, SnapshotPlayer } from '../types';
import type { FloorNumber } from '../gamedata/loot-tables';

interface HighlightedEntry {
  id: string;
  type: 'loot' | 'material';
  week: number;
}

export interface UseGroupViewStateReturn {
  // URL search params
  searchParams: URLSearchParams;
  setSearchParams: ReturnType<typeof useSearchParams>[1];

  // Tab state
  pageMode: PageMode;
  setPageMode: (mode: PageMode) => void;
  lootSubTab: 'matrix' | 'gear' | 'weapon';
  setLootSubTab: (tab: 'matrix' | 'gear' | 'weapon') => void;

  // View state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  groupView: boolean;
  setGroupView: (enabled: boolean, groupId?: string) => void;
  setGroupViewState: React.Dispatch<React.SetStateAction<boolean>>;
  subsView: boolean;
  setSubsView: (enabled: boolean) => void;

  // Floor/sort
  selectedFloor: FloorNumber;
  setSelectedFloor: (floor: FloorNumber) => void;
  sortPreset: SortPreset;
  setSortPreset: (preset: SortPreset, tierId?: string) => void;
  setSortPresetState: React.Dispatch<React.SetStateAction<SortPreset>>;

  // Edit state
  editingPlayerId: string | null;
  setEditingPlayerId: (id: string | null) => void;
  clipboardPlayer: SnapshotPlayer | null;
  setClipboardPlayer: (player: SnapshotPlayer | null) => void;

  // Modal state
  showCreateTierModal: boolean;
  setShowCreateTierModal: (show: boolean) => void;
  showSettingsModal: boolean;
  setShowSettingsModal: (show: boolean) => void;
  showRolloverDialog: boolean;
  setShowRolloverDialog: (show: boolean) => void;
  showDeleteTierConfirm: boolean;
  setShowDeleteTierConfirm: (show: boolean) => void;
  showKeyboardHelp: boolean;
  setShowKeyboardHelp: (show: boolean) => void;
  showLogLootModal: boolean;
  setShowLogLootModal: (show: boolean) => void;
  showLogMaterialModal: boolean;
  setShowLogMaterialModal: (show: boolean) => void;
  showMarkFloorClearedModal: boolean;
  setShowMarkFloorClearedModal: (show: boolean) => void;
  showLogWeekWizard: boolean;
  setShowLogWeekWizard: (show: boolean) => void;
  logWeekWizardFloor: FloorNumber | null;
  setLogWeekWizardFloor: (floor: FloorNumber | null) => void;
  logWeekWizardWeek: number | null;
  setLogWeekWizardWeek: (week: number | null) => void;
  playerModalCount: number;
  setPlayerModalCount: React.Dispatch<React.SetStateAction<number>>;

  // Highlight state
  highlightedPlayerId: string | null;
  setHighlightedPlayerId: (id: string | null) => void;
  highlightedSlot: string | null;
  setHighlightedSlot: (slot: string | null) => void;
  highlightedEntry: HighlightedEntry | null;
  setHighlightedEntry: (entry: HighlightedEntry | null) => void;
  highlightedBookPlayerId: string | null;
  setHighlightedBookPlayerId: (id: string | null) => void;
}

export function useGroupViewState(): UseGroupViewStateReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // ===== Modal state =====
  const [showCreateTierModal, setShowCreateTierModal] = useState(false);
  const [showSettingsModalState, setShowSettingsModalState] = useState(() => {
    return searchParams.get('showSettings') === 'true';
  });
  const [showRolloverDialog, setShowRolloverDialog] = useState(false);
  const [showDeleteTierConfirm, setShowDeleteTierConfirm] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showLogLootModal, setShowLogLootModal] = useState(false);
  const [showLogMaterialModal, setShowLogMaterialModal] = useState(false);
  const [showMarkFloorClearedModal, setShowMarkFloorClearedModal] = useState(false);
  const [showLogWeekWizard, setShowLogWeekWizard] = useState(false);
  const [logWeekWizardFloor, setLogWeekWizardFloor] = useState<FloorNumber | null>(null);
  const [logWeekWizardWeek, setLogWeekWizardWeek] = useState<number | null>(null);
  const [playerModalCount, setPlayerModalCount] = useState(0);

  // Note: showSettingsModalState is initialized from URL but not bi-directionally synced.
  // This matches the pattern for other URL-synced state in this hook (pageMode, viewMode, etc.).
  // Browser back/forward won't restore modal state, which is intentional - modals are transient UI.
  // Adding reverse sync (URL -> state) would risk cascading renders and deviate from established patterns.

  // ===== Tab state: URL param > localStorage > default =====
  // URL uses user-friendly names: log, summary; internal PageMode uses: history, stats
  const [pageMode, setPageModeState] = useState<PageMode>(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab === 'players') return 'players';
    if (urlTab === 'loot' || urlTab === 'priority') return 'loot';
    if (urlTab === 'weapon') return 'priority';
    if (urlTab === 'log') return 'history';
    if (urlTab === 'summary') return 'stats';
    const saved = localStorage.getItem('group-view-tab');
    // Handle legacy tab values - redirect to current equivalents
    if (saved === 'stats') return 'players';
    if (saved === 'priority') return 'loot';
    return (saved as PageMode) || 'players';
  });

  // Subtab state for loot panel: URL param > localStorage > default
  const [lootSubTab, setLootSubTabState] = useState<'matrix' | 'gear' | 'weapon'>(() => {
    const urlSubtab = searchParams.get('subtab');
    if (urlSubtab === 'matrix' || urlSubtab === 'gear' || urlSubtab === 'weapon') {
      return urlSubtab;
    }
    try {
      const saved = localStorage.getItem('loot-priority-subtab');
      if (saved === 'matrix' || saved === 'gear' || saved === 'weapon') return saved;
    } catch {
      // Ignore
    }
    return 'matrix';
  });

  // ===== View state: URL param > localStorage > default =====
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const urlView = searchParams.get('view');
    if (urlView === 'compact' || urlView === 'expanded') return urlView;
    const saved = localStorage.getItem('party-view-mode');
    return saved === 'expanded' ? 'expanded' : 'compact';
  });

  // Floor selection: URL param > default (1)
  const [selectedFloor, setSelectedFloorState] = useState<FloorNumber>(() => {
    const urlFloor = searchParams.get('floor');
    if (urlFloor === '1' || urlFloor === '2' || urlFloor === '3' || urlFloor === '4') {
      return parseInt(urlFloor, 10) as FloorNumber;
    }
    return 1;
  });

  // Sort preset: URL param > localStorage > default
  const [sortPreset, setSortPresetState] = useState<SortPreset>(() => {
    const urlSort = searchParams.get('sort');
    if (urlSort === 'standard' || urlSort === 'dps-first' || urlSort === 'healer-first' || urlSort === 'custom') {
      return urlSort;
    }
    return 'standard'; // Will be overwritten by tier-specific localStorage in useEffect
  });

  // Group view (G1/G2): URL param > localStorage > default (true)
  // Note: localStorage loading happens per-group in GroupView.tsx useEffect
  const [groupView, setGroupViewState] = useState(() => {
    const urlParam = searchParams.get('groups');
    // Only respect explicit URL param, otherwise default to true
    if (urlParam === 'true') return true;
    if (urlParam === 'false') return false;
    return true; // Default to ON
  });

  // Subs view (separate substitutes): URL param > default (true)
  const [subsView, setSubsViewState] = useState(() => {
    return searchParams.get('subs') !== 'false';
  });

  // ===== Edit state =====
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [clipboardPlayer, setClipboardPlayer] = useState<SnapshotPlayer | null>(null);

  // ===== Highlight state =====
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<string | null>(null);
  const [highlightedSlot, setHighlightedSlot] = useState<string | null>(null);
  const [highlightedEntry, setHighlightedEntry] = useState<HighlightedEntry | null>(null);
  const [highlightedBookPlayerId, setHighlightedBookPlayerId] = useState<string | null>(null);

  // ===== Wrapper functions that sync state, localStorage, and URL =====

  // Wrapper to persist pageMode and update URL
  const setPageMode = useCallback((mode: PageMode) => {
    setPageModeState(mode);
    // Reset scroll position when switching tabs (prevents scroll bleed between tabs)
    // Use main element (which has overflow-y-auto) if it exists, fallback to window
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
    try {
      localStorage.setItem('group-view-tab', mode);
    } catch {
      // Ignore localStorage errors
    }
    // Map internal PageMode to URL-friendly names
    const urlTab = mode === 'history' ? 'log' : mode === 'stats' ? 'summary' : mode === 'loot' ? 'priority' : mode === 'priority' ? 'weapon' : mode;
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('tab', urlTab);
      // Set or clear subtab depending on whether we're on the loot tab
      if (mode === 'loot') {
        params.set('subtab', lootSubTab);
      } else {
        params.delete('subtab');
      }
      return params;
    }, { replace: true });
  }, [setSearchParams, lootSubTab]);

  // Wrapper to persist lootSubTab and update URL
  const setLootSubTab = useCallback((tab: 'matrix' | 'gear' | 'weapon') => {
    setLootSubTabState(tab);
    try {
      localStorage.setItem('loot-priority-subtab', tab);
    } catch {
      // Ignore localStorage errors
    }
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('subtab', tab);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapper to persist viewMode and update URL
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    analytics.track('feature', 'view_mode_change', { mode });
    try {
      localStorage.setItem('party-view-mode', mode);
    } catch {
      // Ignore localStorage errors
    }
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (mode === 'compact') {
        params.delete('view');
      } else {
        params.set('view', mode);
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapper to update floor and URL
  const setSelectedFloor = useCallback((floor: FloorNumber) => {
    setSelectedFloorState(floor);
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (floor === 1) {
        params.delete('floor');
      } else {
        params.set('floor', String(floor));
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapper to persist sortPreset per-tier and update URL
  const setSortPreset = useCallback((preset: SortPreset, tierId?: string) => {
    setSortPresetState(preset);
    if (tierId) {
      try {
        localStorage.setItem(`sort-preset-${tierId}`, preset);
      } catch {
        // Ignore localStorage errors
      }
    }
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (preset === 'standard') {
        params.delete('sort');
      } else {
        params.set('sort', preset);
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapper to persist groupView per-group and update URL
  const setGroupView = useCallback((enabled: boolean, groupId?: string) => {
    setGroupViewState(enabled);
    if (groupId) {
      try {
        localStorage.setItem(`group-view-groups-${groupId}`, String(enabled));
      } catch {
        // Ignore localStorage errors
      }
    }
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (enabled) {
        params.set('groups', 'true');
      } else {
        params.delete('groups');
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapper to update subsView and URL
  const setSubsView = useCallback((enabled: boolean) => {
    setSubsViewState(enabled);
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (enabled) {
        params.delete('subs');  // true is default, omit from URL
      } else {
        params.set('subs', 'false');  // explicit hide
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapper to update showSettingsModal and clear URL param when closing
  const setShowSettingsModal = useCallback((show: boolean) => {
    setShowSettingsModalState(show);
    if (!show) {
      // Clear URL param when closing settings panel
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.delete('showSettings');
        return params;
      }, { replace: true });
    }
  }, [setSearchParams]);

  return {
    // URL params
    searchParams,
    setSearchParams,

    // Tab state
    pageMode,
    setPageMode,
    lootSubTab,
    setLootSubTab,

    // View state
    viewMode,
    setViewMode,
    groupView,
    setGroupView,
    setGroupViewState,
    subsView,
    setSubsView,

    // Floor/sort
    selectedFloor,
    setSelectedFloor,
    sortPreset,
    setSortPreset,
    setSortPresetState,

    // Edit state
    editingPlayerId,
    setEditingPlayerId,
    clipboardPlayer,
    setClipboardPlayer,

    // Modal state
    showCreateTierModal,
    setShowCreateTierModal,
    showSettingsModal: showSettingsModalState,
    setShowSettingsModal,
    showRolloverDialog,
    setShowRolloverDialog,
    showDeleteTierConfirm,
    setShowDeleteTierConfirm,
    showKeyboardHelp,
    setShowKeyboardHelp,
    showLogLootModal,
    setShowLogLootModal,
    showLogMaterialModal,
    setShowLogMaterialModal,
    showMarkFloorClearedModal,
    setShowMarkFloorClearedModal,
    showLogWeekWizard,
    setShowLogWeekWizard,
    logWeekWizardFloor,
    setLogWeekWizardFloor,
    logWeekWizardWeek,
    setLogWeekWizardWeek,
    playerModalCount,
    setPlayerModalCount,

    // Highlight state
    highlightedPlayerId,
    setHighlightedPlayerId,
    highlightedSlot,
    setHighlightedSlot,
    highlightedEntry,
    setHighlightedEntry,
    highlightedBookPlayerId,
    setHighlightedBookPlayerId,
  };
}
