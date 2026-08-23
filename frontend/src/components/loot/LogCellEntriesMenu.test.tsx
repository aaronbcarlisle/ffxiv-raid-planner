import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogCellEntriesMenu } from './LogCellEntriesMenu';
import type { LogGridEntryRef } from './logWeekGridData';
import type { LootLogEntry, MaterialLogEntry, SnapshotPlayer } from '../../types';

// ── Fixture factories — modeled on LogWeekGrid.test.tsx's own factories ──

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Alice',
    job: 'WHM',
    role: 'healer',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {},
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as unknown as SnapshotPlayer;
}

let nextLootId = 1;
function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: nextLootId++,
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'Floor 1',
    itemSlot: 'earring',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-01-01T12:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'gm',
    ...overrides,
  };
}

let nextMaterialId = 1;
function makeMaterialEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id: nextMaterialId++,
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'Floor 2',
    materialType: 'glaze',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    createdAt: '2026-01-01T12:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'gm',
    ...overrides,
  };
}

const refs = (entries: LootLogEntry[]): LogGridEntryRef[] => entries.map((entry) => ({ kind: 'loot', entry }));

const tankOne = makePlayer({ id: 'p1', name: 'Tank One', role: 'tank', job: 'PLD' });
const healerOne = makePlayer({ id: 'p2', name: 'Healer One', role: 'healer', job: 'WHM' });
const playerMap = new Map<string, SnapshotPlayer>([
  ['p1', tankOne],
  ['p2', healerOne],
]);

const e1 = makeLootEntry({
  recipientPlayerId: 'p1', recipientPlayerName: 'Tank One', createdAt: '2026-01-01T12:00:00Z',
});
const e2 = makeLootEntry({
  recipientPlayerId: 'p2', recipientPlayerName: 'Healer One', createdAt: '2026-01-05T12:00:00Z',
});

describe('LogCellEntriesMenu — trigger', () => {
  it('renders the chip trigger with a count-and-cell accessible name', () => {
    render(
      <LogCellEntriesMenu
        entryRefs={refs([e2, e1])}
        playerMap={playerMap}
        cellLabel="Ears"
        floorName="M9S"
        onEdit={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: '2 entries for Ears — M9S' })).toBeInTheDocument();
  });
});

describe('LogCellEntriesMenu — menu contents', () => {
  it('opens (keyDown Enter — the Radix jsdom idiom, Loot.test.tsx:803) and lists entries newest-first', async () => {
    render(
      <LogCellEntriesMenu
        entryRefs={refs([e2, e1])}
        playerMap={playerMap}
        cellLabel="Ears"
        floorName="M9S"
        onEdit={vi.fn()}
      />
    );
    fireEvent.keyDown(screen.getByRole('button', { name: '2 entries for Ears — M9S' }), { key: 'Enter' });
    const items = await screen.findAllByRole('menuitem');
    expect(items[0]).toHaveTextContent('Healer One');
    expect(items[1]).toHaveTextContent('Tank One');
  });

  it('selecting an item calls onEdit with that exact ref', async () => {
    const onEdit = vi.fn();
    render(
      <LogCellEntriesMenu
        entryRefs={refs([e2, e1])}
        playerMap={playerMap}
        cellLabel="Ears"
        floorName="M9S"
        onEdit={onEdit}
      />
    );
    fireEvent.keyDown(screen.getByRole('button', { name: /2 entries/ }), { key: 'Enter' });
    fireEvent.click((await screen.findAllByRole('menuitem'))[1]);
    expect(onEdit).toHaveBeenCalledWith({ kind: 'loot', entry: e1 });
  });

  it('material refs render the augmented slot and date', async () => {
    const m1 = makeMaterialEntry({
      recipientPlayerId: 'p1', recipientPlayerName: 'Tank One', slotAugmented: 'earring', createdAt: '2026-02-03T12:00:00Z',
    });
    const m2 = makeMaterialEntry({
      recipientPlayerId: 'p2', recipientPlayerName: 'Healer One', slotAugmented: null, createdAt: '2026-02-10T12:00:00Z',
    });
    const materialRefs: LogGridEntryRef[] = [
      { kind: 'material', entry: m2 },
      { kind: 'material', entry: m1 },
    ];
    render(
      <LogCellEntriesMenu
        entryRefs={materialRefs}
        playerMap={playerMap}
        cellLabel="Glaze"
        floorName="M9S"
        onEdit={vi.fn()}
      />
    );
    fireEvent.keyDown(screen.getByRole('button', { name: '2 entries for Glaze — M9S' }), { key: 'Enter' });
    const items = await screen.findAllByRole('menuitem');
    expect(items[0]).toHaveTextContent('no slot');
    expect(items[0]).toHaveTextContent('Feb 10');
    expect(items[1]).toHaveTextContent('earring');
    expect(items[1]).toHaveTextContent('Feb 3');
  });

  it('an unresolvable recipient falls back to the stored name', async () => {
    const ghost = makeLootEntry({
      recipientPlayerId: 'ghost', recipientPlayerName: 'Departed Player', createdAt: '2026-01-01T12:00:00Z',
    });
    render(
      <LogCellEntriesMenu
        entryRefs={refs([e2, ghost])}
        playerMap={playerMap}
        cellLabel="Ears"
        floorName="M9S"
        onEdit={vi.fn()}
      />
    );
    fireEvent.keyDown(screen.getByRole('button', { name: '2 entries for Ears — M9S' }), { key: 'Enter' });
    const items = await screen.findAllByRole('menuitem');
    expect(items[1]).toHaveTextContent('Departed Player');
  });
});
