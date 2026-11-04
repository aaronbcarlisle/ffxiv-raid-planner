/**
 * S2a-5a·C1 Task C1-1 — Home's split row takes the singular (R-M-2, O-2):
 * ` · ${n} ${n === 1 ? 'needs' : 'need'} attention`, with n still `issueMemberCount`.
 *
 * Each plural and n = 0 case first shows the singular on the same harness, so it can't pass on a
 * Home that never says "needs". Home's other stores are mocked as `Home.splitRow.test.tsx` mocks
 * them; the readiness numbers are stubbed except where a case says it runs the real helper.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SnapshotPlayer, SplitClearAssignment, SplitClearData, StaticGroup, TierSnapshot } from '../../types';
import type { SplitClearReadiness } from '../../utils/splitClear';

const mocks = vi.hoisted(() => ({
  splitClear: null as unknown,
  readinessStub: null as unknown,
  userRole: 'member' as string | null,
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  const get = (url: string) => Promise.resolve(url.includes('/split-clear') ? mocks.splitClear : []);
  return { ...actual, api: { ...actual.api, get } };
});
vi.mock('../../utils/splitClear', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/splitClear')>();
  return {
    ...actual,
    getSplitClearReadiness: (players: SnapshotPlayer[], assignments: SplitClearAssignment[]) =>
      mocks.readinessStub ?? actual.getSplitClearReadiness(players, assignments),
  };
});
vi.mock('../loot/FairnessSummary', () => ({ FairnessSummary: () => <div /> }));
vi.mock('../../stores/scheduleStore', () => ({
  useScheduleStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ sessions: [], submitRsvp: vi.fn(), fetchSessions: vi.fn() }),
}));
vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ groupRequests: [], pendingCount: 0, groupRequestsGroupId: 'g1', fetchGroupRequests: vi.fn() }),
}));
vi.mock('../../stores/lootTrackingStore', () => {
  const resolved = async () => undefined;
  const state = {
    lootLog: [],
    materialLog: [],
    pageLedger: [],
    pageBalances: [],
    materialBalances: [],
    currentWeek: 3,
    fetchLootLog: resolved,
    fetchPageLedger: resolved,
    fetchMaterialLog: resolved,
    fetchPageBalances: resolved,
    fetchMaterialBalances: resolved,
  };
  return { useLootTrackingStore: (sel: (s: Record<string, unknown>) => unknown) => sel(state) };
});
vi.mock('../../stores/tierStore', () => ({ useTierPlayers: () => [] }));
vi.mock('../../stores/mountFarmStore', () => ({
  useMountFarmStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ data: null, fetchProgress: vi.fn() }),
}));
vi.mock('../../stores/staticCharacterStore', () => ({
  useStaticCharacterStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ registrationsByGroup: {}, fetchRegistrations: async () => undefined }),
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ user: { id: 'u1' } }),
}));
vi.mock('../../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({ userRole: mocks.userRole }),
}));
vi.mock('../../stores/viewAsStore', () => ({
  useViewAsStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ viewAsUser: null }),
}));

import { useSplitClearStore } from '../../stores/splitClearStore';
import { Home } from './Home';

// ── Fixtures ────────────────────────────────────────────────────────────────

const groupOf = (userRole: string) =>
  ({ id: 'g1', name: 'Static g1', shareCode: 'g1', settings: {}, userRole }) as unknown as StaticGroup;

const RAIDERS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map(
  (id) =>
    ({
      id,
      name: `Player ${id}`,
      job: 'PLD',
      role: 'tank',
      position: 'T1',
      configured: true,
      isSubstitute: false,
      sortOrder: 0,
      userId: `user-${id}`,
      gear: [{ bisSource: 'raid' }],
    }) as unknown as SnapshotPlayer,
);
const TIER = { id: 'aac', tierId: 'aac', isActive: true, players: RAIDERS } as unknown as TierSnapshot;

function assignment(snapshotPlayerId: string): SplitClearAssignment {
  return {
    id: `a-${snapshotPlayerId}`,
    snapshotPlayerId,
    runACharacterLinkId: null,
    runBCharacterLinkId: null,
    mainCharacterName: `Main ${snapshotPlayerId}`,
    mainCharacterWorld: 'Gilgamesh',
    altCharacterName: `Alt ${snapshotPlayerId}`,
    altCharacterWorld: 'Gilgamesh',
    runACharacter: 'main',
    runBCharacter: 'alt',
    lootTarget: 'normal',
    lootTargetJob: null,
    runACleared: false,
    runBCleared: false,
    notes: null,
    updatedAt: '2026-10-01T00:00:00Z',
  };
}

const splitOn = (assignments: SplitClearAssignment[]): SplitClearData => ({ enabled: true, assignments });

const stub = (issueMemberCount: number, altCount = 7, issueCount = issueMemberCount): SplitClearReadiness => ({
  altCount,
  memberCount: 8,
  issueCount,
  issueMemberCount,
});

// ── Harness ─────────────────────────────────────────────────────────────────

/** Renders Home until the row is on screen, and returns the row's meta line. */
async function showRow(readiness: SplitClearReadiness | null, role = 'member') {
  mocks.readinessStub = readiness;
  mocks.userRole = role;
  const view = render(
    <Home group={groupOf(role)} tier={TIER} canManage={false} onNavigate={vi.fn()} onOpenRequests={vi.fn()} />,
  );
  await screen.findByRole('button', { name: 'Open split plan' });
  return { meta: screen.getByText(/^Alts assigned /), unmount: view.unmount };
}

/** The control for a case that must not say "needs": the same harness does, at n = 1. */
async function singularFirst() {
  const first = await showRow(stub(1));
  expect(first.meta).toHaveTextContent(/^Alts assigned 7\/8 · 1 needs attention$/);
  first.unmount();
  useSplitClearStore.setState({ data: null, error: null, isLoading: false });
}

beforeEach(() => {
  mocks.splitClear = splitOn(RAIDERS.map((p) => assignment(p.id)));
  mocks.readinessStub = null;
  mocks.userRole = 'member';
  localStorage.clear();
  useSplitClearStore.setState({ data: null, isLoading: false, isSaving: false, error: null });
});

afterEach(() => {
  cleanup();
});

// ── The singular ────────────────────────────────────────────────────────────

describe('n = 1', () => {
  it('reads "Alts assigned 7/8 · 1 needs attention"', async () => {
    const { meta } = await showRow(stub(1));
    expect(meta).toHaveTextContent(/^Alts assigned 7\/8 · 1 needs attention$/);
  });

  it('reads the same from the real helper: seven alts, one raider with none', async () => {
    mocks.splitClear = splitOn(RAIDERS.slice(0, 7).map((p) => assignment(p.id)));
    const { meta } = await showRow(null);
    expect(meta).toHaveTextContent(/^Alts assigned 7\/8 · 1 needs attention$/);
  });

  it('counts the member, not the warnings: one member with four warnings is still singular', async () => {
    const { meta } = await showRow(stub(1, 7, 4));
    expect(meta).toHaveTextContent(/^Alts assigned 7\/8 · 1 needs attention$/);
  });

  it('reads the same to a viewer', async () => {
    const { meta } = await showRow(stub(1), 'viewer');
    expect(meta).toHaveTextContent(/^Alts assigned 7\/8 · 1 needs attention$/);
  });
});

describe('every other n', () => {
  it.each([2, 11, 21])('n = %i stays plural, where n = 1 is singular', async (n) => {
    await singularFirst();
    const { meta } = await showRow(stub(n, 6));
    expect(meta).toHaveTextContent(new RegExp(`^Alts assigned 6/8 · ${n} need attention$`));
  });

  it('takes the plural from the members: two members with one warning between them is plural', async () => {
    await singularFirst();
    const { meta } = await showRow(stub(2, 6, 1));
    expect(meta).toHaveTextContent(/^Alts assigned 6\/8 · 2 need attention$/);
  });

  it('n = 0 has no attention part in either form', async () => {
    await singularFirst();
    const { meta } = await showRow(stub(0, 8));
    expect(meta).toHaveTextContent(/^Alts assigned 8\/8$/);
    expect(screen.queryByText(/needs? attention/)).toBeNull();
  });
});
