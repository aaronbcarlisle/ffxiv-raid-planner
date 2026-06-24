import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, Users } from 'lucide-react';
import { Button } from '../components/primitives/Button';
import { Badge } from '../components/primitives/Badge';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from '../components/primitives';
import { Skeleton } from '../components/ui/Skeleton';
import { CharacterLinkModal } from '../components/profile/CharacterLinkModal';
import { JobsGearTab } from '../components/profile/JobsGearTab';
import { JobProfileModal } from '../components/profile/JobProfileModal';
import { ManageBiSModal } from '../components/profile/ManageBiSModal';
import { OverviewTab } from '../components/profile/OverviewTab';
import { SyncCenterTab } from '../components/profile/SyncCenterTab';
import { CollectionsCenterTab } from '../components/profile/CollectionsCenterTab';
import { GoalsTab } from '../components/profile/GoalsTab';
import { PreviewShareTab } from '../components/profile/PreviewShareTab';
import { ProfileBottomNav } from '../components/profile/ProfileBottomNav';
import { PlayerAvailabilityTab } from '../components/profile/PlayerAvailabilityTab';
import { usePlayerProfileStore } from '../stores/playerProfileStore';
import type { PlayerJobProfile } from '../stores/playerProfileStore';
import { useSharedBisStore } from '../stores/sharedBisStore';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useAuthStore } from '../stores/authStore';
import { useDevice } from '../hooks/useDevice';
import { useModal } from '../hooks/useModal';
import { fadeInProps } from '../lib/motion';
import { GameIcon } from '../components/ui/GameIcon';
import { hasUsableGearSnapshot } from '../components/profile/jobGearUtils';
import type { MemberRole, StaticGroupListItem } from '../types';

type ProfileTab = 'overview' | 'sync' | 'jobs-gear' | 'collections' | 'availability' | 'goals' | 'preview';
const PROFILE_TAB_IDS: ProfileTab[] = ['overview', 'sync', 'jobs-gear', 'collections', 'availability', 'goals', 'preview'];
const LEGACY_TAB_REDIRECTS: Record<string, ProfileTab> = {
  share: 'preview',
  characters: 'sync',
  gear: 'jobs-gear',
  jobs: 'jobs-gear',
};

const ROLE_LABELS: Partial<Record<MemberRole, string>> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

function StaticShortcut({ groups, mobile = false }: { groups: StaticGroupListItem[]; mobile?: boolean }) {
  if (groups.length === 0) {
    return (
      <Link
        to="/discover"
        className={`${mobile ? 'flex w-full px-3 py-2' : 'inline-flex px-3 py-1.5'} items-center gap-2 rounded-lg border border-border-default bg-surface-raised text-sm text-text-secondary transition-colors hover:border-accent/30 hover:text-accent`}
      >
        <Users className="h-4 w-4 flex-shrink-0 text-accent" />
        <span>Find a static</span>
      </Link>
    );
  }

  if (groups.length === 1) {
    const group = groups[0];
    return (
      <Link
        to={`/group/${group.shareCode}`}
        className={`${mobile ? 'flex w-full px-3 py-2' : 'inline-flex px-3 py-1.5'} items-center gap-2 rounded-lg border border-border-default bg-surface-raised text-sm text-text-secondary transition-colors hover:border-accent/30 hover:text-accent`}
      >
        <Users className="h-4 w-4 flex-shrink-0 text-accent" />
        <span className="truncate">{group.name}</span>
        {group.userRole && <Badge variant="info" size="sm">{ROLE_LABELS[group.userRole] ?? group.userRole}</Badge>}
        {mobile && <span className="ml-auto flex-shrink-0 text-xs text-text-tertiary">Go to static</span>}
      </Link>
    );
  }

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={`${mobile ? 'flex w-full justify-start px-3 py-2' : 'inline-flex px-3 py-1.5'} gap-2 bg-surface-raised font-normal hover:text-accent`}
        >
          <Users className="h-4 w-4 flex-shrink-0 text-accent" />
          <span className="truncate">My Statics ({groups.length})</span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-text-tertiary" />
        </Button>
      </DropdownTrigger>
      <DropdownContent align={mobile ? 'start' : 'end'} className="w-80 max-w-[calc(100vw-2rem)]">
        {groups.map((group, index) => (
          <div key={group.id}>
            {index > 0 && <DropdownSeparator />}
            <DropdownItem href={`/group/${group.shareCode}`} icon={<Users className="h-4 w-4" />}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{group.name}</span>
                <span className="block truncate text-xs text-text-tertiary">
                  {ROLE_LABELS[group.userRole ?? 'member'] ?? group.userRole ?? 'Member'}
                </span>
              </span>
            </DropdownItem>
            <DropdownItem href={`/group/${group.shareCode}?tab=schedule`} icon={<Calendar className="h-4 w-4" />} className="pl-8 text-xs">
              Schedule
            </DropdownItem>
          </div>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}

function parseProfileTab(search: string): ProfileTab {
  const params = new URLSearchParams(search);
  const rawTab = params.get('tab');
  const tab = rawTab ? LEGACY_TAB_REDIRECTS[rawTab] ?? rawTab : rawTab;
  return tab && PROFILE_TAB_IDS.includes(tab as ProfileTab) ? tab as ProfileTab : 'overview';
}

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.authInitialized);
  const authLoading = useAuthStore((s) => s.isLoading);
  const {
    profile, goals, gearSnapshots, collectionSuggestions, staticSuggestions,
    loading, fetchProfile, fetchGoals, fetchCollectionSuggestions, fetchStaticSuggestions,
    fetchGearSnapshots,
  } = usePlayerProfileStore();
  const { groups, fetchGroups } = useStaticGroupStore();
  const { fetchTargets } = useSharedBisStore();
  const { isSmallScreen } = useDevice();
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => parseProfileTab(location.search));
  const linkModal = useModal();
  const addJobModal = useModal();
  const [editingJob, setEditingJob] = useState<PlayerJobProfile | null>(null);
  const [managingBisJobId, setManagingBisJobId] = useState<{ id: string; job: string } | null>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextTab = parseProfileTab(location.search);
    const frameId = requestAnimationFrame(() => setActiveTab(nextTab));
    return () => cancelAnimationFrame(frameId);
  }, [location.search]);

  // Swipe to change tabs — native listeners on the page container
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;

    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (dy > 100 || Math.abs(dx) < 50) return;
      const idx = PROFILE_TAB_IDS.indexOf(activeTabRef.current);
      if (dx < 0 && idx < PROFILE_TAB_IDS.length - 1) {
        setActiveTab(PROFILE_TAB_IDS[idx + 1]);
      } else if (dx > 0 && idx > 0) {
        setActiveTab(PROFILE_TAB_IDS[idx - 1]);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, []); // stable — reads from ref

  // Scroll the active tab button into view when tab changes (desktop tabs)
  useEffect(() => {
    const container = tabScrollRef.current;
    if (!container) return;
    const activeBtn = container.querySelector('[data-active="true"]') as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  useEffect(() => {
    if (!authInitialized || authLoading) return;
    if (!user) {
      navigate('/');
      return;
    }
    fetchProfile();
    fetchGoals();
    fetchCollectionSuggestions();
    fetchStaticSuggestions();
    fetchGroups();
  }, [
    authInitialized,
    authLoading,
    user,
    navigate,
    fetchProfile,
    fetchGoals,
    fetchCollectionSuggestions,
    fetchStaticSuggestions,
    fetchGroups,
  ]);

  const characterIds = profile?.characters.map((c) => c.id).join(',') ?? '';
  useEffect(() => {
    if (!profile?.characters.length) return;
    for (const character of profile.characters) {
      fetchGearSnapshots(character.id);
    }
  }, [characterIds, fetchGearSnapshots]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll gear snapshots every 30s at page level so all tabs stay current without manual refresh
  const gearPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!characterIds) return;
    const characters = profile?.characters ?? [];
    gearPollRef.current = setInterval(() => {
      for (const character of characters) {
        fetchGearSnapshots(character.id).catch(() => {});
      }
    }, 30_000);
    return () => {
      if (gearPollRef.current) clearInterval(gearPollRef.current);
    };
  }, [characterIds, fetchGearSnapshots, profile?.characters]);

  // Seed sharedBisStore for every job profile so cards show live data immediately
  const jobProfileIds = profile?.jobProfiles.map((j) => j.id).join(',') ?? '';
  useEffect(() => {
    if (!profile?.jobProfiles.length) return;
    for (const jp of profile.jobProfiles) {
      fetchTargets('player_job_profile', jp.id);
    }
  }, [jobProfileIds, fetchTargets]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authInitialized || authLoading) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-12 w-64 mb-6" />
        <Skeleton className="h-48 mb-4" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!user) return null;

  if (loading && !profile) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-12 w-64 mb-6" />
        <Skeleton className="h-48 mb-4" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const characters = profile?.characters ?? [];
  const jobProfiles = profile?.jobProfiles ?? [];
  const mainCharacter = characters.find((c) => c.isMain) ?? characters[0];
  const mainJob = jobProfiles.find((j) => j.priority === 'main');
  const hasGear = Object.values(gearSnapshots).some((s) => s.some(hasUsableGearSnapshot));

  const hasReadyJob = jobProfiles.some((j) => j.readiness !== 'unknown');
  const shareReady = profile?.shareEnabled && profile?.visibility !== 'private';

  const nextStep = !characters.length
    ? { label: 'Link Character', action: () => linkModal.open() }
    : !mainJob
      ? { label: 'Set Main Job', action: () => addJobModal.open() }
      : !hasGear
        ? { label: 'Check Gear', action: () => setActiveTab('sync') }
        : !hasReadyJob
          ? { label: 'Set Readiness', action: () => setActiveTab('jobs-gear') }
          : !shareReady
            ? { label: 'Share Profile', action: () => setActiveTab('preview') }
            : null;

  // Desktop tab labels
  const allTabs: { id: ProfileTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'sync', label: 'Sync' },
    { id: 'jobs-gear', label: 'Jobs & Gear', count: jobProfiles.length },
    { id: 'collections', label: 'Collections' },
    { id: 'availability', label: 'Availability' },
    { id: 'goals', label: 'Goals' },
    { id: 'preview', label: 'Share' },
  ];
  const tabs = allTabs;

  // Static shortcut — first group remains the default for existing schedule/availability integrations.
  const primaryStatic = groups.length > 0 ? groups[0] : null;
  const focusAvailability = new URLSearchParams(location.search).get('focus') === 'availability';

  return (
    <div ref={pageRef} className="mx-auto flex w-full max-w-[1440px] flex-col px-3 py-2 sm:px-5 sm:py-4 lg:px-6">
      {/* Header — command center card */}
      <motion.div {...fadeInProps} className="mb-3 sm:mb-4">
        <div
          className="rounded-xl border border-border-subtle overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(20,184,166,0.065) 0%, rgba(20,184,166,0.02) 60%, transparent 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
          }}
        >
          {/* Top accent rule */}
          <div style={{ height: 2, background: 'linear-gradient(90deg, rgba(20,184,166,0.7) 0%, rgba(20,184,166,0.2) 55%, transparent 100%)' }} />
          <div className="flex items-center gap-3 px-3 py-3 sm:px-4 sm:py-4">
            {/* User avatar */}
            <div
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-surface-elevated flex-shrink-0"
              style={{ boxShadow: '0 0 0 2px rgba(20,184,166,0.35), 0 0 14px rgba(20,184,166,0.15)' }}
            >
              {mainCharacter?.avatarUrl ? (
                <img src={mainCharacter.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-tertiary">
                  <GameIcon name="shield-person" size="lg" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5 select-none" style={{ color: 'rgba(20,184,166,0.6)' }}>
                Player Hub
              </div>
              <h1 className="text-base sm:text-xl font-display font-bold text-text-primary truncate leading-tight">
                {mainCharacter?.name ?? 'Your Character'}
              </h1>
              {mainCharacter && (
                <div className="text-xs text-text-secondary truncate mt-0.5">
                  {mainCharacter.server}
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {mainJob && (
                  <Badge variant={mainJob.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster'} size="sm">
                    {mainJob.job} Main
                  </Badge>
                )}
                <Badge variant={profile?.visibility === 'private' ? 'default' : 'info'} size="sm">
                  {profile?.visibility === 'private' ? 'Private' : profile?.shareEnabled ? 'Shared' : 'Not Shared'}
                </Badge>
              </div>
            </div>
            {/* Static shortcut */}
            <div className="flex-shrink-0 hidden sm:block">
              <StaticShortcut groups={groups} />
            </div>
          </div>
        </div>

        {/* Mobile static shortcut — below header */}
        {isSmallScreen && (
          <div className="mt-2">
            <StaticShortcut groups={groups} mobile />
          </div>
        )}
      </motion.div>

      {/* Desktop tab navigation — hidden on mobile (bottom nav replaces it) */}
      <div className="hidden sm:block relative mb-4">
        <div ref={tabScrollRef} className="flex gap-1 bg-surface-raised rounded-lg p-1 overflow-x-auto scrollbar-hide scroll-smooth">
          {tabs.map((tab) => (
            /* design-system-ignore: Tab button requires specific toggle styling */
            <button
              key={tab.id}
              data-active={activeTab === tab.id ? 'true' : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap flex-shrink-0
                ${
                  activeTab === tab.id
                    ? 'bg-accent/20 text-accent border-accent/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated border-transparent'
                }
              `}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-xs bg-surface-base px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — bottom padding for mobile bottom nav */}
      <div className="pb-20 sm:pb-0">
        <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
        >
        {activeTab === 'overview' && profile && (
          <OverviewTab
            profile={profile}
            goals={goals}
            gearSnapshots={gearSnapshots}
            collectionSuggestions={collectionSuggestions}
            staticSuggestions={staticSuggestions}
            nextStep={nextStep}
            onNavigate={(tab) => setActiveTab(tab as ProfileTab)}
            onOpenLinkModal={linkModal.open}
            onOpenJobModal={addJobModal.open}
            primaryStatic={primaryStatic}
            staticGroups={groups}
            focusAvailability={focusAvailability}
          />
        )}

        {activeTab === 'sync' && (
          <SyncCenterTab
            profile={profile}
            gearSnapshots={gearSnapshots}
            goals={goals}
            primaryStatic={primaryStatic}
            staticGroups={groups}
            onNavigate={(tab) => setActiveTab(tab as ProfileTab)}
            onOpenLinkModal={linkModal.open}
          />
        )}

        {activeTab === 'jobs-gear' && profile && (
          <JobsGearTab
            profile={profile}
            gearSnapshots={gearSnapshots}
            onAddJob={addJobModal.open}
            onEditJob={setEditingJob}
            onOpenLinkModal={linkModal.open}
            onNavigate={(tab) => setActiveTab(tab as ProfileTab)}
            onManageBiS={(jobProfileId) => {
              const jp = profile.jobProfiles.find((j) => j.id === jobProfileId);
              if (jp) setManagingBisJobId({ id: jobProfileId, job: jp.job });
            }}
          />
        )}

        {activeTab === 'collections' && (
          <CollectionsCenterTab />
        )}

        {activeTab === 'availability' && (
          <PlayerAvailabilityTab primaryStatic={primaryStatic} staticGroups={groups} />
        )}

        {activeTab === 'goals' && (
          <GoalsTab goals={goals} />
        )}

        {activeTab === 'preview' && profile && (
          <PreviewShareTab profile={profile} gearSnapshots={gearSnapshots} />
        )}
        </motion.div>
        </AnimatePresence>
      </div>

      {/* Modals */}
      {linkModal.isOpen && <CharacterLinkModal onClose={linkModal.close} />}
      {addJobModal.isOpen && <JobProfileModal onClose={addJobModal.close} />}
      {editingJob && (
        <JobProfileModal
          existing={editingJob}
          onClose={() => setEditingJob(null)}
        />
      )}
      {managingBisJobId && (
        <ManageBiSModal
          jobProfileId={managingBisJobId.id}
          job={managingBisJobId.job}
          onClose={() => {
            fetchTargets('player_job_profile', managingBisJobId.id);
            setManagingBisJobId(null);
          }}
        />
      )}

      {/* No sticky bottom CTA — next action is inline in Overview tab */}

      {/* Mobile bottom navigation — matches static page pattern */}
      <ProfileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
