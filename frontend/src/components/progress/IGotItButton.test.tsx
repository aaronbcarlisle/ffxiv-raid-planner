/**
 * I got it (S2a-3a·G3 Task TG5; D-5, D-16, D-21, R-S3-7, R-S3-16), inside the real panel, which
 * decides who sees it. The REAL store runs over a mocked `api` (a fake drops route); its legacy
 * refetches after a log are stubbed and `refreshGoalProgress` is a spy. The reader is "me".
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api';
import { useCollectionGoalStore, type CollectionGoal, type RewardDrop } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';
import type { MemberRole } from '../../types';
import { serveDrops } from './__fixtures__/dropServer';
import { emulateFocusFixup } from './__fixtures__/focusFixup';
import { apiDrop, farmRowOf, goal, type ColumnSpec } from './__fixtures__/progressFixtures';
import { FarmExpansion } from './FarmExpansion';

const WINGS = goal('wings', { title: 'Wings', catalogItemId: 'item-1' });
const DROPS = '/api/static-groups/g1/collection-goals/wings/drops';

const mine = (cell: ColumnSpec['cell'], kind: ColumnSpec['kind'] = 'claimed'): ColumnSpec[] => [
  { id: 'Healer 1', cell: { state: 'need', tokenCount: 12 } },
  { id: 'me', kind, cell },
];

const real = useCollectionGoalStore.getState();
const refresh = vi.fn();
let server: ReturnType<typeof serveDrops>;

interface PanelOptions {
  specs?: ColumnSpec[];
  g?: CollectionGoal;
  userRole?: MemberRole;
  canManage?: boolean;
  finished?: boolean;
}

function renderPanel({ specs = mine({ state: 'need' }), g = WINGS, userRole = 'member', canManage = false, finished = false }: PanelOptions = {}) {
  return render(
    <table>
      <tbody>
        <FarmExpansion
          row={farmRowOf(specs, g, userRole)}
          finished={finished}
          canManage={canManage}
          userRole={userRole}
          currentUserId="me"
          groupId="g1"
          onClose={vi.fn()}
          id="progress-expansion-wings"
          spanAll={5}
        />
      </tbody>
    </table>,
  );
}

/** Waits for the panel's drops load to settle (Last drops leaves its loading line). */
const settled = () => waitFor(() => expect(screen.queryByText('Loading drops…')).not.toBeInTheDocument());
const gotIt = () => screen.queryByRole('button', { name: 'I got it' });
const posts = () => vi.mocked(api.post).mock.calls;
const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message, t.action?.label ?? null]);

beforeEach(() => {
  vi.clearAllMocks();
  server = serveDrops(api);
  refresh.mockResolvedValue(undefined);
  useCollectionGoalStore.setState({
    drops: {},
    dropsLoading: {},
    fetchParticipants: vi.fn().mockResolvedValue(undefined),
    fetchGoals: vi.fn().mockResolvedValue(undefined),
    refreshGoalProgress: refresh,
  });
  useToastStore.getState().clearAll();
});

afterEach(() => {
  useCollectionGoalStore.setState({
    fetchParticipants: real.fetchParticipants,
    fetchGoals: real.fetchGoals,
    refreshGoalProgress: real.refreshGoalProgress,
    logDrop: real.logDrop,
    drops: {},
  });
});

describe('I got it: who sees it (D-5, R-S3-7)', () => {
  it.each([['Need', { state: 'need' }], ['Want', { state: 'want' }], ['Pass', { state: 'pass' }], ['blank', null]] as const)(
    'shows a member whose own cell is %s, once the drops have loaded',
    async (_label, cell) => {
      renderPanel({ specs: mine(cell) });
      expect(gotIt()).not.toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'I got it' })).toBeEnabled();
    },
  );

  it('shows nothing on Have, to a viewer, to a member with no column, or on a finished row; a lead gets Log a drop instead', async () => {
    const cases: PanelOptions[] = [
      { specs: mine({ state: 'have' }) },
      { userRole: 'viewer' },
      { specs: [{ id: 'Healer 1', cell: { state: 'need' } }] },
      { finished: true },
    ];
    for (const options of cases) {
      const view = renderPanel(options);
      await settled();
      expect(gotIt()).not.toBeInTheDocument();
      view.unmount();
    }
    renderPanel({ userRole: 'lead', canManage: true });
    await settled();
    expect(gotIt()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log drop for Healer 1' })).toBeInTheDocument();
  });
});

describe('I got it: one click (R-S3-7, D-16)', () => {
  it('logs for the own column\'s member with no note, toasts "Logged as yours" with Undo, and refreshes', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'I got it' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledWith('g1', 'wings'));
    expect(posts()).toEqual([[DROPS, expect.objectContaining({ recipient_user_id: 'me', notes: null })]]);
    expect(toasts()).toEqual([['success', 'Logged as yours', 'Undo']]);
  });

  it('works for a "Card not set up" member on their own trailing column (R-S3-14)', async () => {
    renderPanel({ specs: mine({ state: 'need' }, 'unconfigured') });
    fireEvent.click(await screen.findByRole('button', { name: 'I got it' }));
    await waitFor(() => expect(posts()[0]?.[1]).toMatchObject({ recipient_user_id: 'me' }));
  });
});

describe('I got it: one per member per farm (R-S3-16, D-21)', () => {
  it.each([
    ['on Pass', mine({ state: 'pass' }), WINGS],
    ['on a blank cell of a custom farm with no catalog item', mine(null), goal('wings', { title: 'Custom', catalogItemId: null, tokenCost: null })],
  ] as const)('logs once %s: the cell is unchanged and the button is gone', async (_label, specs, g) => {
    renderPanel({ specs: [...specs], g });
    fireEvent.click(await screen.findByRole('button', { name: 'I got it' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(gotIt()).not.toBeInTheDocument();
    expect(posts()).toHaveLength(1);
  });

  it('is hidden on open when the loaded drops already hold one for the reader, and not for someone else\'s', async () => {
    server = serveDrops(api, [apiDrop('d0', 'me')]);
    const view = renderPanel();
    await screen.findByText(/· me · ×1$/);
    expect(gotIt()).not.toBeInTheDocument();
    view.unmount();

    useCollectionGoalStore.setState({ drops: {} });
    server = serveDrops(api, [apiDrop('d0', 'Healer 1')]);
    renderPanel();
    expect(await screen.findByRole('button', { name: 'I got it' })).toBeInTheDocument();
  });

  it('sends one request for two clicks in the same tick', async () => {
    const release = server.gate();
    renderPanel();
    const button = await screen.findByRole('button', { name: 'I got it' });
    act(() => {
      button.click();
      button.click();
    });
    release();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(posts()).toHaveLength(1);
  });

  it('stays unavailable from the click until the refresh resolves, and sends nothing on a click meanwhile', async () => {
    // A log whose drop the store never lists, so only the lock can hold the button.
    const logged: RewardDrop = {
      id: 'd9', goalId: 'wings', staticGroupId: 'g1', recipientUserId: 'me', createdById: 'me', quantity: 1,
      droppedAt: '2026-10-02T00:00:00Z', notes: null, createdAt: '2026-10-02T00:00:00Z', recipientDisplayName: 'me', recipientPriorState: null,
    };
    const logDrop = vi.fn().mockResolvedValue(logged);
    let finish = () => {};
    refresh.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    useCollectionGoalStore.setState({ logDrop });
    renderPanel();
    const button = await screen.findByRole('button', { name: 'I got it' });

    fireEvent.click(button);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(logDrop).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    expect(button).not.toHaveAttribute('aria-disabled');
  });

  it('hands focus to Copy plan when a log hides it, never to <body> (G3 live defect)', async () => {
    const stop = emulateFocusFixup();
    renderPanel({ specs: mine({ state: 'pass' }) });
    const button = await screen.findByRole('button', { name: 'I got it' });
    act(() => button.focus());
    fireEvent.click(button);
    await waitFor(() => expect(gotIt()).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Copy plan' })).toHaveFocus();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    stop();
  });

  it('comes back when the drop is undone', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'I got it' }));
    await waitFor(() => expect(gotIt()).not.toBeInTheDocument());
    await waitFor(() => expect(refresh).toHaveBeenCalled());

    act(() => useToastStore.getState().toasts[0].action?.onClick());
    expect(await screen.findByRole('button', { name: 'I got it' })).toBeEnabled();
    expect(server.list()).toEqual([]);
  });

  it('waits while the drops load, then shows', async () => {
    let answer = (_drops: unknown[]) => {};
    vi.mocked(api.get).mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    renderPanel();
    expect(screen.getByText('Loading drops…')).toBeInTheDocument();
    expect(gotIt()).not.toBeInTheDocument();
    await act(async () => answer([]));
    expect(screen.getByRole('button', { name: 'I got it' })).toBeInTheDocument();
  });

  it('falls back to the cell rule when the drops fail to load', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('down'));
    renderPanel();
    expect(await screen.findByText('Couldn\'t load drops')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I got it' })).toBeEnabled();
  });

  it('stays hidden by a cached drop of the reader\'s when a later load, and its Retry, fail', async () => {
    server = serveDrops(api, [apiDrop('d0', 'me')]);
    const view = renderPanel();
    await screen.findByText(/· me · ×1$/);
    view.unmount();

    // The row reopens: its load fails, and so does Retry; the store still holds the drop.
    vi.mocked(api.get).mockRejectedValueOnce(new Error('down')).mockRejectedValueOnce(new Error('down'));
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === DROPS)).toHaveLength(3));
    expect(await screen.findByText('Couldn\'t load drops')).toBeInTheDocument();
    expect(useCollectionGoalStore.getState().drops.wings?.map((d) => d.recipientUserId)).toEqual(['me']);
    expect(gotIt()).not.toBeInTheDocument();
  });
});
