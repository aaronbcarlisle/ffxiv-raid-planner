/**
 * QueueList (S2a-3a·G2b Task TG4; R-S3-14, R-S3-15): "Next in line" for leads and members, and
 * the viewer's unranked line. Rows come from `farmRowOf` (the matrix's own `cellFor`); a viewer's
 * rows are built with a lead's counts on purpose, so the queue WOULD rank them and the line
 * must still not.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CollectionPriorityMode } from '../../stores/collectionGoalStore';
import { farmRowOf, goal, type ColumnSpec } from './__fixtures__/progressFixtures';
import { QueueList } from './QueueList';

const need = (tokenCount: number | null) => ({ state: 'need' as const, tokenCount });
const want = (tokenCount: number | null) => ({ state: 'want' as const, tokenCount });

function renderQueue(columns: ColumnSpec[], opts: { viewer?: boolean; mode?: CollectionPriorityMode | null; tokenCost?: number | null } = {}) {
  const g = goal('g1', { priorityMode: opts.mode ?? null, tokenCost: opts.tokenCost === undefined ? 99 : opts.tokenCost });
  return render(<QueueList row={farmRowOf(columns, g)} viewer={opts.viewer ?? false} />);
}

const items = () => screen.queryAllByRole('listitem').map((li) => li.textContent);

const SIX: ColumnSpec[] = [
  { id: 'Ann', cell: need(60) },
  { id: 'Bea', cell: need(10) },
  { id: 'Cy', cell: need(30) },
  { id: 'Dee', cell: want(5) },
  { id: 'Eli', cell: need(90) },
  { id: 'Fay', cell: want(1) },
];

describe('QueueList for leads and members', () => {
  it('lists the top four as "{name} · {text}" with their ranks, in queue order', () => {
    renderQueue(SIX);
    expect(items()).toEqual(['#1Bea · Need 10/99', '#2Cy · Need 30/99', '#3Ann · Need 60/99', '#4Eli · Need 90/99']);
    expect(screen.getByText('Bea · Need 10/99')).toBeInTheDocument();
  });

  it('offers "Show all (n)" only when more than four are queued, and expands in place', () => {
    renderQueue(SIX);
    const toggle = screen.getByRole('button', { name: 'Show all (6)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(items()).toHaveLength(6);
    expect(items().slice(4)).toEqual(['#5Fay · Want 1/99', '#6Dee · Want 5/99']);
    const collapse = screen.getByRole('button', { name: 'Show fewer' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(collapse);
    expect(items()).toHaveLength(4);
  });

  it('has no Show all for exactly four', () => {
    renderQueue(SIX.slice(0, 4));
    expect(items()).toHaveLength(4);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reads "Need 12" with no cost on a drop-only farm', () => {
    renderQueue([{ id: 'Ann', cell: need(12) }], { tokenCost: null });
    expect(screen.getByText('Ann · Need 12')).toBeInTheDocument();
  });

  it('reads "Free roll: no queue" under free_roll, and "Nobody needs it" with an empty queue', () => {
    const { unmount } = renderQueue([{ id: 'Ann', cell: need(1) }], { mode: 'free_roll' });
    expect(screen.getByText('Free roll: no queue')).toBeInTheDocument();
    expect(items()).toEqual([]);
    unmount();
    renderQueue([{ id: 'Ann', cell: { state: 'have' } }, { id: 'Bea' }]);
    expect(screen.getByText('Nobody needs it')).toBeInTheDocument();
  });

  it('queues a Not-on-the-roster member among the roster by the same rules (R-S3-14)', () => {
    renderQueue([
      { id: 'Ann', cell: need(60) },
      { id: 'Ghost', kind: 'notOnRoster', cell: need(3) },
      { id: 'Neo', kind: 'unconfigured', cell: want(1) },
      { id: 'Cara', kind: 'unclaimed' },
    ]);
    expect(items()).toEqual(['#1Ghost · Need 3/99', '#2Ann · Need 60/99', '#3Neo · Want 1/99']);
  });
});

describe('QueueList for a viewer (R-S3-15, D-20)', () => {
  it('reads one unranked line in column order, though the queue would rank Melee 2 first', () => {
    renderQueue(
      [
        { id: 'Healer 1', cell: need(80) },
        { id: 'Melee 2', cell: need(5) },
        { id: 'Tank 1', cell: want(1) },
      ],
      { viewer: true },
    );
    expect(screen.getByText('Need: Healer 1, Melee 2 · Want: Tank 1')).toBeInTheDocument();
  });

  it('shows no ranks, counts, list or Show all, even with more than four queued', () => {
    const { container } = renderQueue(SIX, { viewer: true });
    expect(container).toHaveTextContent('Need: Ann, Bea, Cy, Eli · Want: Dee, Fay');
    expect(container.textContent).not.toMatch(/#|\d/);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reads "Want: …" for a Want-only row, and "Nobody needs it" for an empty one', () => {
    const { unmount } = renderQueue([{ id: 'Tank 1', cell: want(2) }, { id: 'Melee 1', cell: want(1) }], { viewer: true });
    expect(screen.getByText('Want: Tank 1, Melee 1')).toBeInTheDocument();
    unmount();
    renderQueue([{ id: 'Ann', cell: { state: 'have' } }], { viewer: true });
    const text = screen.getByText('Nobody needs it');
    expect(within(text.parentElement as HTMLElement).queryByText(/Need:/)).not.toBeInTheDocument();
  });

  it('follows the mode: free_roll has no queue, desired_only leaves the Wants out', () => {
    const columns = [{ id: 'Ann', cell: need(5) }, { id: 'Bea', cell: want(5) }];
    const { unmount } = renderQueue(columns, { viewer: true, mode: 'free_roll' });
    expect(screen.getByText('Free roll: no queue')).toBeInTheDocument();
    unmount();
    renderQueue(columns, { viewer: true, mode: 'desired_only' });
    expect(screen.getByText('Need: Ann')).toBeInTheDocument();
  });
});
