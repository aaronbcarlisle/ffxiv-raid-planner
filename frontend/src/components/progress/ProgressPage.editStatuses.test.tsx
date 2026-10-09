/**
 * ProgressPage in Edit statuses (S2a-2·F6 Task TF8; R-S2-10, R-S2-12): who gets the mode,
 * which cells become controls in it and where their writes go (the real store over a
 * mocked `api`), the count field on another member's cell, the bulk Need and its Undo,
 * the mode's edges, the roving stop through them, and a correction's provenance. The
 * store is seeded and its fetches replaced, as `ProgressPage.ownCell.test.tsx` does.
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
import { useCollectionGoalStore, type CollectionGoal, type ParticipantStateEntry, type RecordOnlyCell } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';
import type { StaticGroup, TierSnapshot, User } from '../../types';
import { goal, row } from './__fixtures__/progressFixtures';
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
    { userId: 'u4', role: 'member', user: { displayName: 'Dee' } },
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
  players: [
    player('p1', 'Aya', 'T1', 'tank', 'u1'),
    player('p2', 'Bo', 'H1', 'healer', 'u2'),
    player('p3', 'Cy', 'R1', 'caster', null),
    player('p4', 'Dee', 'M1', 'melee', 'u4'),
  ],
} as unknown as TierSnapshot;

const WINGS = goal('wings', { title: 'Wings of Resolve', tokenName: 'Totems' });
const DONE = goal('done', { title: 'Old Farm', status: 'complete', completedAt: '2026-10-01T00:00:00Z' });

const fetchGoals = vi.fn();
const fetchProgress = vi.fn();

/** The server's row after a write, as `api.patch` resolves it. */
const written = (userId: string, extra: Record<string, unknown> = {}) => ({
  id: `wings-${userId}`, goal_id: 'wings', user_id: userId, static_group_id: 'g1', state: 'need', token_count: null, priority_rank: null,
  source: 'manual', last_synced_at: null, notes: null, updated_at: '2026-10-09T00:00:00Z', display_name: userId, member_role: 'member',
  undo_token: 'tok-1', ...extra,
});

const recordHave = (userId: string): RecordOnlyCell => ({
  userId, displayName: userId, memberRole: 'member', state: 'have', tokenCount: null, countHidden: false,
  record: { characterId: 'c1', ownershipState: 'have', tokenCount: null, source: 'plugin', updatedByUserId: null, updatedVia: 'api_key', stateChangedAt: null, tokenCountUpdatedAt: null, lastSyncedAt: null },
});

function seed(participants: Record<string, ParticipantStateEntry[]>, goals: CollectionGoal[] = [WINGS], recordOnly: Record<string, RecordOnlyCell[]> = {}) {
  useCollectionGoalStore.setState({
    goals, participants, recordOnly, loadedGroupId: 'g1', progressError: null, progressLoading: false, error: null, fetchGoals, fetchProgress,
  });
}

type Props = Parameters<typeof ProgressPage>[0];

function renderPage(props: Partial<Props> = {}) {
  const base: Props = { group, tier, canManage: true, userRole: 'owner', currentUserId: 'u1', isViewingAs: false, onNavigate: vi.fn(), ...props };
  const page = (p: Props) => (
    <MemoryRouter>
      <ProgressPage {...p} />
    </MemoryRouter>
  );
  const view = render(page(base), { wrapper: TooltipWrapper });
  return { ...view, rerender: (next: Partial<Props>) => view.rerender(page({ ...base, ...next })) };
}

const editButton = () => screen.queryByRole('button', { name: 'Edit statuses' });
const toolbarButtons = () => within(screen.getByTestId('progress-toolbar')).getAllByRole('button');
const bulk = () => screen.getByRole('button', { name: 'Mark everyone without a status as Need' });
const toasts = () => useToastStore.getState().toasts;
const gridStops = () => Array.from(screen.getByRole('grid').querySelectorAll<HTMLElement>('[tabindex="0"]'));
const cellNamed = (name: string) => screen.getByRole('gridcell', { name });
const pick = (name: string) => fireEvent.click(within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name }));

async function enterMode() {
  await screen.findByTestId('progress-matrix');
  const edit = editButton()!;
  act(() => edit.focus());
  fireEvent.click(edit);
}

beforeEach(() => {
  vi.clearAllMocks();
  stubCanHover();
  fetchGoals.mockResolvedValue(undefined);
  fetchProgress.mockResolvedValue({ error: null });
  vi.mocked(api.patch).mockImplementation((url: string) => Promise.resolve(written(url.endsWith('/participants') ? 'u1' : url.slice(url.lastIndexOf('/') + 1))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  useCollectionGoalStore.setState({ participants: {}, recordOnly: {}, goals: [] });
  useAuthStore.setState({ user: null });
  useToastStore.getState().clearAll();
});

describe('ProgressPage Edit statuses: who sees it (ruling 1)', () => {
  it.each([
    ['owner', 'owner', true],
    ['lead', 'lead', true],
    ['admin access', 'member', true],
  ] as const)('shows "Edit statuses" to %s as the one toolbar control', async (_who, userRole, canManage) => {
    seed({ wings: [row('wings', 'u1')] });
    renderPage({ userRole, canManage });
    await screen.findByTestId('progress-matrix');
    expect(toolbarButtons().map((b) => b.textContent)).toEqual(['Edit statuses']);
    expect(editButton()).toHaveClass('bg-surface-elevated');
  });

  it.each([
    ['member', 'member'],
    ['viewer', 'viewer'],
  ] as const)('gives %s no toolbar at all: hidden, not disabled', async (_who, userRole) => {
    seed({ wings: [row('wings', 'u1')] });
    renderPage({ userRole, canManage: false });
    await screen.findByTestId('progress-matrix');
    expect(editButton()).not.toBeInTheDocument();
    expect(screen.queryByTestId('progress-toolbar')).not.toBeInTheDocument();
  });

  it('shows no toolbar without an active farm, Finished alone included', async () => {
    seed({ done: [row('done', 'u1', { state: 'have' })] }, [DONE]);
    renderPage();
    await screen.findByTestId('progress-matrix');
    expect(editButton()).not.toBeInTheDocument();
  });
});

describe('ProgressPage Edit statuses: the mode (rulings 2, 3, 4)', () => {
  const mixed = {
    wings: [row('wings', 'u1', { state: 'need' }), row('wings', 'u2', { state: 'have' }), row('wings', 'u9', { displayName: 'Lead Nine', state: 'want', memberRole: 'lead' })],
    done: [row('done', 'u2', { state: 'need' })],
  };

  it('makes every claimed cell on active rows a Button, and leaves unclaimed, others\' off-roster and Finished cells alone', async () => {
    seed(mixed, [WINGS, DONE]);
    renderPage();
    await enterMode();
    expect(toolbarButtons().map((b) => b.textContent)).toEqual(['Mark everyone without a status as Need', 'Done']);

    expect(screen.getByRole('button', { name: 'Aya, Wings of Resolve, Need — change your status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bo, Wings of Resolve, Have — change status' })).toBeInTheDocument();
    const blank = screen.getByRole('button', { name: 'Dee, Wings of Resolve, no status — set status' });
    expect(within(blank).getByText('Set status')).toHaveClass('text-xs');
    expect(within(cellNamed('Cy, Wings of Resolve, unclaimed')).queryByRole('button')).not.toBeInTheDocument();
    expect(within(cellNamed('Lead Nine, Wings of Resolve, Want')).queryByRole('button')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    expect(within(await screen.findByRole('gridcell', { name: 'Bo, Old Farm, Need' })).queryByRole('button')).not.toBeInTheDocument();
  });

  it('outside the mode keeps F5: only the own cell is a Button, and another\'s blank cell stays empty', async () => {
    seed(mixed);
    renderPage();
    await screen.findByTestId('progress-matrix');
    expect(screen.getAllByRole('button', { name: /Wings of Resolve/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Aya, Wings of Resolve, Need — change your status']);
    expect(cellNamed('Dee, Wings of Resolve, no status')).toHaveTextContent('');
  });

  it('sends a lead\'s pick on another member\'s cell through the lead route, and on their own through the self route', async () => {
    seed(mixed);
    renderPage();
    await enterMode();

    fireEvent.click(screen.getByRole('button', { name: 'Bo, Wings of Resolve, Have — change status' }));
    pick('Need');
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/static-groups/g1/collection-goals/wings/participants/u2', { state: 'need', token_count: null }));

    fireEvent.click(screen.getByRole('button', { name: 'Aya, Wings of Resolve, Need — change your status' }));
    pick('✓ Have');
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/static-groups/g1/collection-goals/wings/participants', { state: 'have', token_count: null }));
    expect(api.patch).toHaveBeenCalledTimes(2);
  });

  it('Done leaves the mode with focus on "Edit statuses"; unmounting forgets it', async () => {
    seed(mixed);
    const { unmount } = renderPage();
    await enterMode();
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(editButton()).toHaveFocus();
    expect(screen.queryByRole('button', { name: /^Bo,/ })).not.toBeInTheDocument();

    fireEvent.click(editButton()!);
    expect(screen.getByRole('button', { name: /^Bo,/ })).toBeInTheDocument();
    unmount();
    renderPage();
    await screen.findByTestId('progress-matrix');
    expect(editButton()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Bo,/ })).not.toBeInTheDocument();
  });

  it('forgets the mode when the reader may no longer manage, so it does not resume when they may again', async () => {
    seed(mixed);
    const { rerender } = renderPage();
    await enterMode();
    expect(screen.getByRole('button', { name: /^Bo,/ })).toBeInTheDocument();

    rerender({ canManage: false, userRole: 'member' });
    expect(screen.queryByTestId('progress-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Bo,/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aya, Wings of Resolve, Need — change your status' })).toBeInTheDocument();

    rerender({ canManage: true, userRole: 'owner' });
    expect(editButton()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Bo,/ })).not.toBeInTheDocument();
  });

  it('forgets the mode when the last active farm finishes, so it does not resume when one is active again', async () => {
    seed(mixed);
    renderPage();
    await enterMode();

    act(() => useCollectionGoalStore.setState({ goals: [{ ...WINGS, status: 'complete', completedAt: '2026-10-09T00:00:00Z' }] }));
    expect(screen.queryByTestId('progress-toolbar')).not.toBeInTheDocument();

    act(() => useCollectionGoalStore.setState({ goals: [WINGS] }));
    await screen.findByRole('button', { name: 'Edit statuses' });
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Bo,/ })).not.toBeInTheDocument();
  });
});

describe('ProgressPage Edit statuses: the count field (ruling 5)', () => {
  it('shows an unflagged member\'s empty count field, and setting 12 sends token_count 12 through the lead route', async () => {
    seed({ wings: [row('wings', 'u2', { state: 'need', tokenCount: null, countHidden: false })] });
    renderPage();
    await enterMode();

    fireEvent.click(screen.getByRole('button', { name: 'Bo, Wings of Resolve, Need — change status' }));
    const field = screen.getByLabelText('Totems');
    expect(field).toHaveValue(null);
    fireEvent.change(field, { target: { value: '12' } });
    fireEvent.submit(field);

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/static-groups/g1/collection-goals/wings/participants/u2', { state: 'need', token_count: 12 }));
  });

  it('gives a flagged member\'s cell no count field, while its state buttons still write', async () => {
    seed({ wings: [row('wings', 'u2', { state: 'need', tokenCount: null, countHidden: true })] });
    renderPage();
    await enterMode();

    fireEvent.click(screen.getByRole('button', { name: 'Bo, Wings of Resolve, Need — change status' }));
    expect(screen.queryByLabelText('Totems')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    pick('– Pass');
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/static-groups/g1/collection-goals/wings/participants/u2', { state: 'pass', token_count: null }));
  });
});

describe('ProgressPage Edit statuses: the bulk Need (rulings 7, 8)', () => {
  const TOMES = goal('tomes', { title: 'Tomes' });

  it('sends exactly the blank claimed cells of active rows, toasts with Undo, and Undo posts the token back and refetches', async () => {
    // wings: Aya Need, Bo a record-only Have (Q1), Dee blank. tomes: Bo Have, Lead Nine Want (no card), Aya and Dee blank.
    // done: everyone blank, and Finished.
    seed(
      { wings: [row('wings', 'u1', { state: 'need' })], tomes: [row('tomes', 'u2', { state: 'have' }), row('tomes', 'u9', { displayName: 'Lead Nine', state: 'want', memberRole: 'lead' })], done: [] },
      [WINGS, TOMES, DONE],
      { wings: [recordHave('u2')] },
    );
    vi.mocked(api.post).mockResolvedValueOnce({ created: [written('u4'), written('u1'), written('u4')], skipped: 0, undo_token: 'bulk-tok' });
    renderPage();
    await enterMode();

    fireEvent.click(bulk());
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(api.post).toHaveBeenCalledWith('/api/static-groups/g1/collection-participants/mark-need', {
      cells: [
        { goal_id: 'wings', user_id: 'u4' },
        { goal_id: 'tomes', user_id: 'u1' },
        { goal_id: 'tomes', user_id: 'u4' },
      ],
    });
    expect(fetchProgress).toHaveBeenCalledTimes(2);
    expect(toasts()[0]).toMatchObject({ message: 'Marked 3 cells Need', action: { label: 'Undo' } });
    // The mode stays on.
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();

    vi.mocked(api.post).mockResolvedValueOnce({ restored: 3, skipped: 0 });
    act(() => toasts()[0].action!.onClick());
    await waitFor(() => expect(toasts().some((t) => t.message === 'Undone')).toBe(true));
    expect(api.post).toHaveBeenLastCalledWith('/api/static-groups/g1/collection-participants/undo', { token: 'bulk-tok' });
    expect(fetchProgress).toHaveBeenCalledTimes(3);
  });

  it('is disabled with "No blank cells" when every claimed cell has a status', async () => {
    seed({ wings: [row('wings', 'u1', { state: 'need' }), row('wings', 'u2', { state: 'have' }), row('wings', 'u4', { state: 'pass' })] });
    renderPage();
    await enterMode();
    expect(bulk()).toBeDisabled();
    expect(screen.getByText('No blank cells')).toBeInTheDocument();
  });
});

describe('ProgressPage Edit statuses: the roving stop (ruling 9)', () => {
  const rows = { wings: [row('wings', 'u1', { state: 'need' }), row('wings', 'u2', { state: 'have' })] };

  it('keeps exactly one stop through entering and leaving the mode, on the cell last focused', async () => {
    seed(rows);
    renderPage();
    await screen.findByTestId('progress-matrix');
    const bo = cellNamed('Bo, Wings of Resolve, Have');
    act(() => bo.focus());
    expect(gridStops()).toEqual([bo]);

    await enterMode();
    const boButton = screen.getByRole('button', { name: 'Bo, Wings of Resolve, Have — change status' });
    expect(gridStops()).toEqual([boButton]);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(gridStops()).toEqual([cellNamed('Bo, Wings of Resolve, Have')]);
  });

  it('moves with the arrows between a lead-editable Button cell and a read-only cell', async () => {
    seed(rows);
    renderPage();
    await enterMode();
    // The unclaimed cell is read-only; its left neighbour is a claimed column (Aya leads the
    // Board order), so in the mode that neighbour's focus element is a Button.
    const cy = cellNamed('Cy, Wings of Resolve, unclaimed');
    const cells = screen.getAllByTestId('progress-cell');
    const neighbour = within(cells[cells.indexOf(cy) - 1]).getByRole('button', { name: / — (change|set) status$/ });

    act(() => neighbour.focus());
    fireEvent.keyDown(neighbour, { key: 'ArrowRight' });
    expect(cy).toHaveFocus();
    fireEvent.keyDown(cy, { key: 'ArrowLeft' });
    expect(neighbour).toHaveFocus();
    expect(gridStops()).toEqual([neighbour]);
  });
});

describe('ProgressPage Edit statuses: provenance after a correction (ruling 10)', () => {
  it('reads "set by {writer}" on the corrected cell once the returned row names the lead who wrote it', async () => {
    const admin = { id: 'admin-1', discordId: 'd', discordUsername: 'root', displayName: 'Root Admin' } as User;
    useAuthStore.setState({ user: admin });
    seed({ wings: [row('wings', 'u2', { state: 'have' })] });
    vi.mocked(api.patch).mockResolvedValue(written('u2', { state: 'need', updated_by_user_id: 'admin-1', updated_via: 'web' }));
    renderPage({ isViewingAs: true });
    await enterMode();

    fireEvent.click(screen.getByRole('button', { name: 'Bo, Wings of Resolve, Have — change status' }));
    pick('Need');
    const corrected = await screen.findByRole('button', { name: 'Bo, Wings of Resolve, Need — change status' });
    act(() => corrected.focus());

    expect((await screen.findAllByText('set by Root Admin')).length).toBeGreaterThan(0);
  });
});
