import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DropHistoryPanel } from './DropHistoryPanel';
import { useCollectionGoalStore, type RewardDrop } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';
import { api } from '../../services/api';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

// Captured before any test stubs them, for the real-store describe below.
const { fetchDrops: realFetchDrops, deleteDrop: realDeleteDrop } = useCollectionGoalStore.getState();

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const deleteDrop = vi.fn();

const makeDrop = (over: Partial<RewardDrop>): RewardDrop => ({
  id: 'd1',
  goalId: 'goal-1',
  staticGroupId: 'g1',
  recipientUserId: 'r1',
  createdById: 'me',
  quantity: 1,
  droppedAt: '2026-09-30T12:00:00Z',
  notes: null,
  createdAt: '2026-09-30T12:00:00Z',
  recipientDisplayName: 'Aria',
  recipientPriorState: null,
  ...over,
});

function seed(drops: RewardDrop[]) {
  useCollectionGoalStore.setState({
    drops: { 'goal-1': drops },
    dropsLoading: {},
    fetchDrops: vi.fn().mockResolvedValue(undefined),
    deleteDrop,
  });
}

function renderPanel(canManage: boolean, isViewer = false) {
  return render(
    <DropHistoryPanel groupId="g1" goalId="goal-1" currentUserId="me" canManage={canManage} isViewer={isViewer} />,
  );
}

describe('DropHistoryPanel delete', () => {
  beforeEach(() => {
    deleteDrop.mockReset();
    deleteDrop.mockResolvedValue(undefined);
  });
  afterEach(() => {
    useCollectionGoalStore.setState({ drops: {}, dropsLoading: {} });
  });

  it('lets the creator delete their own drop after confirming, once', async () => {
    seed([makeDrop({ id: 'd1', createdById: 'me' })]);
    renderPanel(false);

    fireEvent.click(screen.getByRole('button', { name: /Delete drop/ }));
    expect(deleteDrop).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteDrop).toHaveBeenCalledTimes(1));
    expect(deleteDrop).toHaveBeenCalledWith('g1', 'goal-1', 'd1');
  });

  it('names the state the recipient returns to when the drop recorded one', async () => {
    seed([makeDrop({ recipientPriorState: 'want' })]);
    renderPanel(false);

    fireEvent.click(screen.getByRole('button', { name: /Delete drop/ }));
    expect(
      await screen.findByText('Delete this drop? Aria goes back to Want if it was their only drop.'),
    ).toBeInTheDocument();
  });

  it('asks a plain question when the drop flipped nobody', async () => {
    seed([makeDrop({ recipientPriorState: null })]);
    renderPanel(false);

    fireEvent.click(screen.getByRole('button', { name: /Delete drop/ }));
    expect(await screen.findByText('Delete this drop?')).toBeInTheDocument();
  });

  it('does not call deleteDrop when the confirmation is cancelled', async () => {
    seed([makeDrop({})]);
    renderPanel(false);

    fireEvent.click(screen.getByRole('button', { name: /Delete drop/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(deleteDrop).not.toHaveBeenCalled();
  });

  it("gives a non-manager no button on someone else's drop", () => {
    seed([makeDrop({ createdById: 'someone-else' })]);
    renderPanel(false);
    expect(screen.queryByRole('button', { name: /Delete drop/ })).not.toBeInTheDocument();
  });

  it('gives a viewer no button, even on a drop they logged before being demoted', () => {
    seed([makeDrop({ createdById: 'me' })]);
    renderPanel(false, true);
    expect(screen.queryByRole('button', { name: /Delete drop/ })).not.toBeInTheDocument();
  });

  it('gives a manager a button on every row', () => {
    seed([
      makeDrop({ id: 'd1', createdById: 'me' }),
      makeDrop({ id: 'd2', createdById: 'someone-else' }),
      makeDrop({ id: 'd3', createdById: null, recipientDisplayName: null }),
    ]);
    renderPanel(true);
    expect(screen.getAllByRole('button', { name: /Delete drop/ })).toHaveLength(3);
  });
});

// The REAL store actions over a mocked api: deleteDrop refetches drops, which flips
// dropsLoading while the confirm is still busy. The dialog must survive that.
describe('DropHistoryPanel delete with the real store', () => {
  const apiDrop = (id: string) => ({
    id, goal_id: 'goal-1', static_group_id: 'g1', recipient_user_id: 'r1', created_by_id: 'me',
    quantity: 1, dropped_at: '2026-09-30T12:00:00Z', notes: null, created_at: '2026-09-30T12:00:00Z',
    recipient_display_name: 'Aria', recipient_prior_state: null,
  });

  let initialDrops: ReturnType<typeof apiDrop>[];
  let refetchedDrops: ReturnType<typeof apiDrop>[];
  let releaseRefetch: () => void;
  let dropsGets: number;

  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });
    dropsGets = 0;
    const gate = new Promise<void>((resolve) => { releaseRefetch = resolve; });
    vi.mocked(api.delete).mockResolvedValue(undefined);
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (!url.endsWith('/drops')) return [];
      dropsGets += 1;
      // First GET is the panel's mount fetch; the second is deleteDrop's refetch, held pending.
      if (dropsGets === 1) return initialDrops;
      await gate;
      return refetchedDrops;
    });
    useCollectionGoalStore.setState({ drops: {}, dropsLoading: {} });
    useCollectionGoalStore.setState({
      fetchDrops: realFetchDrops,
      deleteDrop: realDeleteDrop,
    });
  });
  afterEach(() => {
    useCollectionGoalStore.setState({ drops: {}, dropsLoading: {} });
  });

  // While latched the Button adds its spinner's "Loading" label to the name.
  const confirmButton = () => screen.getByRole('button', { name: /^(Loading\s*)?Delete$/ });

  async function openConfirmAndConfirm() {
    renderPanel(true);
    fireEvent.click((await screen.findAllByRole('button', { name: /Delete drop: Aria/ }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    // The DELETE is out and the drops refetch is held pending.
    await waitFor(() => expect(dropsGets).toBe(2));
  }

  it('keeps the confirm mounted and latched while the drops refetch is in flight', async () => {
    initialDrops = [apiDrop('d1'), apiDrop('d2')];
    refetchedDrops = [apiDrop('d2')];
    await openConfirmAndConfirm();

    expect(screen.getByText('Delete this drop?')).toBeInTheDocument();
    expect(screen.queryByText('Loading history…')).not.toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();

    releaseRefetch();
    await waitFor(() => expect(screen.queryByText('Delete this drop?')).not.toBeInTheDocument());
    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts.map((t) => t.type)).toEqual(['success']);
  });

  it('keeps the confirm mounted when the refetch empties the list', async () => {
    initialDrops = [apiDrop('d1')];
    refetchedDrops = [];
    await openConfirmAndConfirm();

    // The local prune already emptied the list; the dialog must outlive it.
    expect(screen.getByText('Delete this drop?')).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();

    releaseRefetch();
    await waitFor(() => expect(screen.queryByText('Delete this drop?')).not.toBeInTheDocument());
    expect(await screen.findByText('No drops logged yet.')).toBeInTheDocument();
    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts.map((t) => t.type)).toEqual(['success']);
  });
});
