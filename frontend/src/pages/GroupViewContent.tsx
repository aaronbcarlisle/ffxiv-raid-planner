/**
 * GroupViewContent
 *
 * The shared content region extracted from GroupView (F6a, Task 3). It owns the
 * content derivation — the `useGroupViewState` instance, store reads, the
 * shared cross-tab effects (`?player=` deep link, added-player highlight,
 * roster gear poll, loot-tracking store init), the keyboard-shortcut wiring,
 * and the `pageMode` tab switch — and renders, per spine tab, `slots[mode]`.
 *
 * NewShell is the sole host (flip-P3): it always passes all four slots, so the
 * legacy fallback bodies were deleted (Task 2). The slotless pageModes
 * (goals / more / plugin) render their bodies here unconditionally.
 *
 * Chrome-triggered actions (add-player, tier ops) are invoked through the `actions`
 * prop; the chrome owns those modals (shared `GroupActionModals`). This component
 * reads modal-open state and the add-player highlight signal from the GroupActions
 * context (`useGroupActionModalOpen` / `useGroupAddedPlayer`) so a chrome modal
 * still disables the content keyboard shortcuts, and a freshly added player
 * still scrolls into view + highlights — exactly as before the F6a split.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useLootTrackingStore } from '../stores/lootTrackingStore';
import { useViewAsStore } from '../stores/viewAsStore';
import { MobileBottomNav, Modal } from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { MorePage } from '../components/group/MorePage';
import { GoalsPage } from '../components/group/GoalsPage';
import { PluginPage } from '../components/group/PluginPage';
import { useDevice } from '../hooks/useDevice';
import { useSwipe } from '../hooks/useSwipe';
import { Trophy, MoreHorizontal, PlugZap } from 'lucide-react';
import { TierSelector } from '../components/static-group';
import type { SettingsTab } from '../components/settings';
import { useSettingsPanelStore } from '../stores/settingsPanelStore';
import { useGroupViewState } from '../hooks/useGroupViewState';
import { useGroupViewKeyboardShortcuts } from '../hooks/useGroupViewKeyboardShortcuts';
import { useEventBus, Events } from '../lib/eventBus';
import { useGroupActionModalOpen, useGroupAddedPlayer, useGroupClearAddedPlayer } from './groupActionsContext';
import { canManageRoster } from '../utils/permissions';
import type { PageMode } from '../types';

/** The 4 spine tabs rendered via the required `slots` (v2 screens). */
export type GroupTab = 'overview' | 'roster' | 'gear' | 'schedule';

export interface GroupActions {
  onTierChange: (tierId: string) => void;
  onAddPlayer: () => void;
  onNewTier: () => void;
  onRollover: () => void;
  onDeleteTier: () => void;
}

export interface GroupViewContentProps {
  /** The v2 screen rendered for each spine tab — required (flip-P3 Task 2). */
  slots: Record<GroupTab, React.ReactNode>;
  /** Chrome-triggered actions the content's bodies invoke (add-player, tier ops).
   *  Fed from the shared GroupActions context (`useGroupActions()`) by the chrome. */
  actions: GroupActions;
}

export function GroupViewContent({ slots, actions }: GroupViewContentProps) {
  const navigate = useNavigate();
  const { currentGroup, groups, error: groupError } = useStaticGroupStore();
  const { tiers, currentTier, error: tierError, fetchTier } = useTierStore();
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
    setEditingPlayerId,
    showKeyboardHelp,
    setShowKeyboardHelp,
    showLogLootModal,
    setShowLogLootModal,
    showLogMaterialModal,
    setShowLogMaterialModal,
    showMarkFloorClearedModal,
    setShowMarkFloorClearedModal,
    setHighlightedPlayerId,
    setHighlightedSlot,
  } = state;

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

  // Load groupView (G1/G2) from localStorage when group changes — this
  // instance's groupView still feeds the keyboard 'g' toggle direction.
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

  // Refresh tier data when member roles change (updates linkedUser.membershipRole on player cards).
  // Narrowed ids are hoisted so the callback's manual deps match its reads
  // exactly (React Compiler preserve-manual-memoization).
  const currentGroupId = currentGroup?.id;
  const currentTierId = currentTier?.tierId;
  useEventBus<{ groupId: string; userId: string; role: string }>(
    Events.MEMBER_ROLE_CHANGED,
    useCallback((data) => {
      if (currentGroupId === data.groupId && currentTierId) {
        fetchTier(currentGroupId, currentTierId);
      }
    }, [currentGroupId, currentTierId, fetchTier])
  );

  // Initialize loot tracking store when Loot or Players tab is active —
  // the v2 gear/roster slots rely on the store being warm.
  const { fetchCurrentWeek, fetchLootLog, fetchMaterialLog } = useLootTrackingStore();
  useEffect(() => {
    if ((pageMode === 'gear' || pageMode === 'roster') && currentGroup?.id && currentTier?.tierId) {
      fetchCurrentWeek(currentGroup.id, currentTier.tierId);
      fetchLootLog(currentGroup.id, currentTier.tierId);
      fetchMaterialLog(currentGroup.id, currentTier.tierId);
    }
  }, [pageMode, currentGroup?.id, currentTier?.tierId, fetchCurrentWeek, fetchLootLog, fetchMaterialLog]);

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

  // Check if any substitutes exist (feeds the keyboard 's' toggle gate; sort
  // order is irrelevant to `.some`, so this reads the tier players directly).
  const hasSubstitutes = useMemo(() => {
    return (currentTier?.players ?? []).some(p => p.isSubstitute);
  }, [currentTier?.players]);

  // Match errorStack to whichever error is being displayed
  const error = groupError || tierError;

  // Check if any modal is open (including error modal).
  // `isActionModalOpen` (from the GroupActions context) carries the chrome-owned
  // add-player + create/rollover/delete tier open-state so they still disable
  // shortcuts exactly as before the F6a split.
  const isActionModalOpen = useGroupActionModalOpen();
  const isErrorModalOpen = !!error && !!currentGroup;
  const isAnyModalOpen = isActionModalOpen ||
                          showKeyboardHelp || showLogLootModal ||
                          showLogMaterialModal || showMarkFloorClearedModal ||
                          isErrorModalOpen;

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
    setShowKeyboardHelp,
    setEditingPlayerId,
    setHighlightedPlayerId,
    setShowLogLootModal,
    setShowLogMaterialModal,
    setShowMarkFloorClearedModal,
  }, isAnyModalOpen);

  // GroupViewContent only renders inside an existing-tier shell; this guard satisfies
  // the type narrowing and never fires in practice (ShellContentStates only renders
  // its children in branch 5, where the group is loaded and tiers exist).
  if (!currentGroup || !currentTier) return null;

  return (
    <>
      <div
        className="flex-1 min-w-0 px-3 sm:px-6 overflow-y-auto pb-6 scrollbar-gutter-stable"
        style={{ backgroundImage: 'radial-gradient(ellipse 70% 45% at 15% 0%, rgba(20,184,166,0.055) 0%, transparent 65%), radial-gradient(ellipse 35% 25% at 90% 95%, rgba(20,184,166,0.022) 0%, transparent 50%)' }}
        {...(isSmallScreen ? contentSwipeHandlers : {})}
      >

        <AnimatePresence mode="wait">
        <motion.div
          key={pageMode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
          /* The v2 Roster slot carries its own top spacing; every other page
             needs it here since the scroll container no longer provides pt-3. */
          className={pageMode !== 'roster' ? 'pt-3' : undefined}
        >

        {/* Overview Tab */}
        {pageMode === 'overview' && slots.overview}

        {/* Roster Tab */}
        {pageMode === 'roster' && slots.roster}

        {/* Gear Tab */}
        {pageMode === 'gear' && slots.gear}

        {/* Schedule Tab */}
        {pageMode === 'schedule' && slots.schedule}

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
                onOpenIntegrations={() => {
                  useSettingsPanelStore.getState().open({ tab: 'integrations' });
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
        </div>
      </Modal>
    </>
  );
}
