import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Home, Globe } from 'lucide-react';
import { GroupViewContent } from './GroupViewContent';
import { useGroupViewState } from '../hooks/useGroupViewState';
import { Spine } from '../components/layout/Spine';
import { AppRail } from '../components/layout/AppRail';
import { UserMenu } from '../components/auth';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import type { RailEntry } from '../components/layout/railTypes';

/** Derive two-letter initials from a static name. */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function NewShell() {
  const gv = useGroupViewState();
  const { shareCode } = useParams<{ shareCode: string }>();
  const groups = useStaticGroupStore((s) => s.groups);

  // F6a: chrome actions can wire to NewShell-local modal state mirroring GroupView; Task 8
  // unifies these into a shared store/context so neither chrome duplicates the modal state.
  const actions = { onTierChange: () => {}, onAddPlayer: () => {}, onNewTier: () => {}, onRollover: () => {}, onDeleteTier: () => {} };

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
        // Navigate to this static with the shell gate preserved.
        window.location.href = `/group/${g.shareCode}?shell=v2`;
      },
    })),
  ], [groups, shareCode]);

  return (
    <div className="flex min-h-0 flex-1" data-testid="new-shell">
      <AppRail
        logo={<img src="/logo.svg" alt="FFXIV Raid Planner" className="w-8 h-8" />}
        entries={personLayerEntries}
        footer={<UserMenu variant="rail" collapsed />}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* placeholder top bar — Tasks 9/10 */}
        <div className="h-14 border-b border-border-default" />
        <Spine activeTab={gv.pageMode} onTabChange={gv.setPageMode} />
        <div id="main-content" className="min-h-0 flex-1 overflow-y-auto">
          <GroupViewContent actions={actions} />
        </div>
      </div>
    </div>
  );
}
