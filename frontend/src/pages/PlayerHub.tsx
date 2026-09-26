/**
 * PlayerHub — the V2 Player Hub (`/profile` under V2 chrome; Stage 3, PH1).
 *
 * Rendered only by `Profile`'s V2 seam, which keeps every data effect and hosts
 * the character/job/BiS modals; this page owns the identity header, the five
 * tabs (with the legacy `?tab=` map from `hubTabs.ts`) and the tab bodies.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs } from '../components/ui/Tabs';
import { HubIdentityHeader } from '../components/profile/hub/HubIdentityHeader';
import { HUB_TABS, hubTabForId, hubTabParams, resolveHubTab, type HubTab } from '../components/profile/hub/hubTabs';
import { HubOverview } from '../components/profile/hub/HubOverview';
import { SuggestedFarmsCard } from '../components/profile/hub/SuggestedFarmsCard';
import { SetupWizard } from '../components/wizard';
import { SyncCenterTab } from '../components/profile/SyncCenterTab';
import { JobsGearTab } from '../components/profile/JobsGearTab';
import { GoalsTab } from '../components/profile/GoalsTab';
import { CollectionsCenterTab } from '../components/profile/CollectionsCenterTab';
import { PlayerAvailabilityTab } from '../components/profile/PlayerAvailabilityTab';
import { PreviewShareTab } from '../components/profile/PreviewShareTab';
import { useUrlTabState } from '../hooks/useUrlTabState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { prefRememberTabs } from '../lib/navPreferences';
import { useAuthStore } from '../stores/authStore';
import type {
  CollectionSuggestion,
  GearSnapshot,
  PlayerGoal,
  PlayerJobProfile,
  PlayerProfile,
  StaticSuggestion,
} from '../stores/playerProfileStore';
import type { StaticGroupListItem } from '../types';

interface PlayerHubProps {
  profile: PlayerProfile | null;
  goals: PlayerGoal[];
  gearSnapshots: Record<string, GearSnapshot[]>;
  collectionSuggestions: CollectionSuggestion[];
  staticSuggestions: StaticSuggestion[];
  groups: StaticGroupListItem[];
  onOpenLinkModal: () => void;
  onAddJob: () => void;
  onEditJob: (jobProfile: PlayerJobProfile) => void;
  onManageBiS: (target: { id: string; job: string }) => void;
}

const COLL_VIEWS = ['priorities', 'browse'] as const;
type CollView = (typeof COLL_VIEWS)[number];
const COLL_TABS: Array<{ id: CollView; label: string }> = [
  { id: 'priorities', label: 'My Priorities' },
  { id: 'browse', label: 'Browse Catalog' },
];
const COLL_DESCRIPTIONS: Record<CollView, string> = {
  priorities: "Mounts, music, weapons, and other rewards you're hunting or farming. Mark visibility to share with your statics.",
  browse: "Browse the full rewards catalog to discover what's available and set your intent on new items.",
};

/** Body `onNavigate` ids that name a section of the Characters & gear tab. */
const SECTION_FOR_ID: Record<string, 'sync' | 'jobs'> = {
  sync: 'sync',
  'jobs-gear': 'jobs',
  jobs: 'jobs',
  gear: 'jobs',
};

export function PlayerHub({
  profile,
  goals,
  gearSnapshots,
  collectionSuggestions,
  staticSuggestions,
  groups,
  onOpenLinkModal,
  onAddJob,
  onEditJob,
  onManageBiS,
}: PlayerHubProps) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tab, canonical } = resolveHubTab(searchParams);
  const search = searchParams.toString();
  const [collView, setCollView] = useUrlTabState('coll', COLL_VIEWS, 'priorities');
  const syncRef = useRef<HTMLElement>(null);
  const jobsRef = useRef<HTMLElement>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (canonical) return;
    setSearchParams((prev) => hubTabParams(prev, resolveHubTab(prev).tab, true), { replace: true });
  }, [canonical, search, setSearchParams]);

  const setTab = useCallback((next: HubTab) => {
    const remember = prefRememberTabs(useAuthStore.getState().user);
    setSearchParams((prev) => hubTabParams(prev, next, remember));
  }, [setSearchParams]);

  const handleNavigate = useCallback((id: string) => {
    const target = hubTabForId(id);
    const section = SECTION_FOR_ID[id];
    if (target === tab && section) {
      (section === 'sync' ? syncRef : jobsRef).current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setTab(target);
  }, [tab, setTab]);

  const shortcuts = useMemo(
    () => HUB_TABS.map((t, index) => ({
      key: index === 0 ? '`' : String(index),
      description: t.label,
      action: () => setTab(t.id),
    })),
    [setTab],
  );
  useKeyboardShortcuts({ shortcuts });

  const primaryStatic = groups[0] ?? null;
  const userName = user ? (user.displayName ?? user.discordUsername) : '';

  return (
    <div data-testid="player-hub" className="w-full max-w-[120rem] px-3 sm:px-6 pb-6">
      <HubIdentityHeader
        profile={profile}
        gearSnapshots={gearSnapshots}
        userName={userName}
        staticCount={groups.length}
      />
      <Tabs
        tabs={[...HUB_TABS]}
        value={tab}
        onChange={(id) => setTab(hubTabForId(id))}
        aria-label="Player Hub sections"
        className="overflow-x-auto whitespace-nowrap border-b border-border-subtle pb-2"
      />

      <div className="pt-4">
        {tab === 'overview' && (
          <HubOverview
            profile={profile}
            gearSnapshots={gearSnapshots}
            staticSuggestions={staticSuggestions}
            onOpenLinkModal={onOpenLinkModal}
            onAddJob={onAddJob}
            setTab={setTab}
            onCreateStatic={() => setWizardOpen(true)}
          />
        )}

        {tab === 'characters' && (
          <div className="flex flex-col gap-8">
            <section ref={syncRef}>
              <SyncCenterTab
                profile={profile}
                gearSnapshots={gearSnapshots}
                goals={goals}
                primaryStatic={primaryStatic}
                staticGroups={groups}
                onNavigate={handleNavigate}
                onOpenLinkModal={onOpenLinkModal}
              />
            </section>
            {profile && (
              <section ref={jobsRef} aria-labelledby="hub-jobs-heading">
                <h2 id="hub-jobs-heading" className="sr-only">Jobs</h2>
                <JobsGearTab
                  profile={profile}
                  gearSnapshots={gearSnapshots}
                  onAddJob={onAddJob}
                  onEditJob={onEditJob}
                  onOpenLinkModal={onOpenLinkModal}
                  onNavigate={handleNavigate}
                  onManageBiS={(jobProfileId) => {
                    const job = profile.jobProfiles.find((j) => j.id === jobProfileId)?.job;
                    if (job) onManageBiS({ id: jobProfileId, job });
                  }}
                />
              </section>
            )}
          </div>
        )}

        {tab === 'availability' && (
          <PlayerAvailabilityTab primaryStatic={primaryStatic} staticGroups={groups} />
        )}

        {tab === 'tracking' && (
          <div className="flex flex-col gap-8">
            {collectionSuggestions.length > 0 && (
              <SuggestedFarmsCard collectionSuggestions={collectionSuggestions} />
            )}
            <section aria-labelledby="hub-goals-heading">
              <h2 id="hub-goals-heading" className="sr-only">Goals</h2>
              <GoalsTab goals={goals} />
            </section>
            <section aria-labelledby="hub-collections-heading" className="flex flex-col gap-3">
              <h2 id="hub-collections-heading" className="font-display text-xl font-semibold text-text-primary">
                Collections
              </h2>
              <Tabs
                tabs={COLL_TABS}
                value={collView}
                onChange={(id) => setCollView(id === 'browse' ? 'browse' : 'priorities')}
                aria-label="Collections views"
              />
              <p className="text-xs leading-relaxed text-text-muted">{COLL_DESCRIPTIONS[collView]}</p>
              <CollectionsCenterTab view={collView} onViewChange={setCollView} />
            </section>
          </div>
        )}

        {tab === 'sharing' && (
          <section aria-labelledby="hub-sharing-heading">
            <h2 id="hub-sharing-heading" className="sr-only">Sharing</h2>
            {profile && <PreviewShareTab profile={profile} gearSnapshots={gearSnapshots} />}
          </section>
        )}
      </div>
      <SetupWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={(_groupId, shareCode) => {
          setWizardOpen(false);
          navigate(`/group/${shareCode}`);
        }}
      />
    </div>
  );
}
