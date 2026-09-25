import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  JoinRequest,
  ScheduleSession,
  SnapshotPlayer,
  StaticGroup,
  TierSnapshot,
} from '../../types';

// ─── Store mocks (all stores Home + its child cards consume) ────────────────────
const mocks = vi.hoisted(() => ({
  sessions: [] as ScheduleSession[],
  submitRsvp: vi.fn(),
  fetchSessions: vi.fn(),
  groupRequests: [] as JoinRequest[],
  pendingCount: 0,
  fetchGroupRequests: vi.fn(),
  lootLog: [] as unknown[],
  materialLog: [] as unknown[],
  pageLedger: [] as unknown[],
  pageBalances: [] as unknown[],
  materialBalances: [] as unknown[],
  currentWeek: 3,
  fetchLootLog: vi.fn(),
  fetchPageLedger: vi.fn(),
  fetchMaterialLog: vi.fn().mockResolvedValue(undefined),
  fetchPageBalances: vi.fn(),
  fetchMaterialBalances: vi.fn(),
  players: [] as SnapshotPlayer[],
  mountData: null as unknown,
  fetchProgress: vi.fn(),
  registrationsByGroup: {} as Record<string, unknown>,
  fetchRegistrations: vi.fn().mockResolvedValue(undefined),
  toastError: vi.fn(),
  user: { id: 'u1' } as { id: string } | null,
  fairnessCalls: [] as Record<string, unknown>[],
}));

// Prop-capturing mock (D6b `WeekCountBar`-mock precedent, `loot/Loot.test.tsx`)
// so the substitute/unconfigured-seat test below asserts Home's OWN
// `mainRosterPlayers` derivation, not `computeTierFairness`'s (already-tested)
// internal re-filter — the two are redundant on the real component, which
// would make a dropped Home-side filter an invisible, vacuous mutation.
vi.mock('../loot/FairnessSummary', () => ({
  FairnessSummary: (props: Record<string, unknown>) => {
    mocks.fairnessCalls.push(props);
    return <div data-testid="fairness-summary" />;
  },
}));

vi.mock('../../stores/scheduleStore', () => ({
  useScheduleStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ sessions: mocks.sessions, submitRsvp: mocks.submitRsvp, fetchSessions: mocks.fetchSessions }),
}));
vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ groupRequests: mocks.groupRequests, pendingCount: mocks.pendingCount, fetchGroupRequests: mocks.fetchGroupRequests }),
}));
vi.mock('../../stores/lootTrackingStore', () => ({
  useLootTrackingStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      lootLog: mocks.lootLog,
      materialLog: mocks.materialLog,
      pageLedger: mocks.pageLedger,
      pageBalances: mocks.pageBalances,
      materialBalances: mocks.materialBalances,
      currentWeek: mocks.currentWeek,
      fetchLootLog: mocks.fetchLootLog,
      fetchPageLedger: mocks.fetchPageLedger,
      fetchMaterialLog: mocks.fetchMaterialLog,
      fetchPageBalances: mocks.fetchPageBalances,
      fetchMaterialBalances: mocks.fetchMaterialBalances,
    }),
}));
vi.mock('../../stores/tierStore', () => ({ useTierPlayers: () => mocks.players }));
vi.mock('../../stores/mountFarmStore', () => ({
  useMountFarmStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ data: mocks.mountData, fetchProgress: mocks.fetchProgress }),
}));
vi.mock('../../stores/staticCharacterStore', () => ({
  useStaticCharacterStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ registrationsByGroup: mocks.registrationsByGroup, fetchRegistrations: mocks.fetchRegistrations }),
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ user: mocks.user }),
}));
vi.mock('../../stores/toastStore', () => ({
  toast: { error: mocks.toastError, success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
const FULL_TIER = {
  id: 't1',
  name: 'Test Tier',
  shortName: 'M9S-M12S',
  patch: '7.4',
  floors: ['M9S', 'M10S', 'M11S', 'M12S'],
  itemLevels: { savage: 790, savageWeapon: 795, tome: 780, tomeAugmented: 790, crafted: 770, minimum: 765 },
  gearPrefixes: { savage: 'Grand Champion', tome: 'Base', crafted: 'Crafted' },
  upgradeMaterials: { twine: 'Twine', glaze: 'Glaze', solvent: 'Solvent' },
  isCurrent: true,
};
vi.mock('../../gamedata', () => ({
  getAllTrialIds: () => [],
  getTrialById: () => null,
  getTierById: () => FULL_TIER,
}));
vi.mock('../../gamedata/raid-tiers', () => ({ getTierById: () => ({ floors: ['M9S', 'M10S'] }) }));

import { Home } from './Home';
import { DEFAULT_SETTINGS } from '../../utils/constants';

// ─── Fixtures ───────────────────────────────────────────────────────────────────
const group = { id: 'g1', name: 'Crescent Static', userRole: 'owner' } as unknown as StaticGroup;
const tier = { tierId: 't1', players: [] } as unknown as TierSnapshot;

function player(partial: Partial<SnapshotPlayer>): SnapshotPlayer {
  return {
    id: 'p',
    tierSnapshotId: 't',
    name: 'Player',
    job: 'WAR',
    role: 'tank',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {} as SnapshotPlayer['tomeWeapon'],
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}
function futureSession(partial: Partial<ScheduleSession> = {}): ScheduleSession {
  const start = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const end = new Date(Date.now() + 2 * 86_400_000 + 3_600_000).toISOString();
  return {
    id: 's1',
    staticGroupId: 'g1',
    createdById: 'u1',
    title: 'Raid Night',
    description: null,
    startTime: start,
    endTime: end,
    timezone: 'America/New_York',
    isRecurring: false,
    recurrenceRule: null,
    category: 'raid',
    contentId: null,
    contentName: null,
    bannerUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    rsvps: [],
    ...partial,
  };
}

function renderHome(props: Partial<Parameters<typeof Home>[0]> = {}) {
  return render(
    <Home
      group={group}
      tier={tier}
      canManage
      onNavigate={vi.fn()}
      onOpenRequests={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  mocks.sessions = [];
  mocks.submitRsvp = vi.fn();
  mocks.fetchSessions = vi.fn();
  mocks.groupRequests = [];
  mocks.pendingCount = 0;
  mocks.fetchGroupRequests = vi.fn();
  mocks.lootLog = [];
  mocks.materialLog = [];
  mocks.pageLedger = [];
  mocks.pageBalances = [];
  mocks.materialBalances = [];
  mocks.currentWeek = 3;
  mocks.fetchLootLog = vi.fn();
  mocks.fetchPageLedger = vi.fn();
  mocks.fetchMaterialLog = vi.fn().mockResolvedValue(undefined);
  mocks.fetchPageBalances = vi.fn();
  mocks.fetchMaterialBalances = vi.fn();
  mocks.players = [];
  mocks.mountData = null;
  mocks.fetchProgress = vi.fn();
  mocks.registrationsByGroup = {};
  mocks.fetchRegistrations = vi.fn().mockResolvedValue(undefined);
  mocks.toastError.mockClear();
  mocks.user = { id: 'u1' };
  mocks.fairnessCalls = [];
});

describe('Home', () => {
  it('renders the page header, hero cards, and the two dashboard regions', () => {
    mocks.sessions = [futureSession()];
    renderHome();

    // Page header
    expect(screen.getByRole('heading', { level: 1, name: 'This week' })).toBeInTheDocument();

    // Hero: next-session (SessionRsvpCard), loot, readiness
    expect(screen.getByRole('heading', { name: /next session/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /this week's loot/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /roster readiness/i })).toBeInTheDocument();

    // Dashboard regions
    expect(screen.getByRole('heading', { name: /needs your attention/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /bis progress by role/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /recent activity/i })).toBeInTheDocument();
  });

  it('shows the empty-state invite (not the RSVP card) when there is no upcoming session', () => {
    mocks.sessions = [];
    renderHome();
    expect(screen.getByText(/no upcoming session/i)).toBeInTheDocument();
    // The RSVP button strip is absent without a session.
    expect(screen.queryByRole('button', { name: /i'm in/i })).not.toBeInTheDocument();
    // Loot + readiness still render.
    expect(screen.getByRole('heading', { name: /this week's loot/i })).toBeInTheDocument();
  });

  it('fires submitRsvp from the RSVP card', () => {
    mocks.sessions = [futureSession()];
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /i'm in/i }));
    expect(mocks.submitRsvp).toHaveBeenCalledWith('g1', 's1', 'available');
  });

  it('builds an Import BiS attention row for a claimed raider with no BiS', () => {
    const noBis = player({ id: 'A', userId: 'uA', name: 'Caster One', job: 'BLM', role: 'caster', gear: [] });
    const tierWithPlayer = { tierId: 't1', players: [noBis] } as unknown as TierSnapshot;
    const onNavigate = vi.fn();
    renderHome({ tier: tierWithPlayer, onNavigate });
    const btn = screen.getByRole('button', { name: /import bis/i });
    fireEvent.click(btn);
    expect(onNavigate).toHaveBeenCalledWith('roster');
  });

  it('gates the unclaimed "Assign" attention rows on canManage', () => {
    const unclaimed = player({ id: 'U', userId: undefined, name: 'Open Slot', configured: true });
    const tierWithUnclaimed = { tierId: 't1', players: [unclaimed] } as unknown as TierSnapshot;

    // canManage=false → no Assign row (manage-only action)
    const { unmount } = renderHome({ tier: tierWithUnclaimed, canManage: false });
    expect(screen.queryByRole('button', { name: /^assign$/i })).not.toBeInTheDocument();
    unmount();

    // canManage=true → the Assign row renders
    renderHome({ tier: tierWithUnclaimed, canManage: true });
    expect(screen.getByRole('button', { name: /^assign$/i })).toBeInTheDocument();
  });

  it('shows join-request attention rows only when canManage and routes Review to onOpenRequests', () => {
    mocks.groupRequests = [
      { id: 'r1', status: 'pending', characterNameAtApply: 'Grimm', createdAt: new Date().toISOString() } as unknown as JoinRequest,
    ];
    const onOpenRequests = vi.fn();

    // canManage=false → no Review row
    const { unmount } = renderHome({ canManage: false });
    expect(screen.queryByRole('button', { name: /review/i })).not.toBeInTheDocument();
    unmount();

    renderHome({ canManage: true, onOpenRequests });
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    expect(onOpenRequests).toHaveBeenCalledTimes(1);
  });

  it('membership-gates the fetch effect: non-members skip group-request + session + progress fetches', () => {
    const nonMemberGroup = { id: 'g1', name: 'Crescent', userRole: null } as unknown as StaticGroup;
    renderHome({ group: nonMemberGroup, canManage: false });
    expect(mocks.fetchGroupRequests).not.toHaveBeenCalled();
    expect(mocks.fetchSessions).not.toHaveBeenCalled();
    expect(mocks.fetchProgress).not.toHaveBeenCalled();
    // D14 (R-D14-C): a non-member with a tier DOES now fetch the three
    // fairness logs, read-only — covered by its own dedicated test below.
  });

  it('fetches on mount for members (sessions, loot, progress) and group-requests when canManage', () => {
    renderHome();
    expect(mocks.fetchSessions).toHaveBeenCalledWith('g1');
    expect(mocks.fetchLootLog).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchPageLedger).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchMaterialLog).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchGroupRequests).toHaveBeenCalledWith('g1');
  });

  it('a member with a tier triggers the Team Summary fetches (page balances, material balances, registrations)', () => {
    renderHome();
    expect(mocks.fetchPageBalances).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchMaterialBalances).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchRegistrations).toHaveBeenCalledWith('g1');
  });

  it('a non-member triggers none of the Team Summary fetches and does not render the card', () => {
    const nonMemberGroup = { id: 'g1', name: 'Crescent', userRole: null } as unknown as StaticGroup;
    renderHome({ group: nonMemberGroup, canManage: false });
    expect(mocks.fetchPageBalances).not.toHaveBeenCalled();
    expect(mocks.fetchMaterialBalances).not.toHaveBeenCalled();
    expect(mocks.fetchRegistrations).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Team Summary' })).not.toBeInTheDocument();
  });

  it('a member without a tier fetches registrations but not balances', () => {
    renderHome({ tier: null });
    expect(mocks.fetchRegistrations).toHaveBeenCalledWith('g1');
    expect(mocks.fetchPageBalances).not.toHaveBeenCalled();
    expect(mocks.fetchMaterialBalances).not.toHaveBeenCalled();
  });

  it('fires exactly one "Failed to load loot data" toast when two fetches in the group reject', async () => {
    mocks.fetchLootLog = vi.fn().mockRejectedValue(new Error('boom'));
    mocks.fetchPageBalances = vi.fn().mockRejectedValue(new Error('boom'));
    renderHome();
    await vi.waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(mocks.toastError).toHaveBeenCalledWith('Failed to load loot data');
  });

  it('renders the "Team Summary" heading after "BiS progress by role" in DOM order', () => {
    renderHome();
    const headingNames = screen.getAllByRole('heading').map((h) => h.textContent);
    const bisIndex = headingNames.findIndex((t) => /bis progress by role/i.test(t ?? ''));
    const teamSummaryIndex = headingNames.findIndex((t) => t === 'Team Summary');
    expect(bisIndex).toBeGreaterThanOrEqual(0);
    expect(teamSummaryIndex).toBeGreaterThan(bisIndex);
  });

  it('renders both rows inside one grid, with no TwoRegionDashboard (R-E2-G)', () => {
    mocks.mountData = {
      trials: [{ trialId: 'test-trial', totalMembers: 4, membersComplete: 2, memberProgress: [] }],
    };
    renderHome();

    // Hero row and dashboard row are siblings of the SAME grid container —
    // TwoRegionDashboard (pre-R-E2-G) put the dashboard row one level
    // deeper, inside its own separate `.grid`, which would make these two
    // `.closest('.grid')` calls resolve to different nodes.
    const heroGrid = screen.getByRole('heading', { name: /roster readiness/i }).closest('.grid');
    const dashboardGrid = screen.getByRole('heading', { name: /needs your attention/i }).closest('.grid');
    expect(heroGrid).not.toBeNull();
    expect(heroGrid).toBe(dashboardGrid);

    // Side stack order unchanged: Loot fairness, Recent activity, Track card.
    const headingNames = screen.getAllByRole('heading').map((h) => h.textContent);
    const fairnessIndex = headingNames.findIndex((t) => t === 'Loot fairness');
    const activityIndex = headingNames.findIndex((t) => /recent activity/i.test(t ?? ''));
    const trackIndex = headingNames.findIndex((t) => t === 'test-trial');
    expect(fairnessIndex).toBeGreaterThanOrEqual(0);
    expect(activityIndex).toBeGreaterThan(fairnessIndex);
    expect(trackIndex).toBeGreaterThan(activityIndex);
  });

  it('renders the fairness module above the activity feed, in DOM order (R-D14-B)', () => {
    renderHome();
    const headingNames = screen.getAllByRole('heading').map((h) => h.textContent);
    const fairnessIndex = headingNames.findIndex((t) => t === 'Loot fairness');
    const activityIndex = headingNames.findIndex((t) => /recent activity/i.test(t ?? ''));
    expect(fairnessIndex).toBeGreaterThanOrEqual(0);
    expect(activityIndex).toBeGreaterThan(fairnessIndex);
  });

  it('a non-member viewer sees the fairness module too: fetches the three logs, no balances, no registrations, no Team Summary (R-D14-C)', () => {
    const nonMemberGroup = { id: 'g1', name: 'Crescent', userRole: null } as unknown as StaticGroup;
    renderHome({ group: nonMemberGroup, canManage: false });
    expect(screen.getByRole('heading', { name: 'Loot fairness' })).toBeInTheDocument();
    expect(mocks.fetchLootLog).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchPageLedger).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchMaterialLog).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchPageBalances).not.toHaveBeenCalled();
    expect(mocks.fetchMaterialBalances).not.toHaveBeenCalled();
    expect(mocks.fetchRegistrations).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Team Summary' })).not.toBeInTheDocument();
  });

  it("feeds FairnessSummary only configured, non-substitute players, plus the matching currentWeek, floors and settings (R-D14-D)", () => {
    const main = player({ id: 'M', name: 'Main' });
    const sub = player({ id: 'S', name: 'Sub', isSubstitute: true });
    const unconfigured = player({ id: 'U', name: 'Unset', configured: false });
    // 't1' is a placeholder id — the `getTierById` mock (:107) ignores its
    // argument and always returns ['M9S','M10S'], so this proves Home threads
    // the mocked floors through, not that it looks up the right tier.
    const tierWithMix = { tierId: 't1', players: [main, sub, unconfigured] } as unknown as TierSnapshot;
    renderHome({ tier: tierWithMix });

    const last = mocks.fairnessCalls[mocks.fairnessCalls.length - 1];
    const fedPlayers = last.players as SnapshotPlayer[];
    // Mutation check (executed by hand, not committed): dropping
    // `.filter((p) => p.configured && !p.isSubstitute)` in Home's
    // `mainRosterPlayers` derivation turns this red —
    // `expect(fedPlayers.map((p) => p.id)).toEqual(['M'])` fails with
    // `['M', 'S', 'U']` received.
    expect(fedPlayers.map((p) => p.id)).toEqual(['M']);

    // R-D14-D: `currentWeek` is the store's `currentWeek` Home already reads
    // (`clock.currentWeek`, mocked at 3 above); `floors` is Loot's source
    // expression, `getTierById(tier.tierId)?.floors`; `settings` is
    // `{ ...DEFAULT_SETTINGS, ...group.settings }` — the fixture group carries
    // no `settings` override, so it's DEFAULT_SETTINGS verbatim.
    expect(last.currentWeek).toBe(mocks.currentWeek);
    expect(last.floors).toEqual(['M9S', 'M10S']);
    expect(last.settings).toEqual(DEFAULT_SETTINGS);
  });
});
