/**
 * useGroupViewState Hook
 *
 * Manages all UI state for GroupView with URL param and localStorage sync.
 * Centralizes the complex state management that was previously in GroupView.tsx.
 */

import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  setGroupView: (enabled: boolean) => void;
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
  playerModalCount: number;
  setPlayerModalCount: React.Dispatch<React.SetStateAction<number>>;

  // Highlight state
  highlightedPlayerId: string | null;
  setHighlightedPlayerId: (id: string | null) => void;
  highlightedEntry: HighlightedEntry | null;
  setHighlightedEntry: (entry: HighlightedEntry | null) => void;
}

export function useGroupViewState(): UseGroupViewStateReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // ===== Modal state =====
  const [showCreateTierModal, setShowCreateTierModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRolloverDialog, setShowRolloverDialog] = useState(false);
  const [showDeleteTierConfirm, setShowDeleteTierConfirm] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showLogLootModal, setShowLogLootModal] = useState(false);
  const [showLogMaterialModal, setShowLogMaterialModal] = useState(false);
  const [showMarkFloorClearedModal, setShowMarkFloorClearedModal] = useState(false);
  const [playerModalCount, setPlayerModalCount] = useState(0);

  // ===== Tab state: URL param > localStorage > default =====
  // URL uses user-friendly names: log, summary; internal PageMode uses: history, stats
  const [pageMode, setPageModeState] = useState<PageMode>(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab === 'players') return 'players';
    if (urlTab === 'loot') return 'loot';
    if (urlTab === 'log') return 'history';
    if (urlTab === 'summary') return 'stats';
    const saved = localStorage.getItem('group-view-tab');
    // Handle legacy 'stats' tab - redirect to 'players'
    if (saved === 'stats') return 'players';
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

  // Group view (G1/G2): URL param > default (false)
  const [groupView, setGroupViewState] = useState(() => {
    return searchParams.get('groups') === 'true';
  });

  // Subs view (separate substitutes): URL param > default (false)
  const [subsView, setSubsViewState] = useState(() => {
    return searchParams.get('subs') === 'true';
  });

  // ===== Edit state =====
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [clipboardPlayer, setClipboardPlayer] = useState<SnapshotPlayer | null>(null);

  // ===== Highlight state =====
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<string | null>(null);
  const [highlightedEntry, setHighlightedEntry] = useState<HighlightedEntry | null>(null);

  // ===== Wrapper functions that sync state, localStorage, and URL =====

  // Wrapper to persist pageMode and update URL
  const setPageMode = useCallback((mode: PageMode) => {
    setPageModeState(mode);
    try {
      localStorage.setItem('group-view-tab', mode);
    } catch {
      // Ignore localStorage errors
    }
    // Map internal PageMode to URL-friendly names
    const urlTab = mode === 'history' ? 'log' : mode === 'stats' ? 'summary' : mode;
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('tab', urlTab);
      // Set or clear subtab depending on whether we're on the loot tab
      if (mode === 'loot') {
        params.set('subtab', lootSubTabState);
      } else {
        params.delete('subtab');
      }
      return params;
    }, { replace: true });
  }, [setSearchParams, lootSubTabState]);

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

  // Wrapper to update groupView and URL
  const setGroupView = useCallback((enabled: boolean) => {
    setGroupViewState(enabled);
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
        params.set('subs', 'true');
      } else {
        params.delete('subs');
      }
      return params;
    }, { replace: true });
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
    showSettingsModal,
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
    playerModalCount,
    setPlayerModalCount,

    // Highlight state
    highlightedPlayerId,
    setHighlightedPlayerId,
    highlightedEntry,
    setHighlightedEntry,
  };
}
