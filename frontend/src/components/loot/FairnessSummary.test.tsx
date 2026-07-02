import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText(/Alice 3 · Bob 1/)).toBeInTheDocument();
    expect(screen.getByText('Even')).toBeInTheDocument();
    expect(screen.getByText('This week')).toBeInTheDocument();
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

  it('handles an empty roster without crashing (— placeholders)', () => {
    // Only a substitute in the roster → no mains → most/fewest are null.
    render(<FairnessSummary {...base} players={[sub]} lootLog={[]} currentWeek={1} />);
    expect(screen.getByText('Most / fewest')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Drops this tier')).toBeInTheDocument();
    expect(screen.getByText('This week')).toBeInTheDocument();
  });
});
