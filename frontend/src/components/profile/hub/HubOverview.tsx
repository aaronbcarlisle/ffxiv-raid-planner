/**
 * HubOverview — Overview tab grid (R-PH1-E).
 * Grid mirrors Home after E2 (copied class string, never imported from home/).
 * Main area (cols 1-2) stacks Needs you (R-PH2-K) then Your statics; side
 * stack is col 3.
 */

import { useMemo } from 'react';
import type { GearSnapshot, PlayerProfile, StaticSuggestion } from '../../../stores/playerProfileStore';
import { useStaticGroupStore } from '../../../stores/staticGroupStore';
import type { HubTab } from './hubTabs';
import { YourStaticsCard } from './YourStaticsCard';
import { HubSideCards } from './HubSideCards';
import { NeedsYouCard } from './NeedsYouCard';
import { usePlayerOverview } from './usePlayerOverview';
import type { OverviewStatic } from './usePlayerOverview';

interface HubOverviewProps {
  profile: PlayerProfile | null;
  gearSnapshots: Record<string, GearSnapshot[]>;
  staticSuggestions: StaticSuggestion[];
  onOpenLinkModal: () => void;
  onAddJob: () => void;
  setTab: (tab: HubTab) => void;
  onCreateStatic: () => void;
}

export function HubOverview({
  profile,
  gearSnapshots,
  staticSuggestions,
  onOpenLinkModal,
  onAddJob,
  setTab,
  onCreateStatic,
}: HubOverviewProps) {
  const groups = useStaticGroupStore((s) => s.groups);
  const { data, isLoading, error, retry } = usePlayerOverview();

  const overviewById = useMemo(() => {
    if (!data) return undefined;
    return new Map<string, OverviewStatic>(data.statics.map((s) => [s.id, s]));
  }, [data]);

  return (
    /* R-PH1-E: same grid tracks as Home after E2 (components/home/Home.tsx:338). */
    <div
      data-testid="hub-overview"
      className="grid grid-cols-1 gap-4 min-[1181px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1fr)]"
    >
      {/* Main area: spans cols 1-2 — Needs you (R-PH2-K) then Your statics */}
      <div className="min-[1181px]:col-span-2 self-start flex flex-col gap-4">
        {groups.length > 0 && (
          <NeedsYouCard data={data} isLoading={isLoading} error={error} retry={retry} />
        )}
        <YourStaticsCard
          staticSuggestions={staticSuggestions}
          onCreateStatic={onCreateStatic}
          overviewById={overviewById}
        />
      </div>
      {/* Side stack: col 3 */}
      <HubSideCards
        profile={profile}
        gearSnapshots={gearSnapshots}
        onOpenLinkModal={onOpenLinkModal}
        onAddJob={onAddJob}
        setTab={setTab}
      />
    </div>
  );
}
