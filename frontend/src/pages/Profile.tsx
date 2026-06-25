import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Calendar, ChevronDown, ChevronLeft, ChevronRight,
  Crosshair, Eye, LayoutDashboard, PlugZap, Shield, Sparkles, User, Users,
} from 'lucide-react';
import { Button } from '../components/primitives/Button';
import { Badge } from '../components/primitives/Badge';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  Tooltip,
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
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useModal } from '../hooks/useModal';
import { fadeInProps } from '../lib/motion';
import { GameIcon } from '../components/ui/GameIcon';
import { hasUsableGearSnapshot } from '../components/profile/jobGearUtils';
import type { MemberRole, StaticGroupListItem } from '../types';

type ProfileTab = 'overview' | 'sync' | 'jobs-gear' | 'collections' | 'availability' | 'preview';
const PROFILE_TAB_IDS: ProfileTab[] = ['overview', 'sync', 'jobs-gear', 'collections', 'availability', 'preview'];
const LEGACY_TAB_REDIRECTS: Record<string, ProfileTab> = {
  share: 'preview',
  characters: 'sync',
  gear: 'jobs-gear',
  jobs: 'jobs-gear',
  goals: 'collections',
};

const ROLE_LABELS: Partial<Record<MemberRole, string>> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
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
  { id: 'collections',  label: 'Collections & Goals', description: 'Mounts, music, weapons, collection goals, and tasks',    shortcut: '3', icon: Sparkles },
  { id: 'availability', label: 'Availability',      description: 'Your weekly availability for raid nights',                 shortcut: '4', icon: Calendar },
  { id: 'preview',      label: 'Share',             description: 'Preview and manage your shareable profile',                shortcut: '5', icon: Eye },
];

const PROFILE_SIDEBAR_KEY = 'profile-sidebar-collapsed';

/* eslint-disable design-system/no-raw-button */
function ProfileSidebarNav({
  activeTab,
  onTabChange,
  characterName,
  primaryStaticPath,
  primaryStaticName,
}: {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  characterName?: string;
  primaryStaticPath?: string;
  primaryStaticName?: string;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(PROFILE_SIDEBAR_KEY) === 'true'; } catch { return false; }
  });

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(PROFILE_SIDEBAR_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <motion.nav
      aria-label="Player Hub navigation"
      className="hidden sm:flex flex-col flex-shrink-0 border-r border-border-subtle"
      style={{
        background: 'linear-gradient(180deg, #0c0c14 0%, #090910 60%, #07070e 100%)',
        width: collapsed ? 56 : 208,
        minWidth: collapsed ? 56 : 208,
        overflowY: 'auto',
      }}
      variants={{
        expanded: { width: 208, minWidth: 208 },
        collapsed: { width: 56, minWidth: 56 },
      }}
      animate={collapsed ? 'collapsed' : 'expanded'}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Identity header + collapse toggle */}
      <div className="flex-shrink-0 border-b border-border-subtle" style={{ background: 'rgba(20,184,166,0.045)' }}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand sidebar"
            className="w-full h-12 flex items-center justify-center text-text-muted hover:text-accent transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        ) : (
          <>
            {/* Back-to-static breadcrumb — top row */}
            {primaryStaticPath ? (
              <Link
                to={primaryStaticPath}
                className="flex items-center gap-1.5 px-3 h-7 hover:bg-white/[0.04] transition-colors border-b border-border-subtle/50 w-full group"
                style={{ color: 'rgba(20,184,166,0.75)' }}
              >
                <ChevronLeft size={12} className="flex-shrink-0 group-hover:text-accent transition-colors" />
                <span className="text-xs font-semibold leading-none truncate min-w-0 group-hover:text-accent transition-colors">
                  {primaryStaticName ?? 'My Static'}
                </span>
              </Link>
            ) : (
              <div className="h-7 border-b border-border-subtle/50" />
            )}

            {/* Character identity + collapse — bottom row */}
            <div className="flex items-center h-9">
              <div className="flex items-center flex-1 min-w-0 px-3 gap-2">
                <div
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(20,184,166,0.18)', boxShadow: '0 0 0 1px rgba(20,184,166,0.2)' }}
                >
                  <User size={11} className="text-accent" />
                </div>
                <span
                  className="text-xs font-semibold text-accent truncate font-display tracking-wide leading-none"
                  title={characterName}
                >
                  {characterName ?? 'Player Hub'}
                </span>
              </div>
              <button
                type="button"
                onClick={toggle}
                aria-label="Collapse sidebar"
                className="flex-shrink-0 px-2.5 h-full flex items-center text-text-muted hover:text-accent transition-colors border-l border-border-subtle"
              >
                <ChevronLeft size={13} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Nav items */}
      <LayoutGroup id="sidebar-profile-nav">
        <div className="flex flex-col py-2 flex-1">
          {PROFILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <div key={item.id}>
                <Tooltip
                  content={
                    <div className="max-w-[200px]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-text-primary text-sm">{item.label}</span>
                        <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border-subtle bg-surface-base text-text-muted font-mono leading-none flex-shrink-0">
                          {item.shortcut}
                        </kbd>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">{item.description}</p>
                    </div>
                  }
                  side="right"
                  sideOffset={collapsed ? 12 : 16}
                  delayDuration={collapsed ? 200 : 700}
                >
                  <button
                    onClick={() => onTabChange(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`
                      relative flex items-center w-full py-2.5 text-sm font-medium text-left
                      transition-colors duration-150 select-none
                      ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'}
                      ${isActive
                        ? 'text-accent'
                        : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.035]'
                      }
                    `}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-profile-active-bg"
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'rgba(20,184,166,0.09)',
                          boxShadow: 'inset 0 0 32px rgba(20,184,166,0.1)',
                        }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      />
                    )}
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-profile-active-bar"
                        className="absolute inset-y-0 left-0 w-[2.5px] rounded-r pointer-events-none"
                        style={{
                          background: 'linear-gradient(180deg, rgba(20,184,166,0.3) 0%, var(--color-accent) 50%, rgba(20,184,166,0.3) 100%)',
                          boxShadow: '0 0 8px 2px rgba(20,184,166,0.35)',
                        }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      />
                    )}
                    <Icon size={15} className="flex-shrink-0 relative z-10" />
                    {!collapsed && (
                      <span className="leading-none relative z-10 whitespace-nowrap">{item.label}</span>
                    )}
                  </button>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </LayoutGroup>

      {/* Footer: plugin */}
      <div className="border-t border-border-subtle flex-shrink-0">
        {/* Plugin Sync */}
        <Tooltip
          content={
            <div className="max-w-[200px]">
              <p className="font-semibold text-text-primary text-sm mb-0.5">Plugin Sync</p>
              <p className="text-xs text-text-secondary leading-relaxed">Open Sync & Gear to manage the Dalamud plugin</p>
            </div>
          }
          side="right"
          sideOffset={collapsed ? 12 : 16}
          delayDuration={collapsed ? 200 : 700}
        >
          <button
            type="button"
            onClick={() => onTabChange('sync')}
            className={`
              w-full flex items-center py-2.5 text-text-muted hover:text-accent transition-colors
              ${collapsed ? 'justify-center' : 'gap-2.5 px-4'}
            `}
          >
            <PlugZap size={13} className="flex-shrink-0" />
            {!collapsed && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] leading-none">
                Plugin Sync
              </span>
            )}
          </button>
        </Tooltip>
      </div>

    </motion.nav>
  );
}
/* eslint-enable design-system/no-raw-button */

// ──────────────────────────────────────────────────────────────────────────────

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
  const [collSubTab, setCollSubTab] = useState<'goals' | 'priorities' | 'browse'>('goals');
  const linkModal = useModal();
  const addJobModal = useModal();
  const [editingJob, setEditingJob] = useState<PlayerJobProfile | null>(null);
  const [managingBisJobId, setManagingBisJobId] = useState<{ id: string; job: string } | null>(null);

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
      { key: '3', description: 'Collections & Goals', action: () => setActiveTab('collections') },
      { key: '4', description: 'Availability',        action: () => setActiveTab('availability') },
      { key: '5', description: 'Share',               action: () => setActiveTab('preview') },
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
    <div ref={pageRef} className="flex flex-1 min-h-0 w-full">
      {/* Sidebar — fills flex parent height naturally, no sticky needed */}
      <ProfileSidebarNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        characterName={mainCharacter?.name}
        primaryStaticPath={primaryStatic ? `/group/${primaryStatic.shareCode}` : undefined}
        primaryStaticName={primaryStatic?.name}
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
      <ProfileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
