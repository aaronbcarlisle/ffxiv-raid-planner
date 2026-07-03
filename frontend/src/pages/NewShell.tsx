import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CommandPalette } from '../components/layout/CommandPalette';
import { Home, Globe } from 'lucide-react';
import { GroupViewContent } from './GroupViewContent';
import { ShellContentStates } from './ShellContentStates';
import { AdminBanners } from '../components/admin/AdminBanners';
import { JoinRequestBanner } from '../components/static-group';
import { GroupActionModals, useGroupActions } from './groupActionsContext';
import { V2SettingsHost } from './V2SettingsHost';
import { Home as StaticHome } from '../components/home/Home';
import { Roster } from '../components/roster/Roster';
import { Loot } from '../components/loot/Loot';
import { Schedule } from '../components/schedule/Schedule';
import { canManageRoster } from '../utils/permissions';
import { useGroupViewState } from '../hooks/useGroupViewState';
import { useStaticPermissions } from '../hooks/useStaticPermissions';
import { useViewAsUrlSync } from '../hooks/useViewAsUrlSync';
import { useStaticNavMemory } from '../hooks/useStaticNavMemory';
import { useModal } from '../hooks/useModal';
import { useCurrentTier } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore } from '../stores/viewAsStore';
import { useSettingsPanelStore } from '../stores/settingsPanelStore';
import { buildStaticNavHref, prefRememberTabs } from '../lib/navPreferences';
import { Spine } from '../components/layout/Spine';
import { AppRail } from '../components/layout/AppRail';
import { TopBar } from '../components/layout/TopBar';
import { UserMenu } from '../components/auth';
import { NotificationCenter } from '../components/auth/NotificationCenter';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useLootTrackingStore } from '../stores/lootTrackingStore';
import { logger } from '../lib/logger';
import type { RailEntry } from '../components/layout/railTypes';

/** Derive two-letter initials from a static name. */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Renders the shared content with `actions` pulled from the GroupActions context
 *  (provided by the <GroupActionModals> wrapper below).
 *
 *  F6b: in v2 the `overview` tab is the redesigned <Home/> dashboard, injected as
 *  the `overview` slot. The legacy route passes no slots, so `GroupViewContent`
 *  still renders `StaticHomeTab` byte-for-byte. Exported for the slot-wiring test. */
export function ShellContent() {
  const gv = useGroupViewState();
  const { shareCode } = useParams<{ shareCode: string }>();
  const currentGroup = useStaticGroupStore((s) => s.currentGroup);
  const fetchGroupByShareCode = useStaticGroupStore((s) => s.fetchGroupByShareCode);
  const currentTier = useCurrentTier();
  // F6a hook: `canEdit` (owner/lead/admin-access) is the v2 "can manage" gate;
  // `userRole` is the effective role the roster slot re-checks via canManageRoster
  // (admin-aware — pass `isAdminAccess` so an admin non-manager still manages).
  const { canEdit: canManage, userRole, isAdminAccess } = useStaticPermissions();

  const overview = currentGroup ? (
    <StaticHome
      group={currentGroup}
      tier={currentTier}
      canManage={canManage}
      onNavigate={gv.setPageMode}
      onOpenRequests={() =>
        useSettingsPanelStore.getState().open({ tab: 'recruitment', section: 'requests' })
      }
    />
  ) : undefined;

  // F6c: in v2 the `roster` tab is the redesigned <Roster/> (Cards) screen,
  // injected as the `roster` slot — mirroring the `overview` slot above. The
  // legacy route passes no slots, so GroupViewContent renders its legacy roster
  // body byte-for-byte (and its roster chrome, gated in Task 3 on `!slots.roster`).
  const roster = currentGroup ? (
    <Roster
      group={currentGroup}
      tier={currentTier}
      canManage={canManageRoster(userRole, isAdminAccess).allowed}
      onNavigate={gv.setPageMode}
      onOpenRequests={() =>
        useSettingsPanelStore.getState().open({ tab: 'recruitment', section: 'requests' })
      }
    />
  ) : undefined;

  // F6d: in v2 the `gear` tab (Spine label "Loot") is the redesigned <Loot/>
  // screen, injected as the `gear` slot — mirroring `overview`/`roster` above.
  // The legacy route passes no slots, so GroupViewContent renders its legacy
  // gear body byte-for-byte (mobile gear chrome gated on `!slots?.gear`).
  const loot = currentGroup ? (
    <Loot
      group={currentGroup}
      tier={currentTier}
      canEdit={canManage}
      onNavigate={gv.setPageMode}
    />
  ) : undefined;

  // F6e: effective viewer identity for the schedule slot (Roster/Loot precedent).
  const user = useAuthStore((s) => s.user);
  const viewAsUser = useViewAsStore((s) => s.viewAsUser);
  const effectiveUserId = viewAsUser ? viewAsUser.userId : user?.id;

  // F6e: in v2 the `schedule` tab is the redesigned <Schedule/> screen, injected
  // as the `schedule` slot — mirroring overview/roster/gear above. The legacy
  // route passes no slots, so GroupViewContent renders the entire legacy
  // schedule body (switcher + ScheduleUpcomingPanel/ScheduleTab) byte-for-byte.
  const schedule = currentGroup ? (
    <Schedule
      group={currentGroup}
      tier={currentTier}
      canManage={canManage}
      currentUserId={effectiveUserId ?? null}
    />
  ) : undefined;

  // ShellContentStates renders the v2 load / error / not-found / no-tiers states
  // (legacy copy, new chrome) BEFORE the content — falling through to the
  // GroupViewContent children only on the happy path (and overlaying an error
  // Modal when a loaded group later errors). Mirrors legacy GroupView's own
  // five branches around its body. Banners are passed via the `banners` slot
  // (not as children) so they render in EVERY currentGroup-truthy branch —
  // including no-tiers — matching legacy, where they sit past all five
  // branches (GroupView.tsx:381-415) rather than only past the happy path.
  return (
    <ShellContentStates
      banners={
        <>
          {/* Admin access banner (View As banner is in Layout) — GroupView.tsx:392-401 parity. */}
          <AdminBanners
            isAdminAccess={isAdminAccess}
            onExitAdminMode={() => {
              // Refetch group to get correct permissions without admin elevation.
              if (shareCode) {
                fetchGroupByShareCode(shareCode);
              }
            }}
          />
          {/* Join request banner for non-members viewing a discoverable static.
              The banner supplies its own bottom margin only when it renders, so
              members (where it returns null) don't get phantom spacing pushing
              the content down. GroupView.tsx:403-415 parity. */}
          {currentGroup && (
            <JoinRequestBanner
              shareCode={currentGroup.shareCode}
              staticName={currentGroup.name}
              groupId={currentGroup.id}
              settings={currentGroup.settings}
              userRole={userRole}
            />
          )}
        </>
      }
    >
      <GroupViewContent
        actions={useGroupActions()}
        slots={currentGroup ? { overview, roster, gear: loot, schedule } : undefined}
      />
    </ShellContentStates>
  );
}

export function NewShell() {
  const gv = useGroupViewState();
  const { searchParams, setSearchParams } = gv;
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const palette = useModal();
  const notifications = useModal();

  const groups = useStaticGroupStore((s) => s.groups);
  const currentGroup = useStaticGroupStore((s) => s.currentGroup);
  const user = useAuthStore((s) => s.user);
  // Task 7 follow-up (FIX 3): "remember tab per static" preference for the
  // rail avatar static-switch repoint below — same accessor StaticPicker uses.
  const rememberStaticTab = useAuthStore((s) => prefRememberTabs(s.user));
  const fetchGroupByShareCode = useStaticGroupStore((s) => s.fetchGroupByShareCode);
  const fetchGroups = useStaticGroupStore((s) => s.fetchGroups);
  const clearGroupError = useStaticGroupStore((s) => s.clearError);
  const fetchTiers = useTierStore((s) => s.fetchTiers);
  const fetchTier = useTierStore((s) => s.fetchTier);
  const clearTiers = useTierStore((s) => s.clearTiers);
  const clearTierError = useTierStore((s) => s.clearError);
  const fetchCurrentWeek = useLootTrackingStore((s) => s.fetchCurrentWeek);

  // ── Cold-fetch (F6a, Task 9, gap 2) ──
  // NewShell previously relied on a warm store, so a hard reload of `/group/X`
  // rendered nothing. These three effects (clear-on-switch → fetch group →
  // fetch tiers + load the URL/localStorage/active tier) ensure a cold load
  // self-fetches. viewAs (useViewAsUrlSync) and recent-statics + static-nav
  // persistence (useStaticNavMemory) are wired into NewShell via their shared
  // hooks (Task 1, Task 7).

  // Fetch the groups list on cold v2 load so the AppRail avatars are populated.
  // Guarded: skips if groups are already loaded (warm store from prior navigation),
  // AND gated on auth — `fetchGroups()` hits the auth-required GET /api/static-groups
  // ("my statics" list), which 401s for a logged-out guest and writes into the
  // shared staticGroupStore.error, surfacing a false "Not authenticated" error
  // Modal (ShellContentStates) over an otherwise-correct read-only guest view of
  // a public static. Legacy never eagerly fetches this for anyone — its
  // Header/TopBar chrome only calls it lazily, when the static-switcher dropdown
  // opens AND the viewer is a member (StaticPicker.tsx:76). A guest has no "my
  // statics" list to fetch, so skip it entirely for them. This mirrors the
  // `fetchGroups` call the legacy GroupView chrome triggers via its own mount
  // effect; NewShell previously skipped it because it only fetched the current
  // group. (Fix 2, PR #163)
  useEffect(() => {
    if (user && groups.length === 0) {
      fetchGroups();
    }
    // Run once on mount (plus the null->authed transition via `user`) only —
    // adding `groups.length` would re-fetch on every static navigation when the
    // list clears momentarily. `user` is included so a guest who logs in while
    // on the page still gets their groups fetched; the store's `user` reference
    // is stable once set (no refetch-loop risk).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchGroups, user]);

  // Clear tiers and errors when shareCode changes (switching statics in v2).
  useEffect(() => {
    clearTiers();
    clearGroupError();
    clearTierError();
  }, [shareCode, clearTiers, clearGroupError, clearTierError]);

  // Fetch the group on mount / shareCode change.
  useEffect(() => {
    if (shareCode) {
      fetchGroupByShareCode(shareCode);
    }
  }, [shareCode, fetchGroupByShareCode]);

  // Admin "View As" URL sync (shared with GroupView — see useViewAsUrlSync). Not
  // part of the cold-fetch replication above; this is the F6a gap-2 fix so v2
  // also runs the ?viewAs= effects (previously only the legacy chrome did).
  useViewAsUrlSync(currentGroup?.id);

  // Recent-statics MRU + per-static tab memory (shared with GroupView — see
  // useStaticNavMemory). Previously only the legacy chrome ran this, so
  // v2 dropped recent-statics tracking and per-static tab restore.
  useStaticNavMemory(shareCode);

  // Fetch tiers and load a tier (from URL, localStorage, or active) sequentially.
  useEffect(() => {
    if (!currentGroup?.id) return;
    let cancelled = false;
    const log = logger.scope('TierSelection');
    (async () => {
      await fetchTiers(currentGroup.id);
      if (cancelled) return;
      const { tiers: freshTiers } = useTierStore.getState();
      if (freshTiers.length === 0) return;
      const urlTierId = searchParams.get('tier');
      const urlTier = urlTierId ? freshTiers.find(t => t.tierId === urlTierId) : null;
      const savedTierId = localStorage.getItem(`selected-tier-${currentGroup.id}`);
      const savedTier = savedTierId ? freshTiers.find(t => t.tierId === savedTierId) : null;
      const activeTier = urlTier || savedTier || freshTiers.find(t => t.isActive) || freshTiers[0];
      const selectionSource = urlTier ? 'URL' : savedTier ? 'localStorage' : freshTiers.find(t => t.isActive) ? 'isActive' : 'fallback';
      log.debug(`Selected tier: ${activeTier?.tierId} (source: ${selectionSource})`);
      if (activeTier) {
        await fetchTier(currentGroup.id, activeTier.tierId);
        // Fetch the current week so the TopBar "Week N" label is correct on cold
        // load, not stuck at the store default of Week 1. (Fix 6, PR #163)
        fetchCurrentWeek(currentGroup.id, activeTier.tierId);
        setSearchParams(prev => {
          const params = new URLSearchParams(prev);
          params.set('tier', activeTier.tierId);
          return params;
        }, { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [currentGroup?.id, fetchTiers, fetchTier, fetchCurrentWeek, searchParams, setSearchParams]);

  // ── v2-scoped mod-K binding ──────────────────────────────────────────────
  // Destructure open so the effect dep-array references the stable callback
  // directly (avoids the exhaustive-deps warning for the `palette` object).
  const openPalette = palette.open;
  useEffect(() => {
    function handleModK(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
      }
    }
    window.addEventListener('keydown', handleModK);
    return () => window.removeEventListener('keydown', handleModK);
  }, [openPalette]);

  const personLayerEntries = useMemo<RailEntry[]>(() => [
    {
      kind: 'icon',
      id: 'player-hub',
      label: 'Player Hub',
      icon: Home,
      // Player Hub is active when we're not in any static context (future F6b);
      // in F6a (always inside a static route) it is never active.
      isActive: false,
      onSelect: () => { /* F6b: navigate to /player-hub */ },
    },
    {
      kind: 'icon',
      id: 'static-finder',
      label: 'Static Finder',
      icon: Globe,
      isActive: false,
      onSelect: () => { /* F6b: navigate to /find-static */ },
    },
    { kind: 'divider', id: 'div-statics' },
    ...groups.map((g): RailEntry => ({
      kind: 'avatar',
      id: `static-${g.id}`,
      label: g.name,
      initials: getInitials(g.name),
      isActive: g.shareCode === shareCode,
      onSelect: () => {
        // SPA navigation — restores the target static's saved tab when
        // "remember tab per static" is ON (Task 7 follow-up: same
        // buildStaticNavHref repoint as StaticPicker, instead of a bare href
        // that dropped the saved tab).
        navigate(buildStaticNavHref(g.shareCode, {
          remember: rememberStaticTab,
          currentParams: searchParams,
        }));
      },
    })),
  ], [groups, shareCode, navigate, rememberStaticTab, searchParams]);

  return (
    <GroupActionModals onTierCreated={() => gv.setPageMode('roster')}>
      <div className="flex min-h-0 flex-1" data-testid="new-shell">
        <AppRail
          logo={<img src="/logo.svg" alt="FFXIV Raid Planner" className="w-8 h-8" />}
          entries={personLayerEntries}
          footer={<UserMenu variant="rail" collapsed />}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenPalette={palette.open} onOpenNotifications={notifications.open} />
          <Spine activeTab={gv.pageMode} onTabChange={gv.setPageMode} />
          <div id="main-content" className="min-h-0 flex-1 overflow-y-auto">
            <ShellContent />
          </div>
        </div>
      </div>
      <NotificationCenter isOpen={notifications.isOpen} onClose={notifications.close} />
      <CommandPalette isOpen={palette.isOpen} onClose={palette.close} />
      <V2SettingsHost />
    </GroupActionModals>
  );
}
