import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DropHistoryPanel } from './DropHistoryPanel';
import { useCollectionGoalStore, type RewardDrop } from '../../stores/collectionGoalStore';

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
