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
  pageLedger: [] as unknown[],
  currentWeek: 3,
  fetchLootLog: vi.fn(),
  fetchPageLedger: vi.fn(),
  players: [] as SnapshotPlayer[],
  mountData: null as unknown,
  fetchProgress: vi.fn(),
  user: { id: 'u1' } as { id: string } | null,
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
      pageLedger: mocks.pageLedger,
      currentWeek: mocks.currentWeek,
      fetchLootLog: mocks.fetchLootLog,
      fetchPageLedger: mocks.fetchPageLedger,
    }),
}));
vi.mock('../../stores/tierStore', () => ({ useTierPlayers: () => mocks.players }));
vi.mock('../../stores/mountFarmStore', () => ({
  useMountFarmStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ data: mocks.mountData, fetchProgress: mocks.fetchProgress }),
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ user: mocks.user }),
}));
vi.mock('../../gamedata', () => ({ getAllTrialIds: () => [], getTrialById: () => null }));
vi.mock('../../gamedata/raid-tiers', () => ({ getTierById: () => ({ floors: ['M9S', 'M10S'] }) }));

import { Home } from './Home';

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
  mocks.pageLedger = [];
  mocks.currentWeek = 3;
  mocks.fetchLootLog = vi.fn();
  mocks.fetchPageLedger = vi.fn();
  mocks.players = [];
  mocks.mountData = null;
  mocks.fetchProgress = vi.fn();
  mocks.user = { id: 'u1' };
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

  it('membership-gates the fetch effect: non-members skip group-request + session fetches', () => {
    const nonMemberGroup = { id: 'g1', name: 'Crescent', userRole: null } as unknown as StaticGroup;
    renderHome({ group: nonMemberGroup, canManage: false });
    expect(mocks.fetchGroupRequests).not.toHaveBeenCalled();
    expect(mocks.fetchSessions).not.toHaveBeenCalled();
  });

  it('fetches on mount for members (sessions, loot, progress) and group-requests when canManage', () => {
    renderHome();
    expect(mocks.fetchSessions).toHaveBeenCalledWith('g1');
    expect(mocks.fetchLootLog).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchPageLedger).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchGroupRequests).toHaveBeenCalledWith('g1');
  });
});
