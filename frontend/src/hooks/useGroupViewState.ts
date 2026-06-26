/**
 * useGroupViewState Hook
 *
 * Manages all UI state for GroupView with URL param and localStorage sync.
 * Centralizes the complex state management that was previously in GroupView.tsx.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { analytics } from '../services/analytics';
import { useAuthStore } from '../stores/authStore';
import { clearRegisteredTabParams } from './useUrlTabState';
import type { PageMode, GearSubTab, ViewMode, SortPreset, SnapshotPlayer } from '../types';
import type { FloorNumber } from '../gamedata/loot-tables';

type LootSubTab = 'matrix' | 'gear' | 'weapon';

// ── URL → state parsers (shared by initial state and back/forward reconciliation) ──
// Each returns null when the param is absent/unrecognized so callers can fall
// back to the current value (rather than clobbering it).
function pageModeFromTabParam(urlTab: string | null): PageMode | null {
  switch (urlTab) {
    case 'overview': case 'roster': case 'schedule': case 'goals': case 'gear': case 'more':
      return urlTab;
    // Backward-compat: legacy tab values
    case 'home': return 'overview';
    case 'players': return 'roster';
    case 'loot': case 'priority': case 'weapon': case 'log': case 'history': case 'summary': return 'gear';
    case 'mount-farms': case 'collections': return 'goals';
    default: return null;
  }
}

function gearSubFromParam(urlSub: string | null): GearSubTab | null {
  if (urlSub === 'sync' || urlSub === 'priority' || urlSub === 'history' || urlSub === 'stats') return urlSub;
  if (urlSub === 'weapon') return 'priority';
  if (urlSub === 'summary') return 'stats';
  return null;
}

function lootSubFromParam(urlSubtab: string | null): LootSubTab | null {
  if (urlSubtab === 'matrix' || urlSubtab === 'gear' || urlSubtab === 'weapon') return urlSubtab;
  return null;
}

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
  /** Switch tabs; pass extraParams to set additional URL query params atomically
   *  (e.g. a target sub-tab) in the same history entry. */
  setPageMode: (mode: PageMode, extraParams?: Record<string, string>) => void;
  gearSubTab: GearSubTab;
  setGearSubTab: (tab: GearSubTab) => void;
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
  const navigate = useNavigate();
  // History index from just before the settings panel was opened, so closing
  // can pop the entire settings sub-history (all the tab/section entries pushed
  // while it was open) in one go and land back on the page underneath.
  const preSettingsIdxRef = useRef<number | null>(null);

  // ===== Modal state =====
  const [showCreateTierModal, setShowCreateTierModal] = useState(false);
  // The settings panel's open state is DERIVED from the URL (open when the
  // `showSettings` flag or a specific `settings` tab is present). All settings
  // navigation uses { replace }, so it never adds history entries — closing the
  // panel and hitting back goes to the previous page instead of replaying the
  // panel's internal tab changes (which would only change the URL invisibly).
  const showSettingsModal = searchParams.get('showSettings') === 'true' || !!searchParams.get('settings');
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
  const [pageMode, setPageModeState] = useState<PageMode>(() => {
    const urlTab = searchParams.get('tab');
    // New values pass through directly
    if (urlTab === 'overview') return 'overview';
    if (urlTab === 'roster') return 'roster';
    if (urlTab === 'schedule') return 'schedule';
    if (urlTab === 'goals') return 'goals';
    if (urlTab === 'gear') return 'gear';
    if (urlTab === 'more') return 'more';
    // Backward-compat: old URL param values
    if (urlTab === 'home') return 'overview';
    if (urlTab === 'players') return 'roster';
    if (urlTab === 'loot' || urlTab === 'priority') return 'gear';
    if (urlTab === 'weapon') return 'gear';
    if (urlTab === 'log' || urlTab === 'history') return 'gear';
    if (urlTab === 'summary') return 'gear';
    if (urlTab === 'mount-farms' || urlTab === 'collections') return 'goals';
    // Deep links to a specific player (e.g., from the Dalamud plugin) should land
    // on the Roster tab so the highlighted card is actually visible.
    if (searchParams.get('player')) return 'roster';
    const saved = localStorage.getItem('group-view-tab');
    // Handle legacy saved values - map to new equivalents
    if (saved === 'home') return 'overview';
    if (saved === 'players') return 'roster';
    if (saved === 'loot' || saved === 'priority' || saved === 'history' || saved === 'stats') return 'gear';
    if (saved === 'mount-farms') return 'goals';
    // If saved value is already a new PageMode value, use it
    if (saved === 'overview' || saved === 'roster' || saved === 'schedule' || saved === 'goals' || saved === 'gear' || saved === 'more') {
      return saved as PageMode;
    }
    return 'roster';
  });

  // ===== Gear sub-tab state: URL ?sub= > localStorage > default =====
  const [gearSubTab, setGearSubTabState] = useState<GearSubTab>(() => {
    const urlSub = searchParams.get('sub');
    if (urlSub === 'sync' || urlSub === 'priority' || urlSub === 'history' || urlSub === 'stats') {
      return urlSub;
    }
    // Backward-compat: old sub param values
    if (urlSub === 'weapon') return 'priority';
    if (urlSub === 'summary') return 'stats';
    // Also handle old URL tab= values that map to specific gear sub-tabs
    const urlTab = searchParams.get('tab');
    if (urlTab === 'loot' || urlTab === 'priority') return 'priority';
    if (urlTab === 'weapon') return 'priority';
    if (urlTab === 'log' || urlTab === 'history') return 'history';
    if (urlTab === 'summary') return 'stats';
    // Only restore the remembered sub-tab when the user wants sub-tabs remembered.
    try {
      if (useAuthStore.getState().user?.rememberSubTabs ?? true) {
        const saved = localStorage.getItem('gear-subtab');
        if (saved === 'sync' || saved === 'priority' || saved === 'history' || saved === 'stats') return saved;
        // Migrate old saved value 'weapon' → 'priority'
        if (saved === 'weapon') return 'priority';
      }
    } catch {
      // Ignore
    }
    return 'sync';
  });

  // Subtab state for loot panel: URL param > localStorage > default
  const [lootSubTab, setLootSubTabState] = useState<'matrix' | 'gear' | 'weapon'>(() => {
    const urlSubtab = searchParams.get('subtab');
    if (urlSubtab === 'matrix' || urlSubtab === 'gear' || urlSubtab === 'weapon') {
      return urlSubtab;
    }
    try {
      if (useAuthStore.getState().user?.rememberSubTabs ?? true) {
        const saved = localStorage.getItem('loot-priority-subtab');
        if (saved === 'matrix' || saved === 'gear' || saved === 'weapon') return saved;
      }
    } catch {
      // Ignore
    }
    return 'gear';
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
  const setPageMode = useCallback((mode: PageMode, extraParams?: Record<string, string>) => {
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
    // When the user has turned OFF "remember sub-tabs", navigating to a primary
    // tab resets every view's sub-tab to its default. Clearing the registered
    // sub-tab params resets the URL-derived ones; the gear/loot sub-tabs (held
    // in state here) are reset explicitly just below.
    const resetSubTabs = !(useAuthStore.getState().user?.rememberSubTabs ?? true);
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('tab', mode);
      // Clear old subtab param; gear sub-tab is stored as ?sub=
      params.delete('subtab');
      if (resetSubTabs) {
        clearRegisteredTabParams(params); // rsub, sched, goal, farm, coll, stab, avail, mf, …
        params.delete('sub'); // gear sub-tab param (not managed by the hook)
      }
      // Apply any caller-supplied params (e.g. a target sub-tab) AFTER the reset
      // so an explicit deep-link target (e.g. Open Mount Farms → goal=farms) wins.
      if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) params.set(key, value);
      }
      return params;
    });
    if (resetSubTabs) {
      setGearSubTabState('sync');
      setLootSubTabState('gear');
    }
    // Note: pushes a history entry (no { replace }) so browser back/forward
    // returns to the previously-viewed tab.
  }, [setSearchParams]);

  // Wrapper to persist gearSubTab and update URL
  const setGearSubTab = useCallback((tab: GearSubTab) => {
    setGearSubTabState(tab);
    try {
      localStorage.setItem('gear-subtab', tab);
    } catch {
      // Ignore localStorage errors
    }
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('sub', tab);
      return params;
    }); // push so back/forward returns to the prior gear sub-tab
  }, [setSearchParams]);

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
    }); // push so back/forward returns to the prior priority sub-tab
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

  // Open/close the settings panel via the URL. The panel's open state is derived
  // from the `showSettings`/`settings` params, so its internal tab/section
  // changes PUSH history — back steps through them while the panel is open.
  // Opening pushes one entry (recording the index beneath it); closing jumps
  // straight back to that pre-open entry, collapsing the whole settings
  // sub-history so back-after-close goes to the previous page, not a replay.
  const setShowSettingsModal = useCallback((show: boolean) => {
    if (show) {
      preSettingsIdxRef.current = (window.history.state?.idx as number | undefined) ?? null;
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.set('showSettings', 'true');
        return params;
      }); // push — this is the single "panel open" history entry
    } else {
      const base = preSettingsIdxRef.current;
      const current = (window.history.state?.idx as number | undefined) ?? null;
      preSettingsIdxRef.current = null;
      if (base != null && current != null && current > base) {
        // Pop back to the entry from before the panel opened (closes the panel,
        // since that entry has no settings params).
        navigate(base - current);
      } else {
        // Opened via deep-link (no recorded baseline) — strip the params in place.
        setSearchParams(prev => {
          const params = new URLSearchParams(prev);
          params.delete('showSettings');
          params.delete('settings');
          params.delete('ssub');
          return params;
        }, { replace: true });
      }
    }
  }, [setSearchParams, navigate]);

  // ===== Browser back/forward support =====
  // Reflect the initial tab in the URL once (replace, no new history entry) so
  // every history entry carries a ?tab — otherwise going back to the very first
  // entry (which had no tab param) couldn't restore the starting tab.
  useEffect(() => {
    if (!searchParams.get('tab')) {
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.set('tab', pageMode);
        return params;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconcile tab/sub-tab state FROM the URL whenever it changes. For our own
  // setters this is a no-op (state already matches what we just wrote); for
  // browser back/forward it's what actually moves the UI to the popped entry.
  useEffect(() => {
    const t = pageModeFromTabParam(searchParams.get('tab'));
    if (t && t !== pageMode) setPageModeState(t);
    const s = gearSubFromParam(searchParams.get('sub'));
    if (s && s !== gearSubTab) setGearSubTabState(s);
    const l = lootSubFromParam(searchParams.get('subtab'));
    if (l && l !== lootSubTab) setLootSubTabState(l);
  }, [searchParams, pageMode, gearSubTab, lootSubTab]);

  return {
    // URL params
    searchParams,
    setSearchParams,

    // Tab state
    pageMode,
    setPageMode,
    gearSubTab,
    setGearSubTab,
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
