/**
 * ProgressPage and the reader's own cell (S2a-2·F5 Task TF7; R-S2-10): which role gets the
 * picker, where a pick goes under View As (the lead route aimed at the viewed user, through
 * a store spy), and the View As admin's own name as a writer. The store is seeded and its
 * fetches replaced, as `ProgressPage.matrix.test.tsx` does.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useCollectionGoalStore, type ParticipantStateEntry } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';
import type { StaticGroup, TierSnapshot, User } from '../../types';
import { apiDrop, goal, row } from './__fixtures__/progressFixtures';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';
import { ProgressPage } from './ProgressPage';

const group = {
  id: 'g1',
  name: 'Dev Test Static',
  shareCode: 'DEVTST',
  settings: {},
  userRole: 'owner',
  members: [
    { userId: 'u1', role: 'owner', user: { displayName: 'Aya Member' } },
    { userId: 'u2', role: 'member', user: { discordUsername: 'bo#1' } },
    { userId: 'u9', role: 'lead', user: { displayName: 'Lead Nine' } },
  ],
} as unknown as StaticGroup;

const player = (id: string, name: string, position: string, role: string, userId: string | null) => ({
  id, name, job: 'PLD', role, position, configured: true, isSubstitute: false, sortOrder: 0, userId,
});
const tier = {
  id: 't1',
  staticGroupId: 'g1',
  tierId: 'aac-cruiserweight',
  players: [player('p1', 'Aya', 'T1', 'tank', 'u1'), player('p2', 'Bo', 'H1', 'healer', 'u2')],
} as unknown as TierSnapshot;

const fetchGoals = vi.fn();
const fetchProgress = vi.fn();
const setCell = vi.fn();
const realSetCell = useCollectionGoalStore.getState().setCell;

function seed(participants: Record<string, ParticipantStateEntry[]>) {
  useCollectionGoalStore.setState({
    goals: [goal('wings', { title: 'Wings of Resolve' })],
    participants,
    recordOnly: {},
    loadedGroupId: 'g1',
    progressError: null,
    progressLoading: false,
    error: null,
    fetchGoals,
    fetchProgress,
    setCell,
  });
}

function renderPage(props: Partial<Parameters<typeof ProgressPage>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ProgressPage
        group={group}
        tier={tier}
        canManage={true}
        userRole="owner"
        currentUserId="u1"
        isViewingAs={false}
        onNavigate={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
    { wrapper: TooltipWrapper },
  );
}

const pickNeed = () => fireEvent.click(within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name: 'Need' }));

beforeEach(() => {
  vi.clearAllMocks();
  stubCanHover();
  fetchGoals.mockResolvedValue(undefined);
  fetchProgress.mockResolvedValue({ error: null });
  setCell.mockResolvedValue({ entry: row('wings', 'u2', { state: 'need' }), undoToken: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useCollectionGoalStore.setState({ setCell: realSetCell, participants: {}, recordOnly: {}, goals: [] });
  useAuthStore.setState({ user: null });
  useToastStore.getState().clearAll();
});

describe('ProgressPage own cell: who gets the picker', () => {
  it('gives a member their own cell as a button and no one else\'s', async () => {
    seed({ wings: [row('wings', 'u1', { state: 'need' }), row('wings', 'u2', { state: 'have' })] });
    renderPage({ userRole: 'member', canManage: false, currentUserId: 'u2' });
    await screen.findByTestId('progress-matrix');

    expect(screen.getByRole('button', { name: 'Bo, Wings of Resolve, Have — change your status' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Aya,/ })).not.toBeInTheDocument();
  });

  it('gives a viewer no button, their own cell included', async () => {
    seed({ wings: [row('wings', 'u2', { state: 'need' })] });
    renderPage({ userRole: 'viewer', canManage: false, currentUserId: 'u2' });
    const matrix = await screen.findByTestId('progress-matrix');

    // The row's name button (S2a-3a) is the matrix's only control for a viewer.
    expect(within(matrix).getAllByRole('button').map((b) => b.textContent)).toEqual(['Wings of Resolve']);
    expect(within(matrix).getByRole('gridcell', { name: 'Bo, Wings of Resolve, Need' })).toBeInTheDocument();
  });

  it('sends a pick through setCell with no target when not under View As', async () => {
    seed({ wings: [row('wings', 'u1', { state: 'want' })] });
    renderPage({ userRole: 'owner', currentUserId: 'u1' });
    await screen.findByTestId('progress-matrix');

    fireEvent.click(screen.getByRole('button', { name: 'Aya, Wings of Resolve, Want — change your status' }));
    pickNeed();

    expect(setCell).toHaveBeenCalledWith('g1', 'wings', { state: 'need' });
  });

  it('under View As, aims a pick on "their own" cell at the viewed user (the lead route), never the admin\'s row', async () => {
    seed({ wings: [row('wings', 'u2', { state: 'want' })] });
    renderPage({ userRole: 'owner', currentUserId: 'u2', isViewingAs: true });
    await screen.findByTestId('progress-matrix');

    fireEvent.click(screen.getByRole('button', { name: 'Bo, Wings of Resolve, Want — change your status' }));
    pickNeed();

    expect(setCell).toHaveBeenCalledWith('g1', 'wings', { targetUserId: 'u2', state: 'need' });
  });
});

describe('ProgressPage own cell: the View As admin\'s name', () => {
  const admin = { id: 'admin-1', discordId: 'd', discordUsername: 'root', displayName: 'Root Admin' } as User;

  it('reads "set by {admin}" for a row a non-member admin wrote', async () => {
    useAuthStore.setState({ user: admin });
    seed({ wings: [row('wings', 'u2', { state: 'need', updatedByUserId: 'admin-1', updatedVia: 'web' })] });
    renderPage({ userRole: 'owner', currentUserId: 'u2', isViewingAs: true });
    await screen.findByTestId('progress-matrix');

    act(() => screen.getByRole('button', { name: 'Bo, Wings of Resolve, Need — change your status' }).focus());

    expect((await screen.findAllByText('set by Root Admin')).length).toBeGreaterThan(0);
  });

  it('lets the member list\'s entry win over the signed-in user\'s own name', async () => {
    // u9 has no column; the member list names them, and so does the auth store (differently).
    useAuthStore.setState({ user: { ...admin, id: 'u9', displayName: 'Stale Name' } });
    seed({ wings: [row('wings', 'u2', { state: 'need', updatedByUserId: 'u9', updatedVia: 'web' })] });
    renderPage({ userRole: 'member', canManage: false, currentUserId: 'u2' });
    await screen.findByTestId('progress-matrix');

    act(() => screen.getByRole('button', { name: 'Bo, Wings of Resolve, Need — change your status' }).focus());

    expect((await screen.findAllByText('set by Lead Nine')).length).toBeGreaterThan(0);
    expect(screen.queryByText('set by Stale Name')).not.toBeInTheDocument();
  });
});

describe('ProgressPage open row: I got it under View As (S2a-3a·G3; R-S3-7, R-S3-16)', () => {
  const admin = { id: 'admin-1', discordId: 'd', discordUsername: 'root', displayName: 'Root Admin' } as User;
  const DROPS = '/api/static-groups/g1/collection-goals/wings/drops';

  async function openAsViewedMember(drops: ReturnType<typeof apiDrop>[]) {
    useAuthStore.setState({ user: admin });
    seed({ wings: [row('wings', 'u2', { state: 'need' })] });
    vi.mocked(api.get).mockImplementation((url: string) => Promise.resolve((url === DROPS ? drops : []) as never));
    renderPage({ userRole: 'member', canManage: false, currentUserId: 'u2', isViewingAs: true });
    await screen.findByTestId('progress-matrix');
    fireEvent.click(screen.getByRole('button', { name: 'Wings of Resolve' }));
    await within(screen.getByTestId('progress-expansion-drops')).findByText(drops.length > 0 ? /×1$/ : 'No drops logged yet.');
  }

  afterEach(() => {
    vi.mocked(api.get).mockResolvedValue([]);
    useCollectionGoalStore.setState({ drops: {} });
  });

  it('logs the drop for the viewed user, never the signed-in admin', async () => {
    vi.mocked(api.post).mockResolvedValue(apiDrop('d1', 'u2'));
    await openAsViewedMember([]);
    fireEvent.click(screen.getByRole('button', { name: 'I got it' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(DROPS, expect.objectContaining({ recipient_user_id: 'u2' })));
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('hides for a drop the viewed user already has', async () => {
    await openAsViewedMember([apiDrop('d0', 'u2')]);
    expect(screen.queryByRole('button', { name: 'I got it' })).not.toBeInTheDocument();
  });

  it('still shows when the only drop is the admin\'s own', async () => {
    await openAsViewedMember([apiDrop('d0', 'admin-1')]);
    expect(screen.getByRole('button', { name: 'I got it' })).toBeInTheDocument();
  });
});
