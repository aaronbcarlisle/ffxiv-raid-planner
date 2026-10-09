/**
 * EditStatusesBar (S2a-2·F6 Task TF8; R-S2-10, R-S2-12, R-S2-17): the toolbar's controls
 * in and out of the mode, where focus goes on each edge, and the bulk Need's states and
 * toasts. The store's `markNeed` and `undoCells` are spies here; the page test sends the
 * real requests.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/api';
import { useCollectionGoalStore, type MarkNeedCell } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';
import { EditStatusesBar } from './EditStatusesBar';

const markNeed = vi.fn();
const undoCells = vi.fn();
const real = { markNeed: useCollectionGoalStore.getState().markNeed, undoCells: useCollectionGoalStore.getState().undoCells };

const CELLS: MarkNeedCell[] = [
  { goalId: 'wings', userId: 'u2' },
  { goalId: 'tomes', userId: 'u1' },
];

type Props = Parameters<typeof EditStatusesBar>[0];

function renderBar(props: Partial<Props> = {}) {
  const base: Props = { groupId: 'g1', editing: false, onEdit: vi.fn(), onDone: vi.fn(), blankCells: CELLS, ...props };
  const view = render(<EditStatusesBar {...base} />);
  return { ...base, rerender: (next: Partial<Props>) => view.rerender(<EditStatusesBar {...base} {...next} />) };
}

const toolbar = () => screen.getByTestId('progress-toolbar');
const buttons = () => within(toolbar()).getAllByRole('button');
/** While it runs the spinner's "Loading" joins the name, so match the end. */
const bulk = () => screen.getByRole('button', { name: /Mark everyone without a status as Need$/ });
const toasts = () => useToastStore.getState().toasts;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

beforeEach(() => {
  vi.clearAllMocks();
  useCollectionGoalStore.setState({ markNeed, undoCells });
  markNeed.mockResolvedValue({ created: 2, skipped: 0, undoTokens: ['tok-1'] });
  undoCells.mockResolvedValue({ restored: 1, skipped: 0 });
});

afterEach(() => {
  useCollectionGoalStore.setState(real);
  useToastStore.getState().clearAll();
});

describe('EditStatusesBar controls (R-S2-17)', () => {
  it('outside the mode is exactly one control, "Edit statuses", a secondary small Button', () => {
    const { onEdit } = renderBar();
    expect(buttons().map((b) => b.textContent)).toEqual(['Edit statuses']);
    fireEvent.click(buttons()[0]);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('in the mode is exactly two controls: the bulk Need (primary) and Done (ghost)', () => {
    const { onDone } = renderBar({ editing: true });
    expect(buttons().map((b) => b.textContent)).toEqual(['Mark everyone without a status as Need', 'Done']);
    expect(bulk()).toHaveClass('bg-accent');
    expect(screen.getByRole('button', { name: 'Done' })).toHaveClass('bg-transparent');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('moves focus to Done on entering and back to "Edit statuses" on Done, never to the body', () => {
    const { rerender } = renderBar();
    const edit = screen.getByRole('button', { name: 'Edit statuses' });
    act(() => edit.focus());
    fireEvent.click(edit);
    rerender({ editing: true });
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    rerender({ editing: false });
    expect(screen.getByRole('button', { name: 'Edit statuses' })).toHaveFocus();
  });

  it('leaves focus alone when the page changes the mode by itself', () => {
    const { rerender } = renderBar();
    rerender({ editing: true });
    expect(document.body).toHaveFocus();
  });
});

describe('EditStatusesBar bulk Need (R-S2-12, R-S2-11)', () => {
  it('is disabled with "No blank cells" describing it when nothing is blank: the text stays the same', () => {
    renderBar({ editing: true, blankCells: [] });
    const button = bulk();
    expect(button).toBeDisabled();
    const help = screen.getByText('No blank cells');
    expect(help).toHaveClass('text-xs');
    expect(button).toHaveAttribute('aria-describedby', help.id);
  });

  it('is enabled, undescribed, and sends exactly the given cells; shows loading while the request runs', async () => {
    const pending = deferred<{ created: number; skipped: number; undoTokens: string[] }>();
    markNeed.mockReturnValue(pending.promise);
    renderBar({ editing: true });
    expect(bulk()).toBeEnabled();
    expect(bulk()).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText('No blank cells')).not.toBeInTheDocument();

    fireEvent.click(bulk());
    expect(markNeed).toHaveBeenCalledWith('g1', CELLS);
    await waitFor(() => expect(bulk()).toBeDisabled());

    await act(async () => pending.resolve({ created: 2, skipped: 0, undoTokens: ['tok-1'] }));
    expect(bulk()).toBeEnabled();
    expect(toasts().map((t) => [t.type, t.message, t.action?.label])).toEqual([['success', 'Marked 2 cells Need', 'Undo']]);
  });

  it('lands focus on Done once a run ends, since the trigger was disabled meanwhile, and keeps it there when the trigger stays disabled', async () => {
    const pending = deferred<{ created: number; skipped: number; undoTokens: string[] }>();
    markNeed.mockReturnValue(pending.promise);
    const { rerender } = renderBar({ editing: true });
    act(() => bulk().focus());
    fireEvent.click(bulk());
    await waitFor(() => expect(bulk()).toBeDisabled());

    await act(async () => pending.resolve({ created: 2, skipped: 0, undoTokens: ['tok-1'] }));
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();

    // The refetch filled every cell: the trigger is disabled for good, and Done still holds focus.
    rerender({ blankCells: [] });
    expect(bulk()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
  });

  it('leaves focus the reader moved elsewhere during a run alone', async () => {
    const pending = deferred<{ created: number; skipped: number; undoTokens: string[] }>();
    markNeed.mockReturnValue(pending.promise);
    renderBar({ editing: true });
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    fireEvent.click(bulk());
    act(() => elsewhere.focus());

    await act(async () => pending.resolve({ created: 2, skipped: 0, undoTokens: [] }));
    expect(elsewhere).toHaveFocus();
    elsewhere.remove();
  });

  it('says "Marked 1 cell Need" for one, and plain success with no Undo when no token came back', async () => {
    markNeed.mockResolvedValue({ created: 1, skipped: 3, undoTokens: [] });
    renderBar({ editing: true });
    fireEvent.click(bulk());
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toMatchObject({ type: 'success', message: 'Marked 1 cell Need' });
    expect(toasts()[0].action).toBeUndefined();
  });

  it('tells "No cells marked: they changed since" when everything was skipped', async () => {
    markNeed.mockResolvedValue({ created: 0, skipped: 2, undoTokens: [] });
    renderBar({ editing: true });
    fireEvent.click(bulk());
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toMatchObject({ type: 'info', message: 'No cells marked: they changed since' });
  });

  it('Undo puts every chunk back in order, then says "Undone"', async () => {
    markNeed.mockResolvedValue({ created: 201, skipped: 0, undoTokens: ['tok-1', 'tok-2'] });
    renderBar({ editing: true });
    fireEvent.click(bulk());
    await waitFor(() => expect(toasts()).toHaveLength(1));

    act(() => toasts()[0].action!.onClick());
    await waitFor(() => expect(toasts().some((t) => t.message === 'Undone')).toBe(true));
    expect(undoCells.mock.calls).toEqual([['g1', 'tok-1'], ['g1', 'tok-2']]);
  });

  it('warns "Couldn\'t undo: it changed since" when any chunk\'s undo skipped a cell', async () => {
    undoCells.mockResolvedValueOnce({ restored: 1, skipped: 0 }).mockResolvedValueOnce({ restored: 0, skipped: 1 });
    markNeed.mockResolvedValue({ created: 2, skipped: 0, undoTokens: ['tok-1', 'tok-2'] });
    renderBar({ editing: true });
    fireEvent.click(bulk());
    await waitFor(() => expect(toasts()).toHaveLength(1));

    act(() => toasts()[0].action!.onClick());
    await waitFor(() => expect(toasts()).toHaveLength(2));
    expect(toasts()[1]).toMatchObject({ type: 'warning', message: 'Couldn\'t undo: it changed since' });
  });

  it('toasts one error on a failure, unless the api already did (a true 403)', async () => {
    markNeed.mockRejectedValueOnce(new Error('boom'));
    renderBar({ editing: true });
    fireEvent.click(bulk());
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toMatchObject({ type: 'error', message: 'Couldn\'t mark cells: boom' });
    expect(bulk()).toBeEnabled();

    markNeed.mockRejectedValueOnce(new ApiError(403, 'Forbidden', true));
    fireEvent.click(bulk());
    await waitFor(() => expect(markNeed).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(bulk()).toBeEnabled());
    expect(toasts()).toHaveLength(1);
  });
});
