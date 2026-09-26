import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { FairnessSummary } from './FairnessSummary';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer, LootLogEntry, MaterialLogEntry, PageLedgerEntry } from '../../types';

function makeDrop(playerId: string, weekNumber: number): LootLogEntry {
  return {
    id: 1, tierSnapshotId: 't1', weekNumber, floor: 'M9S', itemSlot: 'earring',
    recipientPlayerId: playerId, recipientPlayerName: 'x', method: 'drop',
    isExtra: false, createdAt: '2026-01-01T00:00:00Z',
  } as unknown as LootLogEntry;
}

function makePlayer(id: string, name: string, opts: { sub?: boolean } = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: opts.sub ?? false,
    gear: [
      { slot: 'earring', bisSource: 'raid', hasItem: false, isAugmented: false },
      { slot: 'ring1', bisSource: 'raid', hasItem: false, isAugmented: false },
      { slot: 'ring2', bisSource: 'raid', hasItem: false, isAugmented: false },
    ],
    tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}

const settings = { ...DEFAULT_SETTINGS };
const alice = makePlayer('a', 'Alice');
const bob = makePlayer('b', 'Bob');
const sub = { ...makePlayer('s', 'Subby'), isSubstitute: true } as SnapshotPlayer;
const players = [alice, bob, sub];

const base = {
  players, settings,
  lootLog: [] as LootLogEntry[], materialLog: [] as MaterialLogEntry[], pageLedger: [] as PageLedgerEntry[],
  currentWeek: 1, floors: ['M9S', 'M10S', 'M11S', 'M12S'],
};

describe('FairnessSummary', () => {
  it('renders the four stat cards from the rollup', () => {
    const lootLog = [
      makeDrop('a', 1), makeDrop('a', 2), makeDrop('a', 2),   // Alice 3
      makeDrop('b', 1),                                        // Bob 1
      makeDrop('s', 1), makeDrop('s', 1), makeDrop('s', 2),   // sub ignored
    ];
    render(<FairnessSummary {...base} lootLog={lootLog} currentWeek={2} />);
    expect(screen.getByText('Drops this tier')).toBeInTheDocument();
    expect(screen.getByText('across 2 raid weeks')).toBeInTheDocument();
    expect(screen.getByText('Most / fewest')).toBeInTheDocument();
    expect(screen.getByText('3 / 1')).toBeInTheDocument();
    expect(screen.getByText('Most: Alice')).toBeInTheDocument();
    expect(screen.getByText('Fewest: Bob')).toBeInTheDocument();
    expect(screen.getByText('Even')).toBeInTheDocument();
    // This-week card: value = week-2 entries for mains (Alice's 2; sub excluded),
    // pending = floor-1 ring only (earring logged this week; no other raid-BiS
    // targets in the fixture gear and no material needers).
    const thisWeekCard = screen.getByText('This week').parentElement!;
    expect(within(thisWeekCard).getByText('2')).toBeInTheDocument();
    expect(within(thisWeekCard).getByText('1 pending')).toBeInTheDocument();
  });

  it('shows Uneven with warning tone when spread > 2', () => {
    // Alice 4, Bob 0 → spread 4, over the ±2 band.
    const lootLog = [makeDrop('a', 1), makeDrop('a', 1), makeDrop('a', 1), makeDrop('a', 2)];
    render(<FairnessSummary {...base} lootLog={lootLog} currentWeek={2} />);
    const value = screen.getByText('Uneven');
    expect(value).toBeInTheDocument();
    expect(value.className).toContain('text-status-warning');
    expect(screen.getByText(/spread 4/)).toBeInTheDocument();
  });

  // T1-e (rewrite): only a substitute in the roster → no mains → `most` is
  // null. The Most/fewest and Distribution rows are replaced by ONE
  // empty-state line — no "Most / fewest" card, no "Even"/"Uneven", no
  // "spread 0" (a real-looking result for a comparison that has no players
  // to compare). The Drops-this-tier and This-week counts are truthful at
  // zero and stay.
  it('handles an empty roster with one empty-state line — no Most/fewest, no Even, no spread', () => {
    render(<FairnessSummary {...base} players={[sub]} lootLog={[]} currentWeek={1} />);

    expect(screen.queryByText('Most / fewest')).not.toBeInTheDocument();
    expect(screen.queryByText('Distribution')).not.toBeInTheDocument();
    expect(screen.queryByText('Even')).not.toBeInTheDocument();
    expect(screen.queryByText('Uneven')).not.toBeInTheDocument();
    expect(screen.queryByText(/spread 0/)).not.toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();

    expect(screen.getByText('No configured players on the roster yet.')).toBeInTheDocument();

    // The counts stay — truthful at zero.
    expect(screen.getByText('Drops this tier')).toBeInTheDocument();
    const dropsCard = screen.getByText('Drops this tier').parentElement!;
    expect(within(dropsCard).getByText('0')).toBeInTheDocument();
    expect(screen.getByText('This week')).toBeInTheDocument();
    const thisWeekCard = screen.getByText('This week').parentElement!;
    expect(within(thisWeekCard).getByText('0')).toBeInTheDocument();
  });
});

// E2 Task 3.2 (R-E2-H): the strip renders through the shared StatCell idiom —
// the four bordered, filled StatCard tiles are gone, and the empty roster
// leaves no hole in the 2-column grid.
describe('FairnessSummary — StatCell layout (R-E2-H)', () => {
  it('carries none of the old tile chrome (no rounded-lg / bg-surface-card)', () => {
    const lootLog = [makeDrop('a', 1), makeDrop('a', 1), makeDrop('b', 1)];
    const { container } = render(<FairnessSummary {...base} lootLog={lootLog} />);
    // The populated branch — all four stats render.
    expect(screen.getByText('Most / fewest')).toBeInTheDocument();
    expect(screen.getByText('Distribution')).toBeInTheDocument();
    expect(container.querySelector('.rounded-lg')).toBeNull();
    expect(container.querySelector('.bg-surface-card')).toBeNull();
  });

  it('empty roster: the two stats fill row 1 and the message spans row 2 — no empty grid cell', () => {
    const { container } = render(<FairnessSummary {...base} players={[sub]} />);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid).toHaveClass('grid', 'grid-cols-2');

    const cells = Array.from(grid.children);
    expect(cells).toHaveLength(3);
    cells.forEach((cell) => expect(cell.textContent?.trim()).not.toBe(''));
    expect(cells[0]).toHaveTextContent('Drops this tier');
    expect(cells[1]).toHaveTextContent('This week');
    expect(cells[0]).not.toHaveClass('col-span-2');
    expect(cells[1]).not.toHaveClass('col-span-2');
    expect(cells[2]).toHaveTextContent('No configured players on the roster yet.');
    expect(cells[2]).toHaveClass('col-span-2');
    expect(container.querySelector('.rounded-lg')).toBeNull();
    expect(container.querySelector('.bg-surface-card')).toBeNull();
  });
});
