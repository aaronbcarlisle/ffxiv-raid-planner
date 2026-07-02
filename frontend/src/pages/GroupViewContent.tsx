/* eslint-disable design-system/no-raw-button */
/**
 * GroupViewContent
 *
 * The shared content region extracted from GroupView (F6a, Task 3). It owns ALL
 * of the content derivation — the `useGroupViewState` instance, `usePlayerActions`,
 * the DnD hook, store reads, the content-owned modals (loot / material / log-week
 * wizard / mark-floor), the `rosterDndArea` memo, the roster sticky toolbar, the
 * page header, and the `pageMode` tab switch — and renders, per spine tab,
 * `slots?.[mode] ?? <legacy body>`.
 *
 * GroupView (legacy chrome) and NewShell (Task 4) both render this with no slots →
 * the legacy bodies. F6b–F6e swap one screen at a time by passing a `slots` entry.
 *
 * Chrome-triggered actions (add-player, tier ops) are invoked through the `actions`
 * prop; the chrome owns those modals (shared `GroupActionModals`). This component
 * reads modal-open state and the add-player highlight signal from the GroupActions
 * context (`useGroupActionModalOpen` / `useGroupAddedPlayer`) so a chrome modal
 * still disables the content keyboard shortcuts + DnD, and a freshly added player
 * still scrolls into view + highlights — exactly as before the F6a split.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, pointerWithin } from '@dnd-kit/core';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useLootTrackingStore } from '../stores/lootTrackingStore';
import { useViewAsStore } from '../stores/viewAsStore';
import { toast } from '../stores/toastStore';
import { getTierById } from '../gamedata';
import { RosterDragOverlay } from '../components/player/RosterDragOverlay';
import { PlayerGrid } from '../components/player/PlayerGrid';
import { RosterViewToggle } from '../components/player/RosterViewToggle';
import { useDragAndDrop } from '../components/dnd/useDragAndDrop';
import { LootPriorityPanel, LogWeekWizard } from '../components/loot';
import { TeamSummaryEnhanced } from '../components/team/TeamSummaryEnhanced';
import { HistoryView } from '../components/history/HistoryView';
import { ScheduleTab } from '../components/schedule';
import { ScheduleUpcomingPanel } from '../components/schedule/ScheduleUpcomingPanel';
import { SplitClearPlanner } from '../components/split-clear/SplitClearPlanner';
import { RosterCharacterPanel } from '../components/roster/RosterCharacterPanel';
import { useMountFarmStore } from '../stores/mountFarmStore';
import { useSplitClearStore } from '../stores/splitClearStore';
import { ViewModeToggle, SortModeSelector, GroupViewToggle, MobileBottomNav, Checkbox, Modal } from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { MorePage } from '../components/group/MorePage';
import { GoalsPage } from '../components/group/GoalsPage';
import { GearSyncDashboard } from '../components/group/GearSyncDashboard';
import { PluginPage } from '../components/group/PluginPage';
import { useDevice } from '../hooks/useDevice';
import { useSwipe } from '../hooks/useSwipe';
import { LayoutDashboard, Calendar, Users, Trophy, Shield, MoreHorizontal, PlugZap, Lock, Unlock } from 'lucide-react';
import { Button, Tooltip } from '../components/primitives';
import { TierSelector } from '../components/static-group';
import { StaticHomeTab } from '../components/static-group/StaticHomeTab';
import type { SettingsTab } from '../components/settings';
import { useSettingsPanelStore } from '../stores/settingsPanelStore';
import { useGroupViewState } from '../hooks/useGroupViewState';
import { useUrlTabState } from '../hooks/useUrlTabState';
import { usePlayerActions } from '../hooks/usePlayerActions';
import { useGroupViewKeyboardShortcuts } from '../hooks/useGroupViewKeyboardShortcuts';
import { useViewNavigation } from '../hooks/useViewNavigation';
import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';
import { eventBus, useEventBus, Events } from '../lib/eventBus';
import { useGroupActionModalOpen, useGroupAddedPlayer, useGroupClearAddedPlayer } from './groupActionsContext';
import { sortPlayersByRole, groupPlayersByLightParty } from '../utils/calculations';
import { SORT_PRESETS, DEFAULT_SETTINGS } from '../utils/constants';
import { canManageRoster } from '../utils/permissions';
import type { SnapshotPlayer, GearSlot, SortPreset, GearSubTab, PageMode, ViewMode } from '../types';

const ROSTER_SUB_VIEWS = ['members', 'characters', 'split-planner'] as const;
const SCHEDULE_VIEWS = ['upcoming', 'calendar'] as const;

/** The 4 spine tabs that can be slot-overridden by a redesigned screen (F6b–F6e). */
export type GroupTab = 'overview' | 'roster' | 'gear' | 'schedule';

export interface GroupActions {
  onTierChange: (tierId: string) => void;
  onAddPlayer: () => void;
  onNewTier: () => void;
  onRollover: () => void;
  onDeleteTier: () => void;
}

export interface GroupViewContentProps {
  /** Per-tab override; when a tab's slot is absent, its legacy body renders. */
  slots?: Partial<Record<GroupTab, React.ReactNode>>;
  /** Chrome-triggered actions the content's toolbar/bodies invoke (add-player, tier ops).
   *  Fed from the shared GroupActions context (`useGroupActions()`) by each chrome. */
  actions: GroupActions;
}

export function GroupViewContent({ slots, actions }: GroupViewContentProps) {
  const navigate = useNavigate();
  const { currentGroup, groups, error: groupError } = useStaticGroupStore();
  const { tiers, currentTier, isSaving, error: tierError, fetchTier } = useTierStore();
  const { user } = useAuthStore();
  const { viewAsUser } = useViewAsStore();

  // Use extracted state hook
  const state = useGroupViewState();
  const {
    searchParams,
    setSearchParams,
    pageMode,
    setPageMode,
    gearSubTab,
    setGearSubTab,
    lootSubTab,
    setLootSubTab,
    viewMode,
    setViewMode,
    groupView,
    setGroupView,
    setGroupViewState,
    subsView,
    setSubsView,
    selectedFloor,
    setSelectedFloor,
    sortPreset,
    setSortPreset,
    setSortPresetState,
    editingPlayerId,
    setEditingPlayerId,
    clipboardPlayer,
    setClipboardPlayer,
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
    highlightedPlayerId,
    setHighlightedPlayerId,
    highlightedSlot,
    setHighlightedSlot,
    highlightedEntry,
    setHighlightedEntry,
    highlightedBookPlayerId,
    setHighlightedBookPlayerId,
  } = state;

  // Week to navigate to after wizard completion (cleared after SectionedLogView consumes it)
  const [wizardTargetWeek, setWizardTargetWeek] = useState<number | null>(null);
  // Clear wizardTargetWeek after one render cycle so it doesn't re-trigger on subsequent renders
  useEffect(() => {
    if (wizardTargetWeek !== null) {
      const timer = requestAnimationFrame(() => setWizardTargetWeek(null));
      return () => cancelAnimationFrame(timer);
    }
  }, [wizardTargetWeek]);

  // Device capabilities for responsive behavior
  const { isSmallScreen } = useDevice();

  // Content-area swipe to navigate tabs on mobile
  const SWIPE_TABS: PageMode[] = ['overview', 'roster', 'schedule', 'goals', 'gear', 'more'];
  const swipeTabIndex = SWIPE_TABS.indexOf(pageMode);
  const contentSwipeHandlers = useSwipe({
    onSwipeLeft: () => {
      if (isSmallScreen && swipeTabIndex < SWIPE_TABS.length - 1) {
        setPageMode(SWIPE_TABS[swipeTabIndex + 1]);
      }
    },
    onSwipeRight: () => {
      if (isSmallScreen && swipeTabIndex > 0) {
        setPageMode(SWIPE_TABS[swipeTabIndex - 1]);
      }
    },
    minSwipeDistance: 60,
  });

  // Mobile controls sheet (tab-aware bottom sheet, opened from the mobile bottom nav)
  const [showControlsSheet, setShowControlsSheet] = useState(false);

  // Load sortPreset from localStorage when tier changes
  useEffect(() => {
    if (!currentTier?.tierId) return;
    const urlSort = searchParams.get('sort');
    if (urlSort === 'standard' || urlSort === 'dps-first' || urlSort === 'healer-first' || urlSort === 'custom') {
      return;
    }
    try {
      const saved = localStorage.getItem(`sort-preset-${currentTier.tierId}`);
      if (saved === 'standard' || saved === 'dps-first' || saved === 'healer-first' || saved === 'custom') {
        setSortPresetState(saved);
      } else {
        setSortPresetState('standard');
      }
    } catch {
      setSortPresetState('standard');
    }
  }, [currentTier?.tierId, searchParams, setSortPresetState]);

  // Load groupView (G1/G2) from localStorage when group changes
  useEffect(() => {
    if (!currentGroup?.id) return;
    const urlGroups = searchParams.get('groups');
    // Only load from localStorage if no URL param is set
    if (urlGroups === 'true' || urlGroups === 'false') {
      return;
    }
    try {
      const saved = localStorage.getItem(`group-view-groups-${currentGroup.id}`);
      if (saved === 'true') {
        setGroupViewState(true);
      } else if (saved === 'false') {
        setGroupViewState(false);
      } else {
        // Default to true (ON) for new statics
        setGroupViewState(true);
      }
    } catch {
      setGroupViewState(true);
    }
  }, [currentGroup?.id, searchParams, setGroupViewState]);

  // Handle player deep link - switch to Roster tab, scroll to + highlight the card.
  // The Roster switch matters when the link arrives from outside (plugin Ctrl+Click,
  // shared URL) and the user's last-viewed tab was something else.
  useEffect(() => {
    const playerParam = searchParams.get('player');
    if (!playerParam || !currentTier?.players) return;
    const player = currentTier.players.find(p => p.id === playerParam);
    if (!player) return;
    setPageMode('roster');
    setHighlightedPlayerId(playerParam);
    setHighlightedSlot(null); // Clear any stale slot highlight from prior navigation
    setTimeout(() => {
      const element = document.getElementById(`player-card-${playerParam}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    const timer = setTimeout(() => {
      setHighlightedPlayerId(null);
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.delete('player');
        return params;
      }, { replace: true });
    }, 2500);
    return () => clearTimeout(timer);
  }, [searchParams, currentTier?.players, setSearchParams, setHighlightedPlayerId, setHighlightedSlot, setPageMode]);

  // After the shared add-player flow (GroupActionModals) creates a player, scroll to +
  // highlight the new card. The highlight state lives here (content), so the chrome
  // signals via the GroupActions context (`addedPlayer.nonce` re-fires per add).
  // Mirrors the deep-link highlight above.
  const addedPlayer = useGroupAddedPlayer();
  const clearAddedPlayer = useGroupClearAddedPlayer();
  useEffect(() => {
    if (!addedPlayer) return;
    const { playerId } = addedPlayer;
    // Consume the signal immediately so a remount with no new add does NOT
    // re-fire the highlight (one-shot). The local highlightedPlayerId state
    // still drives the 3 s visual highlight — clearing the context signal is safe.
    clearAddedPlayer();
    setHighlightedPlayerId(playerId);
    setHighlightedSlot(null);
    const scrollTimer = setTimeout(() => {
      const element = document.getElementById(`player-card-${playerId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    const clearTimer = setTimeout(() => {
      setHighlightedPlayerId(null);
    }, 3000);
    return () => { clearTimeout(scrollTimer); clearTimeout(clearTimer); };
    // Keyed on the signal object (nonce changes per add) so each add re-fires.
  }, [addedPlayer, clearAddedPlayer, setHighlightedPlayerId, setHighlightedSlot]);

  // Keep roster gear current while the page is open — re-fetches every 30s
  const rosterPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    const groupId = currentGroup.id;
    const tierId = currentTier.tierId;
    rosterPollRef.current = setInterval(() => {
      fetchTier(groupId, tierId).catch(() => {});
    }, 30_000);
    return () => {
      if (rosterPollRef.current) clearInterval(rosterPollRef.current);
    };
  }, [currentGroup?.id, currentTier?.tierId, fetchTier]);

  // Refresh tier data when member roles change (updates linkedUser.membershipRole on player cards)
  useEventBus<{ groupId: string; userId: string; role: string }>(
    Events.MEMBER_ROLE_CHANGED,
    useCallback((data) => {
      if (currentGroup?.id === data.groupId && currentTier?.tierId) {
        fetchTier(currentGroup.id, currentTier.tierId);
      }
    }, [currentGroup?.id, currentTier?.tierId, fetchTier])
  );

  // Initialize loot tracking store when Loot or Players tab is active
  const { currentWeek: storeCurrentWeek, maxWeek: storeMaxWeek, fetchCurrentWeek, fetchLootLog, lootLog, fetchMaterialLog, materialLog } = useLootTrackingStore();
  useEffect(() => {
    if ((pageMode === 'gear' || pageMode === 'roster') && currentGroup?.id && currentTier?.tierId) {
      fetchCurrentWeek(currentGroup.id, currentTier.tierId);
      fetchLootLog(currentGroup.id, currentTier.tierId);
      fetchMaterialLog(currentGroup.id, currentTier.tierId);
    }
  }, [pageMode, currentGroup?.id, currentTier?.tierId, fetchCurrentWeek, fetchLootLog, fetchMaterialLog]);

  // Split clear store
  const { fetchData: fetchSplitClear, clearData: clearSplitClear } = useSplitClearStore();
  // Roster & Schedule sub-tabs live in the URL via the shared hook — one line
  // each gives deep-linking, reload persistence, and browser back/forward.
  const [rosterSubView, setRosterSubView] = useUrlTabState('rsub', ROSTER_SUB_VIEWS, 'members');
  const [scheduleView, setScheduleView] = useUrlTabState('sched', SCHEDULE_VIEWS, 'upcoming');
  useEffect(() => {
    if (pageMode === 'roster' && currentGroup?.id) {
      void fetchSplitClear(currentGroup.id);
    }
  }, [pageMode, currentGroup?.id, fetchSplitClear]);
  useEffect(() => { return () => clearSplitClear(); }, [clearSplitClear]);

  // Silently refetch split-clear data when the user returns from another tab
  // (e.g. after linking characters on the profile page).
  useVisibilityRefresh(useCallback(() => {
    if (pageMode === 'roster' && currentGroup?.id) {
      void fetchSplitClear(currentGroup.id);
    }
  }, [pageMode, currentGroup?.id, fetchSplitClear]));

  // Admin access only when navigating from Admin Dashboard with adminMode=true
  const adminModeParam = searchParams.get('adminMode') === 'true';
  const isAdmin = user?.isAdmin ?? false; // Separate flag for admin features (always true for admins)
  const isAdminAccess = !viewAsUser && isAdmin && adminModeParam;

  // Get the role from API, but ignore admin-elevated role when not in admin mode.
  // This ensures exiting admin mode correctly shows the user has no role for this static.
  const actualUserRole = (currentGroup?.isAdminAccess && !adminModeParam)
    ? null
    : currentGroup?.userRole;
  const userRole = viewAsUser ? viewAsUser.role : actualUserRole;
  const canEdit = userRole === 'owner' || userRole === 'lead' || isAdminAccess;
  const effectiveUserId = viewAsUser ? viewAsUser.userId : user?.id;

  // Memoize setSortPreset wrapper to prevent unnecessary re-renders
  const setSortPresetWithTier = useCallback(
    (preset: SortPreset) => setSortPreset(preset, currentTier?.tierId),
    [setSortPreset, currentTier?.tierId]
  );

  // Use extracted player actions hook
  const playerActions = usePlayerActions({
    groupId: currentGroup?.id,
    tierId: currentTier?.tierId,
    players: currentTier?.players,
    setEditingPlayerId,
    setSortPreset: setSortPresetWithTier,
  });

  // Use extracted navigation hook
  const { handleNavigateToPlayer, handleNavigateToLootEntry, handleNavigateToMaterialEntry, handleNavigateToBooksPanel } = useViewNavigation({
    setPageMode,
    setGearSubTab,
    setHighlightedPlayerId,
    setHighlightedSlot,
    setHighlightedEntry,
    setHighlightedBookPlayerId,
    lootLog,
    materialLog,
  });

  // Calculate sorted players
  const sortedPlayers = useMemo(() => {
    if (!currentTier?.players) return [];
    const displayOrder = SORT_PRESETS[sortPreset]?.order ?? DEFAULT_SETTINGS.displayOrder;
    return sortPlayersByRole(currentTier.players, displayOrder, sortPreset);
  }, [currentTier?.players, sortPreset]);

  // Check if current user has already claimed a player in this tier
  const userHasClaimedPlayer = useMemo(() => {
    const checkUserId = viewAsUser ? viewAsUser.userId : user?.id;
    if (!checkUserId || !currentTier?.players) return false;
    return currentTier.players.some(p => p.userId === checkUserId);
  }, [viewAsUser, user?.id, currentTier?.players]);

  // Group players by light party when group view is enabled
  const groupedPlayers = useMemo(() => {
    if (!groupView) return null;
    return groupPlayersByLightParty(sortedPlayers, subsView);
  }, [groupView, sortedPlayers, subsView]);

  // Check if we have enough position data to enable group view
  const hasPositionData = sortedPlayers.filter(p => p.configured && p.position).length >= 2;

  // Check if any substitutes exist
  const hasSubstitutes = useMemo(() => {
    return sortedPlayers.some(p => p.isSubstitute);
  }, [sortedPlayers]);

  // Main roster players (configured and not substitutes)
  const mainRosterPlayers = useMemo(() => {
    return sortedPlayers.filter(p => p.configured && !p.isSubstitute);
  }, [sortedPlayers]);

  // Match errorStack to whichever error is being displayed
  const error = groupError || tierError;

  // Get tier info for display
  const tierInfo = currentTier ? getTierById(currentTier.tierId) : null;

  // Check roster management permission for DnD
  const rosterPermission = canManageRoster(userRole, isAdminAccess);

  // Compute which slots have loot entries for each player
  const playerSlotsWithLootEntries = useMemo(() => {
    const map = new Map<string, Set<GearSlot>>();
    for (const entry of lootLog) {
      const existing = map.get(entry.recipientPlayerId) ?? new Set<GearSlot>();
      // Loot log stores rings as "ring" — map to both ring1/ring2 for gear slot matching
      if (entry.itemSlot === 'ring') {
        existing.add('ring1');
        existing.add('ring2');
      } else {
        existing.add(entry.itemSlot as GearSlot);
      }
      map.set(entry.recipientPlayerId, existing);
    }
    return map;
  }, [lootLog]);

  // Compute which slots have material entries for each player (for tome slot navigation)
  const playerSlotsWithMaterialEntries = useMemo(() => {
    const map = new Map<string, Set<GearSlot | 'tome_weapon'>>();
    for (const entry of materialLog) {
      // Universal tomestone doesn't have slotAugmented but maps to tome_weapon
      const slot = entry.slotAugmented
        ?? (entry.materialType === 'universal_tomestone' ? 'tome_weapon' : null);
      if (slot) {
        const existing = map.get(entry.recipientPlayerId) ?? new Set<GearSlot | 'tome_weapon'>();
        existing.add(slot);
        map.set(entry.recipientPlayerId, existing);
      }
    }
    return map;
  }, [materialLog]);

  // Check if any modal is open (including error modal).
  // `isActionModalOpen` (from the GroupActions context) carries the chrome-owned
  // add-player + create/rollover/delete tier open-state so they still disable
  // shortcuts + DnD exactly as before the F6a split.
  const isActionModalOpen = useGroupActionModalOpen();
  const isErrorModalOpen = !!error && !!currentGroup;
  const isAnyModalOpen = isActionModalOpen ||
                          showKeyboardHelp || showLogLootModal ||
                          showLogMaterialModal || showMarkFloorClearedModal ||
                          showLogWeekWizard ||
                          isErrorModalOpen ||
                          playerModalCount > 0;

  // Use extracted keyboard shortcuts hook
  useGroupViewKeyboardShortcuts({
    pageMode,
    setPageMode,
    gearSubTab,
    setGearSubTab,
    lootSubTab,
    setLootSubTab,
    viewMode,
    setViewMode,
    groupView,
    setGroupView,
    subsView,
    setSubsView,
    hasSubstitutes,
    canEdit,
    currentTier,
    groups,
    currentGroup,
    tiers,
    navigate,
    shellParam: searchParams.get('shell') ?? undefined,
    setShowKeyboardHelp,
    setEditingPlayerId,
    setHighlightedPlayerId,
    setShowLogLootModal,
    setShowLogMaterialModal,
    setShowMarkFloorClearedModal,
  }, isAnyModalOpen);

  // Modal callbacks for PlayerCards
  const handlePlayerModalOpen = useCallback(() => {
    setPlayerModalCount(prev => prev + 1);
  }, [setPlayerModalCount]);

  const handlePlayerModalClose = useCallback(() => {
    setPlayerModalCount(prev => Math.max(0, prev - 1));
  }, [setPlayerModalCount]);

  // Stable identity so PlayerGrid's memo bails on unrelated parent re-renders.
  const handleCancelEdit = useCallback(() => setEditingPlayerId(null), [setEditingPlayerId]);

  // Roster toolbar toggles (persisted)
  // Hide/show the substitutes section entirely
  const [subsHidden, setSubsHidden] = useState<boolean>(() => {
    try { return localStorage.getItem('roster-hide-subs') === 'true'; } catch { return false; }
  });
  const setSubsHiddenPersist = useCallback((hidden: boolean) => {
    setSubsHidden(hidden);
    try { localStorage.setItem('roster-hide-subs', String(hidden)); } catch { /* ignore */ }
  }, []);
  // Lock drag-and-drop by default to prevent accidental card moves
  const [dndLocked, setDndLocked] = useState<boolean>(() => {
    try { return localStorage.getItem('roster-dnd-locked') !== 'false'; } catch { return true; }
  });
  const toggleDndLocked = useCallback(() => {
    setDndLocked((prev) => {
      const next = !prev;
      try { localStorage.setItem('roster-dnd-locked', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Re-clicking the "Expanded" view control while already in Expanded view
  // toggles all roster sections (collapse all if every section is expanded,
  // otherwise expand all). viewMode alone can't signal a repeat click, so we
  // pair it with a counter the PlayerGrid watches. The first click (from
  // Compact) just switches to Expanded — the PlayerGrid's view-mode reset
  // already expands everything — so we only bump on a genuine re-click.
  const [expandAllSignal, setExpandAllSignal] = useState(0);
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    const reclickedExpanded = mode === 'expanded' && viewMode === 'expanded';
    setViewMode(mode);
    if (reclickedExpanded) setExpandAllSignal((n) => n + 1);
  }, [setViewMode, viewMode]);

  // DnD hook - disabled on mobile (touch DnD is awkward), and when locked
  const dnd = useDragAndDrop({
    players: sortedPlayers,
    groupView,
    canEdit,
    disabled: isAnyModalOpen || !rosterPermission.allowed || isSmallScreen || dndLocked,
    onReorder: playerActions.handleReorder,
  });

  // Clipboard handlers for PlayerGrid
  const handleCopyPlayer = useCallback((player: SnapshotPlayer) => {
    setClipboardPlayer(player);
  }, [setClipboardPlayer]);

  const handlePastePlayer = useCallback((playerId: string, sourcePlayer: SnapshotPlayer) => {
    playerActions.handleUpdatePlayer(playerId, {
      job: sourcePlayer.job,
      role: sourcePlayer.role,
      gear: sourcePlayer.gear,
      tomeWeapon: sourcePlayer.tomeWeapon,
      isSubstitute: sourcePlayer.isSubstitute,
      notes: sourcePlayer.notes,
      bisLink: sourcePlayer.bisLink,
    });
  }, [playerActions]);

  const handleCopyUrl = useCallback((playerId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'roster');
    url.searchParams.set('player', playerId);
    navigator.clipboard.writeText(url.toString());
    toast.success('Link copied to clipboard');
  }, []);

  // Memoize the entire DnD roster subtree. This GroupViewContent instance re-renders
  // for many reasons, but the chrome (settings panel, tier/add-player modals) lives
  // OUTSIDE this component, so those toggles can't even re-render it. Because the player
  // cards consume @dnd-kit context, a re-render of the <DndContext> pushes new context
  // to every card and bypasses PlayerGrid's memo — a ~573ms reconciliation of ~3,000
  // nodes with zero DOM change. Holding the element stable (every dep below is
  // referentially stable across an unrelated re-render, and it still recomputes during
  // an actual drag because `dnd` changes) lets React skip the whole subtree when nothing
  // relevant changed.
  const rosterDndArea = useMemo(() => {
    if (!currentGroup || !currentTier) return null;
    return (
      <DndContext
        sensors={dnd.sensors}
        collisionDetection={pointerWithin}
        onDragStart={dnd.handleDragStart}
        onDragOver={dnd.handleDragOver}
        onDragEnd={dnd.handleDragEnd}
        onDragCancel={dnd.handleDragCancel}
      >
        <PlayerGrid
          players={sortedPlayers}
          groupedPlayers={groupedPlayers}
          groupView={groupView}
          subsView={subsView}
          subsHidden={subsHidden}
          expandAllSignal={expandAllSignal}
          viewMode={viewMode}
          contentType={currentTier.contentType ?? 'savage'}
          editingPlayerId={editingPlayerId}
          clipboardPlayer={clipboardPlayer}
          highlightedPlayerId={highlightedPlayerId}
          highlightedSlot={highlightedSlot}
          canEdit={canEdit}
          effectiveUserId={effectiveUserId}
          userRole={userRole}
          userHasClaimedPlayer={userHasClaimedPlayer}
          isAdminAccess={isAdminAccess}
          isAdmin={isAdmin}
          viewAsUserId={viewAsUser?.userId}
          hideSetupBanners={currentGroup.settings?.hideSetupBanners}
          hideBisBanners={currentGroup.settings?.hideBisBanners}
          groupId={currentGroup.id}
          tierId={currentTier.tierId}
          playerSlotsWithLootEntries={playerSlotsWithLootEntries}
          playerSlotsWithMaterialEntries={playerSlotsWithMaterialEntries}
          onUpdatePlayer={playerActions.handleUpdatePlayer}
          onRemovePlayer={playerActions.handleRemovePlayer}
          onConfigurePlayer={playerActions.handleConfigurePlayer}
          onDuplicatePlayer={playerActions.handleDuplicatePlayer}
          onResetGear={playerActions.handleResetGear}
          onClaimPlayer={playerActions.handleClaimPlayer}
          onReleasePlayer={playerActions.handleReleasePlayer}
          onAdminAssignPlayer={playerActions.handleAdminAssignPlayer}
          onOwnerAssignPlayer={playerActions.handleOwnerAssignPlayer}
          onCopyPlayer={handleCopyPlayer}
          onPastePlayer={handlePastePlayer}
          onCopyUrl={handleCopyUrl}
          onNavigateToLootEntry={handleNavigateToLootEntry}
          onNavigateToMaterialEntry={handleNavigateToMaterialEntry}
          onNavigateToBooksPanel={handleNavigateToBooksPanel}
          onModalOpen={handlePlayerModalOpen}
          onModalClose={handlePlayerModalClose}
          onEditPlayer={setEditingPlayerId}
          onCancelEdit={handleCancelEdit}
        />

        {/* Drag overlay ghost — its own component, subscribes to the drag store's
            activeId so it updates without re-rendering this memoized element. */}
        <RosterDragOverlay
          players={sortedPlayers}
          viewMode={viewMode}
          contentType={currentTier.contentType ?? 'savage'}
          groupId={currentGroup.id}
          tierId={currentTier.tierId}
        />
      </DndContext>
    );
  }, [
    dnd, sortedPlayers, groupedPlayers, groupView, subsView, subsHidden,
    expandAllSignal, viewMode, currentTier, editingPlayerId, clipboardPlayer,
    highlightedPlayerId, highlightedSlot, canEdit, effectiveUserId, userRole,
    userHasClaimedPlayer, isAdminAccess, isAdmin, viewAsUser?.userId, currentGroup,
    playerSlotsWithLootEntries, playerSlotsWithMaterialEntries, playerActions,
    handleCopyPlayer, handlePastePlayer, handleCopyUrl, handleNavigateToLootEntry,
    handleNavigateToMaterialEntry, handleNavigateToBooksPanel, handlePlayerModalOpen,
    handlePlayerModalClose, setEditingPlayerId, handleCancelEdit,
  ]);

  // GroupViewContent only renders inside an existing-tier shell; this guard satisfies
  // the type narrowing and never fires in practice (the chrome gates on currentTier).
  if (!currentGroup || !currentTier) return null;

  // Prevent page scroll for Gear/History sub-tab (internal scroll only)
  // On mobile: also prevent for Gear Priority sub-tab
  // Gated on `!slots?.gear` so a v2 gear slot (which owns its own scroll) isn't
  // forced into the legacy internal-scroll layout; no-op on legacy (`slots`
  // undefined → `!slots?.gear === true`).
  const preventPageScroll = !slots?.gear && ((pageMode === 'gear' && gearSubTab === 'history') ||
    (isSmallScreen && pageMode === 'gear' && gearSubTab === 'priority'));

  return (
    <>
      <div
        className={`flex-1 min-w-0 px-3 sm:px-6 ${preventPageScroll ? 'overflow-hidden flex flex-col' : 'overflow-y-auto pb-6 scrollbar-gutter-stable'}`}
        style={{ backgroundImage: 'radial-gradient(ellipse 70% 45% at 15% 0%, rgba(20,184,166,0.055) 0%, transparent 65%), radial-gradient(ellipse 35% 25% at 90% 95%, rgba(20,184,166,0.022) 0%, transparent 50%)' }}
        {...(isSmallScreen ? contentSwipeHandlers : {})}
      >

        {/* Roster toolbar — sticky so the sub-tabs and member controls stay
            reachable while scrolling. The sub-tabs are the primary roster nav
            and are always shown; the member-only controls render only on the
            Members sub-tab (they don't apply to Characters / Split Planner).
            Gated on `!slots?.roster` so a v2 roster slot (which owns its own
            toolbar) doesn't stack under this legacy chrome; no-op on legacy
            (`slots` undefined). */}
        {pageMode === 'roster' && !slots?.roster && (
          <div className="sticky top-0 z-20 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-3 pb-2.5 mb-3 bg-surface-base border-b border-border-default shadow-[0_6px_16px_-8px_rgba(0,0,0,0.65)] flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* Sub-tabs — always visible (mobile + desktop) */}
              <div className="overflow-x-auto flex-shrink-0">
                <div className="flex gap-0.5 p-1 bg-surface-raised rounded-lg border border-border-default w-fit" role="tablist" aria-label="Roster view" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
                  {ROSTER_SUB_VIEWS.map(view => {
                    const labels: Record<typeof view, string> = {
                      members: 'Members',
                      characters: 'Characters',
                      'split-planner': 'Split Planner',
                    };
                    return (
                      <button
                        key={view}
                        type="button"
                        role="tab"
                        aria-selected={rosterSubView === view}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          rosterSubView === view
                            ? 'bg-accent/[0.18] text-accent shadow-sm'
                            : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]'
                        }`}
                        onClick={() => setRosterSubView(view)}
                      >
                        {labels[view]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Member controls — desktop only, Members sub-tab only */}
              {rosterSubView === 'members' && (
              <div className="hidden sm:flex items-center gap-3 flex-1 min-w-0">
              {canEdit && (
                <Tooltip
                  content={
                    <div>
                      <div className="font-medium">Add Player</div>
                      <div className="text-text-muted text-xs mt-1">
                        <kbd className="px-1.5 py-0.5 bg-surface-base rounded text-[10px]">Alt+Shift+P</kbd>
                      </div>
                    </div>
                  }
                >
                  <Button
                    size="md"
                    onClick={() => actions.onAddPlayer()}
                    disabled={isSaving}
                  >
                    + Add Player
                  </Button>
                </Tooltip>
              )}
              {canEdit && <div className="h-6 border-l border-border-subtle" />}
              <SortModeSelector
                sortPreset={sortPreset}
                onPresetChange={setSortPresetWithTier}
              />
              {canEdit && (
                <Tooltip
                  content={
                    <div className="flex items-start gap-2">
                      {dndLocked
                        ? <Lock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                        : <Unlock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />}
                      <div>
                        <div className="font-medium">
                          {dndLocked ? 'Card order locked' : 'Card order unlocked'}
                        </div>
                        <div className="text-text-secondary text-xs mt-0.5">
                          {dndLocked
                            ? 'Click to allow dragging players to reorder/swap.'
                            : 'Cards can be dragged. Click to lock and prevent accidental moves.'}
                        </div>
                      </div>
                    </div>
                  }
                >
                  {/* design-system-ignore: toggle button requires specific styling */}
                  <button
                    type="button"
                    onClick={toggleDndLocked}
                    aria-pressed={dndLocked}
                    aria-label={dndLocked ? 'Unlock card reordering' : 'Lock card reordering'}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                      dndLocked
                        ? 'bg-accent/20 text-accent border-accent/50'
                        : 'bg-surface-raised border-border-default text-text-secondary hover:text-text-primary hover:border-accent'
                    }`}
                  >
                    {dndLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    <span>{dndLocked ? 'Locked' : 'Unlocked'}</span>
                  </button>
                </Tooltip>
              )}
              <div className="flex-1" />
              {hasSubstitutes && (
                <Checkbox
                  checked={!subsHidden}
                  onChange={(checked) => setSubsHiddenPersist(!checked)}
                  label="Show Subs"
                  aria-label="Show or hide the substitutes section"
                  className="min-h-0 whitespace-nowrap"
                />
              )}
              {hasSubstitutes && (
                <Tooltip
                  content={
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          Separate Substitutes
                          <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">S</kbd>
                        </div>
                        <div className="text-text-secondary text-xs mt-0.5">
                          {subsView
                            ? 'On — subs shown in their own section. Click to merge them into the main roster.'
                            : 'Off — subs merged into the main roster. Click to separate them.'}
                        </div>
                      </div>
                    </div>
                  }
                >
                  {/* design-system-ignore: Toggle button requires specific toggle styling */}
                  <button
                    type="button"
                    onClick={() => setSubsView(!subsView)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                      subsView
                        ? 'bg-accent/20 text-accent border-accent/50'
                        : 'bg-surface-raised border-border-default text-text-secondary hover:text-text-primary hover:border-accent'
                    }`}
                    aria-label={subsView ? 'Show substitutes with main roster' : 'Separate substitute players into their own section'}
                    aria-pressed={subsView}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span>Separate Subs</span>
                  </button>
                </Tooltip>
              )}
              <GroupViewToggle
                enabled={groupView}
                onToggle={(enabled) => setGroupView(enabled, currentGroup?.id)}
                disabled={!hasPositionData}
              />
              <ViewModeToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />
              </div>
              )}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
        <motion.div
          key={pageMode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
          className={[
            preventPageScroll ? 'flex flex-col flex-1 min-h-0' : '',
            // Roster has its own sticky toolbar that carries the top
            // spacing; every other page (Gear included) needs it here
            // since the scroll container no longer provides pt-3.
            pageMode !== 'roster' ? 'pt-3' : '',
          ].filter(Boolean).join(' ') || undefined}
        >

        {/* Overview Tab */}
        {pageMode === 'overview' && (slots?.overview ?? (
          <>
            <PageHeader icon={<LayoutDashboard size={14} className="text-accent" />} title="Overview" subtitle="Command center for your static." />
            {currentGroup && (
              <StaticHomeTab
                group={currentGroup}
                tier={currentTier}
                onNavigate={(tab, subTab) =>
                  setPageMode(tab, tab === 'goals' && subTab ? { goal: subTab } : undefined)
                }
                canManage={canManageRoster(userRole).allowed}
                onOpenRequests={() => {
                  useSettingsPanelStore.getState().open({ tab: 'recruitment', section: 'requests' });
                }}
                onScheduleFarm={(trial) => {
                  const mountFarmData = useMountFarmStore.getState().data;
                  const trialData = mountFarmData?.trials.find(t => t.trialId === trial.id);
                  const missing = trialData?.membersMissing ?? 0;
                  const canBuy = trialData?.membersCanBuy ?? 0;
                  const wanting = trialData?.membersWanting ?? 0;
                  setPageMode('schedule');
                  setTimeout(() => {
                    eventBus.emit(Events.MOUNT_FARM_SCHEDULE, {
                      trialId: trial.id,
                      trialName: trial.dutyName,
                      contentType: trial.contentType,
                      category: trial.contentType === 'ultimate' ? 'ultimate' : 'farm',
                      missing,
                      canBuy,
                      wanting,
                    });
                  }, 100);
                }}
              />
            )}
          </>
        ))}

        {/* Roster Tab — the Members | Characters | Split Planner sub-tabs
            live in the sticky toolbar above, not here. */}
        {pageMode === 'roster' && (slots?.roster ?? (
          <>
            <PageHeader icon={<Users size={14} className="text-accent" />} title="Roster" subtitle="Manage members, roles, and characters." />
            {currentTier.players && (
              <>
                {/* Characters tab */}
                {currentGroup && (
                  <div className={rosterSubView !== 'characters' ? 'hidden' : ''}>
                    <RosterCharacterPanel
                      groupId={currentGroup.id}
                      players={mainRosterPlayers}
                      canEdit={canEdit}
                    />
                  </div>
                )}

                {/* Split Clear Composer — kept mounted to preserve draft state */}
                {currentGroup && (
                  <div className={rosterSubView !== 'split-planner' ? 'hidden' : ''}>
                    <SplitClearPlanner
                      groupId={currentGroup.id}
                      players={mainRosterPlayers}
                      canEdit={canEdit}
                    />
                  </div>
                )}

                {/* Normal roster — hidden when Characters or Split Planner tab is active */}
                <div className={rosterSubView !== 'members' ? 'hidden' : ''}>
                  {rosterDndArea}
                </div>{/* end roster hide wrapper */}
              </>
            )}
          </>
        ))}

        {/* Gear Tab */}
        {pageMode === 'gear' && (slots?.gear ?? (
          <>
            <PageHeader icon={<Shield size={14} className="text-accent" />} title="Loot Log" subtitle="Jobs, BiS, and sync health." />
            {/* Sub-tab bar — sits below the page title, matching the
                title-then-subtabs order used on every other tab. */}
            <div className="overflow-x-auto mb-4 flex-shrink-0">
              <div className="flex gap-0.5 p-1 bg-surface-raised rounded-lg border border-border-default w-fit" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
                {([
                  { id: 'history' as GearSubTab, label: 'Log' },
                  { id: 'priority' as GearSubTab, label: 'Priority' },
                  { id: 'sync' as GearSubTab, label: 'Sync' },
                  { id: 'stats' as GearSubTab, label: 'Summary' },
                ]).map(t => (
                  /* design-system-ignore: sub-tab inline buttons */
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setGearSubTab(t.id)}
                    className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                      gearSubTab === t.id
                        ? 'bg-accent/[0.18] text-accent shadow-sm'
                        : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sync dashboard sub-tab */}
            {gearSubTab === 'sync' && (
              <GearSyncDashboard
                players={mainRosterPlayers}
                onViewStats={() => setGearSubTab('stats')}
              />
            )}

            {/* BiS / Priority sub-tab */}
            {gearSubTab === 'priority' && tierInfo && mainRosterPlayers.length > 0 && (
              <LootPriorityPanel
                players={mainRosterPlayers}
                settings={{
                  ...DEFAULT_SETTINGS,
                  ...currentGroup?.settings,
                }}
                selectedFloor={selectedFloor}
                floorName={tierInfo.floors[selectedFloor - 1]}
                floors={tierInfo.floors}
                dutyNames={tierInfo.dutyNames}
                onFloorChange={setSelectedFloor}
                showLogButtons={canEdit}
                groupId={currentGroup?.id}
                tierId={currentTier?.tierId}
                currentWeek={storeCurrentWeek}
                maxWeek={storeMaxWeek}
                lootLog={lootLog}
                materialLog={materialLog}
                showEnhancedScores={true}
                activeSubTab={lootSubTab}
                onSubTabChange={setLootSubTab}
                onLogSuccess={() => {
                  if (currentGroup?.id && currentTier?.tierId) {
                    fetchTier(currentGroup.id, currentTier.tierId);
                  }
                }}
              />
            )}

            {/* Loot Log sub-tab */}
            {gearSubTab === 'history' && currentTier?.players && tierInfo && (
              <div className={preventPageScroll ? 'flex-1 min-h-0 flex flex-col w-full' : ''}>
                <HistoryView
                  groupId={currentGroup!.id}
                  tierId={currentTier.tierId}
                  players={currentTier.players}
                  floors={tierInfo.floors}
                  userRole={userRole || 'viewer'}
                  isAdmin={isAdminAccess}
                  currentUserId={effectiveUserId}
                  highlightedBookPlayerId={highlightedBookPlayerId}
                  onNavigateToPlayer={handleNavigateToPlayer}
                  highlightedEntryId={highlightedEntry?.id}
                  highlightedEntryType={highlightedEntry?.type}
                  targetWeek={wizardTargetWeek ?? highlightedEntry?.week}
                  openLogLootModal={showLogLootModal}
                  onLogLootModalClose={() => setShowLogLootModal(false)}
                  openLogMaterialModal={showLogMaterialModal}
                  onLogMaterialModalClose={() => setShowLogMaterialModal(false)}
                  openMarkFloorClearedModal={showMarkFloorClearedModal}
                  onMarkFloorClearedModalClose={() => setShowMarkFloorClearedModal(false)}
                  onLogWeek={(week) => { setLogWeekWizardFloor(null); setLogWeekWizardWeek(week); setShowLogWeekWizard(true); }}
                  onLogFloor={(floor) => { setLogWeekWizardFloor(floor); setShowLogWeekWizard(true); }}
                />
              </div>
            )}

            {/* Summary sub-tab */}
            {gearSubTab === 'stats' && tierInfo && mainRosterPlayers.length > 0 && (
              <TeamSummaryEnhanced
                groupId={currentGroup!.id}
                tierId={currentTier.tierId}
                players={mainRosterPlayers}
                tierInfo={tierInfo}
              />
            )}
          </>
        ))}

        {/* Schedule Tab */}
        {pageMode === 'schedule' && (slots?.schedule ?? (
          <>
            <PageHeader icon={<Calendar size={14} className="text-accent" />} title="Schedule" subtitle="Plan sessions and manage recurring events." />
            {currentGroup && (
              <>
                {/* Upcoming | Calendar view switcher */}
                <div className="overflow-x-auto mb-5 flex-shrink-0">
                  <div className="flex gap-1 p-1 bg-surface-raised rounded-lg w-fit border border-border-subtle">
                    {([
                      { id: 'upcoming' as const, label: 'Upcoming' },
                      { id: 'calendar' as const, label: 'Calendar' },
                    ]).map(v => (
                      /* design-system-ignore: view switcher inline button */
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => setScheduleView(v.id)}
                        className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                          scheduleView === v.id
                            ? 'bg-accent/20 text-accent'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {scheduleView === 'upcoming' && (
                  <ScheduleUpcomingPanel
                    groupId={currentGroup.id}
                    canManage={canManageRoster(userRole).allowed}
                    onSwitchToCalendar={() => setScheduleView('calendar')}
                    onOpenPlugin={() => setPageMode('plugin')}
                  />
                )}

                {scheduleView === 'calendar' && (
                  <ScheduleTab
                    groupId={currentGroup.id}
                    staticName={currentGroup.name}
                    shareCode={currentGroup.shareCode}
                    members={currentGroup.members || []}
                    userRole={userRole}
                  />
                )}
              </>
            )}
          </>
        ))}

        {/* Goals & Farms Tab */}
        {pageMode === 'goals' && (
          <>
            <PageHeader icon={<Trophy size={14} className="text-accent" />} title="Tracking" subtitle="Track objectives, farms, and weekly goals." />
            {currentGroup && (
              <GoalsPage
                groupId={currentGroup.id}
                currentUserId={effectiveUserId ?? ''}
                canManage={canManageRoster(userRole).allowed}
              />
            )}
          </>
        )}

        {/* More Tab */}
        {pageMode === 'more' && (
          <>
            <PageHeader icon={<MoreHorizontal size={14} className="text-accent" />} title="More" subtitle="Lead tools, requests, and settings." />
            {currentGroup && (
              <MorePage
                onOpenSettings={(tab) => {
                  useSettingsPanelStore.getState().open({ tab: (tab as SettingsTab) ?? 'general' });
                }}
                onNavigate={setPageMode}
                onSetGearSubTab={setGearSubTab}
                onOpenSplitPlanner={() => {
                  // One history entry: switch to Roster and the Split Planner sub-tab together.
                  setPageMode('roster', { rsub: 'split-planner' });
                }}
                onOpenIntegrations={() => {
                  // One history entry: Schedule tab → Calendar view → Integrations sub-tab.
                  setPageMode('schedule', { sched: 'calendar', stab: 'integrations' });
                }}
                onOpenPlugin={() => setPageMode('plugin')}
                canManage={canManageRoster(userRole).allowed}
                userRole={userRole ?? null}
              />
            )}
          </>
        )}

        {/* Plugin Tab */}
        {pageMode === 'plugin' && (
          <>
            <PageHeader icon={<PlugZap size={14} className="text-accent" />} title="Plugin" subtitle="Sync gear and character data from FFXIV." />
            {currentGroup && <PluginPage />}
          </>
        )}

        </motion.div>
        </AnimatePresence>
      </div>{/* end content area */}

      {/* Mobile Floating View Toggle (Roster tab) */}
      <RosterViewToggle
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        visible={isSmallScreen && pageMode === 'roster' && !!currentTier && !slots?.roster}
      />

      {/* Mobile bottom navigation */}
      {currentTier && (
        <MobileBottomNav
          activeTab={pageMode}
          onTabChange={setPageMode}
          onControlsClick={() => setShowControlsSheet(true)}
        />
      )}

      {/* Mobile Controls Sheet - tab-aware */}
      <Modal
        isOpen={showControlsSheet}
        onClose={() => setShowControlsSheet(false)}
        title={
          pageMode === 'roster' ? 'Roster Controls' :
          pageMode === 'gear' ? 'Gear Controls' :
          'Controls'
        }
        variant="sheet"
      >
        <div className="space-y-4">
          {/* Tier Selector - shown for all tabs */}
          {tiers.length > 0 && (
            <div>
              <div className="text-sm text-text-muted mb-2">Raid Tier</div>
              <TierSelector
                tiers={tiers}
                currentTierId={currentTier?.tierId}
                onTierChange={(tierId) => {
                  actions.onTierChange(tierId);
                  setShowControlsSheet(false);
                }}
              />
            </div>
          )}

          {/* Roster Tab Controls */}
          {pageMode === 'roster' && !slots?.roster && (
            <>
              {/* Sort */}
              <div>
                <div className="text-sm text-text-muted mb-2">Sort By</div>
                <SortModeSelector
                  sortPreset={sortPreset}
                  onPresetChange={(preset) => {
                    setSortPresetWithTier(preset);
                  }}
                />
              </div>

              {/* Group View */}
              <div>
                <div className="text-sm text-text-muted mb-2">Group View</div>
                <GroupViewToggle
                  enabled={groupView}
                  onToggle={(enabled) => setGroupView(enabled, currentGroup?.id)}
                  disabled={!hasPositionData}
                  fullWidth
                />
              </div>

              {/* Subs Toggle */}
              {hasSubstitutes && (
                <div>
                  <div className="text-sm text-text-muted mb-2">Substitutes</div>
                  {/* design-system-ignore: Toggle button requires specific toggle styling */}
                  <button
                    type="button"
                    onClick={() => {
                      setSubsView(!subsView);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      subsView
                        ? 'bg-accent/20 text-accent border-accent/50'
                        : 'bg-surface-raised border-border-default text-text-secondary'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span>{subsView ? 'Show Subs Separately' : 'Show Subs with Roster'}</span>
                  </button>
                </div>
              )}

              {/* View Mode - hidden on mobile (floating toggle used instead) */}
              <div className="hidden md:block">
                <div className="text-sm text-text-muted mb-2">View Mode</div>
                <ViewModeToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />
              </div>
            </>
          )}

          {/* Gear Tab Controls */}
          {/* Gated on `!slots?.gear` so a v2 gear slot (which owns its own
              controls) doesn't stack the legacy gear view selector; no-op on
              legacy (`slots` undefined). */}
          {pageMode === 'gear' && !slots?.gear && (
            <>
              {/* Sub-tab selector */}
              <div>
                <div className="text-sm text-text-muted mb-2">View</div>
                <div className="flex flex-col gap-2">
                  {/* design-system-ignore: Sub-tab toggle buttons with specific styling */}
                  <button
                    type="button"
                    onClick={() => {
                      setLootSubTab('matrix');
                      setShowControlsSheet(false);
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      lootSubTab === 'matrix'
                        ? 'bg-accent/20 text-accent border-accent/50'
                        : 'bg-surface-raised border-border-default text-text-secondary'
                    }`}
                  >
                    Who Needs It
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLootSubTab('gear');
                      setShowControlsSheet(false);
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      lootSubTab === 'gear'
                        ? 'bg-accent/20 text-accent border-accent/50'
                        : 'bg-surface-raised border-border-default text-text-secondary'
                    }`}
                  >
                    Gear Priority
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLootSubTab('weapon');
                      setShowControlsSheet(false);
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      lootSubTab === 'weapon'
                        ? 'bg-accent/20 text-accent border-accent/50'
                        : 'bg-surface-raised border-border-default text-text-secondary'
                    }`}
                  >
                    Weapon Priority
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Gear/Log Tab Controls */}
          {/* Gated on `!slots?.gear` so a v2 gear slot (which owns its own reset
              actions) doesn't stack the legacy reset controls; no-op on legacy
              (`slots` undefined). */}
          {pageMode === 'gear' && !slots?.gear && gearSubTab === 'history' && canManageRoster(userRole, isAdminAccess).allowed && (
            <>
              {/* Reset Data Actions */}
              <div>
                <div className="text-sm text-text-muted mb-2">Reset Data</div>
                <div className="flex flex-col gap-2">
                  {/* design-system-ignore: Danger action buttons require specific styling */}
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('log:reset-loot'));
                      setShowControlsSheet(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border bg-surface-raised border-border-default text-text-secondary hover:border-status-error/50 hover:text-status-error"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Reset Loot Log
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('log:reset-books'));
                      setShowControlsSheet(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border bg-surface-raised border-border-default text-text-secondary hover:border-status-error/50 hover:text-status-error"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Reset Book Balances
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('log:reset-all'));
                      setShowControlsSheet(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border bg-status-error/10 border-status-error/40 text-status-error hover:bg-status-error/20 hover:border-status-error/60"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Reset All Data
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Log Week Wizard */}
      {currentGroup && currentTier && tierInfo && (
        <LogWeekWizard
          isOpen={showLogWeekWizard}
          onClose={() => { setShowLogWeekWizard(false); setLogWeekWizardFloor(null); setLogWeekWizardWeek(null); }}
          groupId={currentGroup.id}
          tierId={currentTier.tierId}
          players={mainRosterPlayers}
          settings={{
            ...DEFAULT_SETTINGS,
            ...currentGroup.settings,
          }}
          floors={tierInfo.floors}
          currentWeek={logWeekWizardWeek ?? storeCurrentWeek}
          maxWeek={storeMaxWeek}
          lootLog={lootLog}
          materialLog={materialLog}
          singleFloorMode={logWeekWizardFloor !== null}
          initialFloor={logWeekWizardFloor ?? 1}
          onSuccess={(loggedWeek) => {
            if (currentGroup?.id && currentTier?.tierId) {
              fetchTier(currentGroup.id, currentTier.tierId);
            }
            // Navigate the Loot Log week selector to the logged week
            setWizardTargetWeek(loggedWeek);
          }}
        />
      )}
    </>
  );
}
