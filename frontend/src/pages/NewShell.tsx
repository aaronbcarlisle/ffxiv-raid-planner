import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { CommandPalette } from '../components/layout/CommandPalette';
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
import { useShellToggle } from '../hooks/useShellToggle';
import { useModal } from '../hooks/useModal';
import { useCurrentTier } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore } from '../stores/viewAsStore';
import { useSettingsPanelStore } from '../stores/settingsPanelStore';
import { Spine } from '../components/layout/Spine';
import { TopBar } from '../components/layout/TopBar';
import { useChromeSlotNodes } from './chrome/chromeSlots';
import { useNotificationStore } from '../stores/notificationStore';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useLootTrackingStore } from '../stores/lootTrackingStore';
import { logger } from '../lib/logger';

/** Renders the shared content with `actions` pulled from the GroupActions context
 *  (provided by the <GroupActionModals> wrapper below).
 *
 *  F6b: in v2 the `overview` tab is the redesigned <Home/> dashboard, injected as
 *  the `overview` slot. Dual shell (Phase R): the legacy route renders
 *  GroupViewContent with no slots, so its restored fallback bodies serve the
 *  classic UI — v2 always passes all four slots. Exported for the slot-wiring test. */
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

  // Phase A (A5c): v2→legacy escape hatch handed to the More page. Constructed
  // ONLY here (the v2 chrome) — the legacy route renders GroupViewContent
  // without it, so MorePage's "Switch to classic UI" section is v2-exclusive.
  // On mobile this is the only reachable v2→legacy affordance (AppRail and its
  // UserMenu toggle are hidden below sm). Mirrors UserMenu's switchShell call.
  const switchShell = useShellToggle('v2-more-page');

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
  // as the `schedule` slot — mirroring overview/roster/gear above. Dual shell
  // (Phase R): the legacy route renders GroupViewContent with no slots, so the
  // restored legacy switcher + panel serve the classic UI there.
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
      {/* Slots are unconditional (flip-P3 Task 2): ShellContentStates renders
          these children only in its branch 5, where `currentGroup` is loaded
          and tiers exist — so the per-slot `currentGroup ?` builders above are
          always populated by the time GroupViewContent mounts. */}
      <GroupViewContent
        actions={useGroupActions()}
        slots={{ overview, roster, gear: loot, schedule }}
        onSwitchToClassicUi={() => switchShell('legacy')}
      />
    </ShellContentStates>
  );
}

export function NewShell() {
  const gv = useGroupViewState();
  const { searchParams, setSearchParams } = gv;
  // D5 carry-forward fix: `searchParams` (and therefore `setSearchParams`,
  // react-router 7.18's `setSearchParams` is `useCallback([navigate,
  // searchParams])`) get a NEW object identity on EVERY URL write — an
  // `lview` switch, a `?week=` mirror from useLogWeek, ANY unrelated param.
  // Depending on either object directly in the tier-selection effect below
  // (as it used to) means every such write re-runs the whole fetchTiers →
  // fetchTier → fetchCurrentWeek chain for no reason — the refetch storm D5's
  // grid multiplies. Reading just the `tier` param as a STRING here gives the
  // effect a primitive to depend on instead: Object.is-stable across any URL
  // write that doesn't touch `tier` itself.
  const urlTierId = searchParams.get('tier');
  const { shareCode } = useParams<{ shareCode: string }>();
  const palette = useModal();
  // Stage-1 req 10: the NotificationCenter is mounted ONCE, app-level, by
  // NotificationCenterHost (App.tsx) — the TopBar bell only writes the store's
  // open-state. NewShell no longer self-mounts a center.
  const openNotificationCenter = useNotificationStore((s) => s.openCenter);

  // Stage-1 T3: the chrome host (AppChrome, mounted by Layout's v2 branch)
  // owns the rail, the V2ChromeContext provider, the authed-gated cold
  // `fetchGroups()` (guest 401 guard moved verbatim — see AppChrome), and the
  // TopBar/Spine slot containers. NewShell keeps everything route-scoped and
  // renders its TopBar/Spine through portals into the published slot nodes
  // (see chromeSlots.ts for the RC1/RC2 portal rationale).
  const { topBar: topBarEl, spine: spineEl } = useChromeSlotNodes();

  const currentGroup = useStaticGroupStore((s) => s.currentGroup);
  const fetchGroupByShareCode = useStaticGroupStore((s) => s.fetchGroupByShareCode);
  const clearGroupError = useStaticGroupStore((s) => s.clearError);
  const fetchTiers = useTierStore((s) => s.fetchTiers);
  const fetchTier = useTierStore((s) => s.fetchTier);
  const clearTiers = useTierStore((s) => s.clearTiers);
  const clearTierError = useTierStore((s) => s.clearError);
  const fetchCurrentWeek = useLootTrackingStore((s) => s.fetchCurrentWeek);

  // ── Cold-fetch (F6a, Task 9, gap 2) ──
  // NewShell previously relied on a warm store, so a hard reload of `/group/X`
  // rendered nothing. These effects (clear-on-switch → fetch group →
  // fetch tiers + load the URL/localStorage/active tier) ensure a cold load
  // self-fetches. viewAs (useViewAsUrlSync) and recent-statics + static-nav
  // persistence (useStaticNavMemory) are wired into NewShell via their shared
  // hooks (Task 1, Task 7). The groups-list cold fetch for the rail avatars
  // moved to AppChrome with the rail itself (Stage-1 T3).

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

  // D5 carry-forward fix, leg 2: `setSearchParams` itself churns identity in
  // lockstep with `searchParams` (see urlTierId comment above) — it can't be
  // a dep either. Stash it in a ref, updated from its OWN effect every render
  // (effect-phase write — `react-hooks/refs` bans writing refs during render,
  // not during an effect) so the tier effect below can call the CURRENT
  // setter without depending on its identity.
  const setSearchParamsRef = useRef(setSearchParams);
  useEffect(() => { setSearchParamsRef.current = setSearchParams; });

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
        // D5 carry-forward fix, leg 3: guard the mirror. A cold mount that
        // already carries the right `?tier=` (urlTierId === activeTier.tierId)
        // has nothing to write — skipping it removes a redundant `replace`
        // history entry. Without this, a no-`?tier=` mount would still write
        // once (unavoidable — that IS the mirror), but a subsequent run
        // re-observing its own already-correct write would write again for
        // no reason.
        if (urlTierId !== activeTier.tierId) {
          setSearchParamsRef.current(prev => {
            const params = new URLSearchParams(prev);
            params.set('tier', activeTier.tierId);
            return params;
          }, { replace: true });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [currentGroup?.id, urlTierId, fetchTiers, fetchTier, fetchCurrentWeek]);

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

  return (
    // The V2ChromeContext provider moved to AppChrome (Stage-1 T3) — the
    // chrome host is the one structural v2 signal for BOTH the group route
    // and (post-T4) every other v2-chromed route.
    <GroupActionModals onTierCreated={() => gv.setPageMode('roster')}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="new-shell">
        <ShellContent />
      </div>
      {/* Stage-1 T3 portals: TopBar/Spine render into the chrome host's slot
          containers (DOM position) while staying React children of THIS tree —
          `TierBreadcrumb`'s `useGroupActions()` must resolve the
          GroupActionModals provider above (RC1), and `Spine` needs the
          route-scoped `gv.pageMode`/`setPageMode`. When no host is mounted
          (slot nodes null — e.g. unit tests rendering NewShell bare) the
          portals simply don't render; when NewShell unmounts, the portals
          unmount with it and the host's empty-placeholder styling returns. */}
      {topBarEl !== null
        ? createPortal(
            <TopBar onOpenPalette={palette.open} onOpenNotifications={openNotificationCenter} />,
            topBarEl,
          )
        : null}
      {spineEl !== null
        ? createPortal(<Spine activeTab={gv.pageMode} onTabChange={gv.setPageMode} />, spineEl)
        : null}
      <CommandPalette isOpen={palette.isOpen} onClose={palette.close} />
      <V2SettingsHost />
    </GroupActionModals>
  );
}
