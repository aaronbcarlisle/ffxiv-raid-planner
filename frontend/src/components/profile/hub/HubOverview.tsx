/**
 * HubOverview — Overview tab grid (R-PH1-E).
 * Grid mirrors Home after E2 (copied class string, never imported from home/).
 * Your statics spans cols 1-2; side stack is col 3.
 */

import type { GearSnapshot, CollectionSuggestion, PlayerProfile, StaticSuggestion } from '../../../stores/playerProfileStore';
import type { HubTab } from './hubTabs';
import type { StaticGroupListItem } from '../../../types';
import { YourStaticsCard } from './YourStaticsCard';
import { HubSideCards } from './HubSideCards';

interface HubOverviewProps {
  profile: PlayerProfile | null;
  gearSnapshots: Record<string, GearSnapshot[]>;
  collectionSuggestions: CollectionSuggestion[];
  staticSuggestions: StaticSuggestion[];
  groups: StaticGroupListItem[];
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
  return (
    /* R-PH1-E: same grid tracks as Home after E2 (components/home/Home.tsx:338). */
    <div
      data-testid="hub-overview"
      className="grid grid-cols-1 gap-4 min-[1181px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1fr)]"
    >
      {/* Your statics: spans cols 1-2 */}
      <div className="min-[1181px]:col-span-2 self-start">
        <YourStaticsCard
          staticSuggestions={staticSuggestions}
          onCreateStatic={onCreateStatic}
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
