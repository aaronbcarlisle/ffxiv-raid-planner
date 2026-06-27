import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useUrlTabState, clearRegisteredTabParams } from '../hooks/useUrlTabState';
import { prefRememberTabs } from '../lib/navPreferences';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Crosshair, Eye, LayoutDashboard, Shield, Sparkles, User, Users,
} from 'lucide-react';
import { Badge } from '../components/primitives/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { AppRail } from '../components/layout/AppRail';
import type { RailNavItem } from '../components/layout/railTypes';
import { UserMenu } from '../components/auth';
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
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useModal } from '../hooks/useModal';
import { fadeInProps } from '../lib/motion';
import { GameIcon } from '../components/ui/GameIcon';
import { hasUsableGearSnapshot } from '../components/profile/jobGearUtils';
import { MyStaticsPanel } from '../components/dashboard/MyStaticsPanel';

type ProfileTab = 'overview' | 'sync' | 'jobs-gear' | 'collections' | 'availability' | 'preview' | 'statics';
const PROFILE_TAB_IDS: ProfileTab[] = ['overview', 'sync', 'jobs-gear', 'collections', 'availability', 'preview', 'statics'];
const COLL_SUB_TABS = ['goals', 'priorities', 'browse'] as const;
const LEGACY_TAB_REDIRECTS: Record<string, ProfileTab> = {
  share: 'preview',
  characters: 'sync',
  gear: 'jobs-gear',
  jobs: 'jobs-gear',
  goals: 'collections',
};

// ── Profile sidebar nav ────────────────────────────────────────────────────
const PROFILE_NAV_ITEMS: Array<{
  id: ProfileTab;
  label: string;
  description: string;
  shortcut: string;
  icon: React.FC<{ size?: number; className?: string }>;
}> = [
  { id: 'overview',     label: 'Overview',          description: 'Character overview, goals, and quick actions',              shortcut: '`', icon: LayoutDashboard },
  { id: 'sync',         label: 'Sync & Gear',       description: 'Plugin sync status and character gear snapshots',           shortcut: '1', icon: Shield },
  { id: 'jobs-gear',    label: 'Jobs & Gear',       description: 'Job profiles, BiS targets, and readiness status',          shortcut: '2', icon: Crosshair },
  { id: 'collections',  label: 'Tracking',          description: 'Mounts, music, weapons, collection goals, and tasks',    shortcut: '3', icon: Sparkles },
  { id: 'availability', label: 'Availability',      description: 'Your weekly availability for raid nights',                 shortcut: '4', icon: Calendar },
  { id: 'preview',      label: 'Share',             description: 'Preview and manage your shareable profile',                shortcut: '5', icon: Eye },
  { id: 'statics',      label: 'My Statics',        description: 'Browse, create, and manage your raid statics',             shortcut: '6', icon: Users },
];

export function ProfileSidebarNav({
  activeTab,
  onTabChange,
  characterName,
}: {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  characterName?: string;
}) {
  const items: RailNavItem[] = PROFILE_NAV_ITEMS.map(d => ({
    ...d,
    isActive: activeTab === d.id,
    onSelect: () => onTabChange(d.id),
  }));

  return (
    <AppRail
      context="profile"
      identity={{ icon: User, label: characterName ?? 'Player Hub' }}
      collapseKey="profile-sidebar-collapsed"
      items={items}
      footer={(collapsed) => <UserMenu variant="rail" collapsed={collapsed} />}
    />
  );
}

// ──────────────────────────────────────────────────────────────────────────────

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
  // Active tab is derived from the URL (?tab=) so the sidebar is deep-linkable,
  // reload-safe, and follows browser back/forward. parseProfileTab keeps the
  // legacy-redirect handling for old bookmarks. The setter pushes a history entry.
  const [, setSearchParams] = useSearchParams();
  const activeTab = parseProfileTab(location.search);
  const setActiveTab = useCallback((tab: ProfileTab) => {
    // When "remember sub-tabs" is off, switching sidebar views resets sub-tabs
    // (e.g. Collections & Goals back to Tasks & Goals).
    const resetSubTabs = !prefRememberTabs(useAuthStore.getState().user);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (tab === 'overview') params.delete('tab');
      else params.set('tab', tab);
      if (resetSubTabs) clearRegisteredTabParams(params);
      return params;
    });
  }, [setSearchParams]);
  // Collections & Goals sub-tab (Tasks & Goals / My Priorities / Browse Catalog).
  const [collSubTab, setCollSubTab] = useUrlTabState('coll', COLL_SUB_TABS, 'goals');
  const linkModal = useModal();
  const addJobModal = useModal();
  const [editingJob, setEditingJob] = useState<PlayerJobProfile | null>(null);
  const [managingBisJobId, setManagingBisJobId] = useState<{ id: string; job: string } | null>(null);

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

  // Profile tab keyboard shortcuts — must be before any early returns (hooks rules)
  useKeyboardShortcuts({
    shortcuts: [
      { key: '`', description: 'Overview',            action: () => setActiveTab('overview') },
      { key: '1', description: 'Sync & Gear',         action: () => setActiveTab('sync') },
      { key: '2', description: 'Jobs & Gear',         action: () => setActiveTab('jobs-gear') },
      { key: '3', description: 'Tracking',            action: () => setActiveTab('collections') },
      { key: '4', description: 'Availability',        action: () => setActiveTab('availability') },
      { key: '5', description: 'Share',               action: () => setActiveTab('preview') },
      { key: '6', description: 'My Statics',          action: () => setActiveTab('statics') },
    ],
  });

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


  // Static shortcut — first group remains the default for existing schedule/availability integrations.
  const primaryStatic = groups.length > 0 ? groups[0] : null;
  const focusAvailability = new URLSearchParams(location.search).get('focus') === 'availability';

  return (
    <div ref={pageRef} className="flex flex-1 min-h-0 w-full max-w-[160rem] mx-auto px-4">
      {/* Sidebar — fills flex parent height naturally, no sticky needed */}
      <ProfileSidebarNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        characterName={mainCharacter?.name}
      />

      {/* Right panel: header + tab content (scrolls independently) */}
      <div className="flex-1 min-w-0 overflow-y-auto flex flex-col" style={{ scrollbarGutter: 'stable' }}>
      {/* Header — command center card */}
      <div className="px-3 py-2 sm:px-5 sm:py-4 lg:px-6 flex-shrink-0">
      <motion.div {...fadeInProps} className="mb-3 sm:mb-4">
        <div
          className="rounded-xl border border-border-subtle overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgba(20,184,166,0.1) 0%, rgba(20,184,166,0.03) 45%, transparent 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.3)',
          }}
        >
          {/* Top accent rule */}
          <div style={{ height: 2, background: 'linear-gradient(90deg, var(--color-accent) 0%, rgba(20,184,166,0.3) 45%, transparent 100%)' }} />
          <div className="flex items-center gap-3 px-3 py-3 sm:px-4 sm:py-4">
            {/* User avatar */}
            <div
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-surface-elevated flex-shrink-0"
              style={{ boxShadow: '0 0 0 2px rgba(20,184,166,0.5), 0 0 0 4px rgba(20,184,166,0.12), 0 0 20px rgba(20,184,166,0.3)' }}
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
          </div>
        </div>
      </motion.div>
      </div>{/* end header */}

        {/* Tab content */}
        <div className="flex-1 px-3 sm:px-5 lg:px-6 pb-20 sm:pb-4">
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
          <div className="flex flex-col gap-5">
            {/* ── Sub-tab bar ── */}
            <div className="flex flex-col gap-1.5">
              <div className="flex border-b border-border-subtle">
                {([
                  { id: 'goals'      as const, label: 'Tasks & Goals' },
                  { id: 'priorities' as const, label: 'My Priorities' },
                  { id: 'browse'     as const, label: 'Browse Catalog' },
                ] satisfies { id: typeof collSubTab; label: string }[]).map(tab => (
                  // eslint-disable-next-line design-system/no-raw-button
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCollSubTab(tab.id)}
                    className={`relative px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      collSubTab === tab.id
                        ? 'text-accent'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {tab.label}
                    {collSubTab === tab.id && (
                      <span className="absolute bottom-0 inset-x-0 h-[2px] rounded-t" style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.5) 0%, var(--color-accent) 50%, rgba(20,184,166,0.5) 100%)' }} />
                    )}
                  </button>
                ))}
              </div>

              {/* Per-tab description */}
              <p className="text-[11px] text-text-muted px-0.5 leading-relaxed">
                {collSubTab === 'goals' && 'Personal tasks — gearing, clears, raid prep, or custom reminders. Not tied to collection rewards.'}
                {collSubTab === 'priorities' && "Mounts, music, weapons, and other rewards you're hunting or farming. Mark visibility to share with your statics."}
                {collSubTab === 'browse' && "Browse the full rewards catalog to discover what's available and set your intent on new items."}
              </p>
            </div>

            {/* ── Sub-tab content ── */}
            {collSubTab === 'goals' && <GoalsTab goals={goals} />}
            {(collSubTab === 'priorities' || collSubTab === 'browse') && (
              <CollectionsCenterTab
                view={collSubTab === 'browse' ? 'browse' : 'priorities'}
                onViewChange={(v) => setCollSubTab(v)}
              />
            )}
          </div>
        )}

        {activeTab === 'availability' && (
          <PlayerAvailabilityTab primaryStatic={primaryStatic} staticGroups={groups} />
        )}

        {activeTab === 'preview' && profile && (
          <PreviewShareTab profile={profile} gearSnapshots={gearSnapshots} />
        )}

        {activeTab === 'statics' && <MyStaticsPanel />}
        </motion.div>
        </AnimatePresence>
        </div>{/* end content */}
      </div>{/* end right panel / scroll column */}

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
      <ProfileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        primaryStaticPath={primaryStatic ? `/group/${primaryStatic.shareCode}` : undefined}
        primaryStaticName={primaryStatic?.name}
      />
    </div>
  );
}
