import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CommandPalette } from '../components/layout/CommandPalette';
import { Home, Globe } from 'lucide-react';
import { GroupViewContent } from './GroupViewContent';
import { GroupActionModals, useGroupActions } from './groupActionsContext';
import { useGroupViewState } from '../hooks/useGroupViewState';
import { useModal } from '../hooks/useModal';
import { Spine } from '../components/layout/Spine';
import { AppRail } from '../components/layout/AppRail';
import { TopBar } from '../components/layout/TopBar';
import { UserMenu } from '../components/auth';
import { NotificationCenter } from '../components/auth/NotificationCenter';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
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
 *  (provided by the <GroupActionModals> wrapper below). */
function ShellContent() {
  return <GroupViewContent actions={useGroupActions()} />;
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
  const fetchGroupByShareCode = useStaticGroupStore((s) => s.fetchGroupByShareCode);
  const clearGroupError = useStaticGroupStore((s) => s.clearError);
  const fetchTiers = useTierStore((s) => s.fetchTiers);
  const fetchTier = useTierStore((s) => s.fetchTier);
  const clearTiers = useTierStore((s) => s.clearTiers);
  const clearTierError = useTierStore((s) => s.clearError);

  // ── Cold-fetch (F6a, Task 9, gap 2) ──
  // The legacy GroupView *chrome* owns the group/tier fetch from the route
  // `shareCode`; NewShell previously relied on a warm store, so a hard reload of
  // `/group/X?shell=v2` rendered nothing. These three effects are replicated
  // verbatim from GroupView (clear-on-switch → fetch group → fetch tiers + load
  // the URL/localStorage/active tier) so a cold v2 load self-fetches. Only the
  // group-fetch is replicated; the other GroupView chrome effects (viewAs,
  // sortPreset, recent-statics, static-nav persistence) are not needed to render.

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
        setSearchParams(prev => {
          const params = new URLSearchParams(prev);
          params.set('tier', activeTier.tierId);
          return params;
        }, { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [currentGroup?.id, fetchTiers, fetchTier, searchParams, setSearchParams]);

  // ── v2-scoped mod-K binding ──────────────────────────────────────────────
  // NewShell only mounts for ?shell=v2, so this listener never fires on the
  // legacy /group/:shareCode route — it is unmounted when the legacy shell renders.
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
        // SPA navigation — preserves ?shell=v2 gate without a full page reload.
        navigate(`/group/${g.shareCode}?shell=v2`);
      },
    })),
  ], [groups, shareCode, navigate]);

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
    </GroupActionModals>
  );
}
