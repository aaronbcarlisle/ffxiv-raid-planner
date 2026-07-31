import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueueWhy } from './QueueWhy';
import type { RecipientEntry } from '../../utils/recipientRanking';
import type { SnapshotPlayer, LootLogEntry } from '../../types';
import type { PriorityScoreBreakdown } from '../../utils/priority';

function makePlayer(id: string, name: string): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: false,
    gear: [
      { slot: 'ring1', bisSource: 'raid', hasItem: false, isAugmented: false },
      { slot: 'ring2', bisSource: 'raid', hasItem: false, isAugmented: false },
    ],
    tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}

function bd(overrides: Partial<PriorityScoreBreakdown> = {}): PriorityScoreBreakdown {
  return {
    score: 0, rolePriority: 0, weightedNeed: 0, weightedNeedBonus: 0,
    lootAdjustmentBonus: 0, jobModifier: 0, playerModifier: 0,
    ...overrides,
  };
}

function makeEntry(id: string, name: string, rank: number, overrides: Partial<RecipientEntry> = {}): RecipientEntry {
  return {
    player: makePlayer(id, name), rank, needsItem: true, needTag: 'bis',
    reason: 'Ring is BiS · 0 drops this tier',
    ...overrides,
  };
}

// Fixture: four needers ranks 1-4 for slot 'ring' — Bob (rank 2) carries a
// breakdown with a nonzero playerModifier (→ Adjusted + breakdown lines);
// Cara (rank 3) has a matching lootLog ring receipt (→ warning line via
// explainCandidate). Dana (rank 4) exists solely to prove the default
// maxCandidates=3 cutoff.
const alice = makeEntry('a', 'Alice', 1);
const bob = makeEntry('b', 'Bob', 2, { breakdown: bd({ rolePriority: 40, playerModifier: 10 }), score: 140 });
const cara = makeEntry('c', 'Cara', 3);
const dana = makeEntry('d', 'Dana', 4);
const entries = [alice, bob, cara, dana];

const receiptLog: LootLogEntry[] = [{
  id: 1, tierSnapshotId: 't1', weekNumber: 1, floor: 'M9S', itemSlot: 'ring1',
  recipientPlayerId: 'c', recipientPlayerName: 'Cara', method: 'drop', isExtra: false,
  createdAt: '', createdByUserId: 'u1', createdByUsername: 'u',
} as unknown as LootLogEntry];

function blockFor(name: string): HTMLElement {
  return screen.getByText(name).closest('span.block') as HTMLElement;
}

describe('QueueWhy', () => {
  it('renders rank + name for each candidate up to maxCandidates (default 3); a 4th entry is absent', () => {
    render(<QueueWhy entries={entries} slot="ring" lootLog={[]} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Cara')).toBeInTheDocument();
    expect(screen.queryByText('Dana')).not.toBeInTheDocument();
    expect(blockFor('Alice').textContent).toContain('#1');
    expect(blockFor('Bob').textContent).toContain('#2');
    expect(blockFor('Cara').textContent).toContain('#3');
  });

  it('shows "Already received" for the receipt player — warnings ARE shown (kickoff ruling 2)', () => {
    render(<QueueWhy entries={entries} slot="ring" lootLog={receiptLog} />);
    expect(within(blockFor('Cara')).getByText(/Already received/)).toBeInTheDocument();
    expect(within(blockFor('Alice')).queryByText(/Already received/)).not.toBeInTheDocument();
  });

  it('the Adjusted tag renders only for the entry carrying a nonzero breakdown adjustment', () => {
    render(<QueueWhy entries={entries} slot="ring" lootLog={[]} />);
    expect(within(blockFor('Bob')).getByText('Adjusted')).toBeInTheDocument();
    expect(within(blockFor('Alice')).queryByText('Adjusted')).not.toBeInTheDocument();
    expect(within(blockFor('Cara')).queryByText('Adjusted')).not.toBeInTheDocument();
  });

  it('renders breakdown lines ("Role priority", "Priority score") only for entries carrying a breakdown', () => {
    render(<QueueWhy entries={entries} slot="ring" lootLog={[]} />);
    expect(within(blockFor('Bob')).getByText(/Role priority/)).toBeInTheDocument();
    expect(within(blockFor('Bob')).getByText(/Priority score/)).toBeInTheDocument();
    expect(within(blockFor('Alice')).queryByText(/Priority score/)).not.toBeInTheDocument();
  });

  it('shows the "Loot history adjustments active" footer only when enhancedActive is true', () => {
    const { rerender } = render(<QueueWhy entries={entries} slot="ring" lootLog={[]} enhancedActive />);
    expect(screen.getByText('Loot history adjustments active')).toBeInTheDocument();
    rerender(<QueueWhy entries={entries} slot="ring" lootLog={[]} />);
    expect(screen.queryByText('Loot history adjustments active')).not.toBeInTheDocument();
  });
});
