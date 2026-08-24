import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { WeekCountBar } from './WeekCountBar';
import { TooltipProvider } from '../primitives';
import type { LootLogEntry, SnapshotPlayer } from '../../types';

// Harness (NeedMatrix.test.tsx:12-23 / LogWeekGrid.test.tsx:17-40 shape):
// jsdom has no matchMedia — Tooltip -> useDevice needs it to resolve "can
// hover" so the tile's Tooltip renders normally instead of the touch
// bypass. ResizeObserver is Radix Popper's Arrow-measurement dependency,
// only exercised once a test actually opens a tile's tooltip.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(hover: hover) and (pointer: fine)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// ── Fixture factories — shape modeled on LogWeekGrid.test.tsx's ──

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Alice',
    job: 'WHM',
    role: 'healer',
    position: 'H1',
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
    weekNumber: 2,
    floor: 'Floor 1',
    itemSlot: 'earring',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'gm',
    ...overrides,
  };
}

function renderBar(el: ReactElement) {
  return render(<TooltipProvider>{el}</TooltipProvider>);
}

function tiles() {
  return screen.getAllByTestId('week-count-tile');
}

function tileFor(playerId: string) {
  return tiles().find((t) => t.getAttribute('data-player-id') === playerId)!;
}

describe('WeekCountBar', () => {
  it('renders one tile per main-roster player; substitutes render no tile', () => {
    const main1 = makePlayer({ id: 'p1', name: 'Alice', position: 'T1' });
    const main2 = makePlayer({ id: 'p2', name: 'Bob', position: 'H1' });
    const sub = makePlayer({ id: 's1', name: 'Subby', isSubstitute: true, position: undefined });
    // Noise: a drop for the substitute in a DIFFERENT week — must not
    // manifest as a tile even if the week filter were broken.
    const lootLog = [makeLootEntry({ recipientPlayerId: 's1', weekNumber: 9 })];

    renderBar(<WeekCountBar players={[main1, main2, sub]} lootLog={lootLog} week={2} />);

    const rendered = tiles();
    expect(rendered).toHaveLength(2);
    expect(rendered.map((t) => t.getAttribute('data-player-id')).sort()).toEqual(['p1', 'p2']);
  });

  it('counts are week-scoped (a player with 2 drops in `week` and 3 in other weeks shows 2)', () => {
    const player = makePlayer({ id: 'p1', name: 'Alice', position: 'T1' });
    const lootLog = [
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 2 }),
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 2 }),
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 5 }),
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 5 }),
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 1 }),
    ];

    renderBar(<WeekCountBar players={[player]} lootLog={lootLog} week={2} />);

    expect(within(tileFor('p1')).getByTestId('week-count-value')).toHaveTextContent('2');
  });

  it('order is T1 T2 H1 H2 M1 M2 R1 R2; an unknown-position player sorts last', () => {
    const rTwo = makePlayer({ id: 'r2', name: 'Ranger Two', position: 'R2' });
    const mOne = makePlayer({ id: 'm1', name: 'Melee One', position: 'M1' });
    const unknown = makePlayer({ id: 'u1', name: 'Unknown', position: undefined });
    const hTwo = makePlayer({ id: 'h2', name: 'Healer Two', position: 'H2' });
    const tOne = makePlayer({ id: 't1', name: 'Tank One', position: 'T1' });
    // Deliberately unsorted input — the component must sort itself. Noise
    // drop in another week so a broken filter can't coincidentally pass.
    const lootLog = [makeLootEntry({ recipientPlayerId: 't1', weekNumber: 7 })];

    renderBar(
      <WeekCountBar players={[rTwo, mOne, unknown, hTwo, tOne]} lootLog={lootLog} week={2} />,
    );

    expect(tiles().map((t) => t.getAttribute('data-player-id'))).toEqual(['t1', 'h2', 'm1', 'r2', 'u1']);
  });

  it('color thresholds: counts 4/1/1/0 (avg 1.5) — 4 is info, 0 is warning, 1 is secondary', () => {
    const p1 = makePlayer({ id: 'p1', name: 'Alice', position: 'T1' });
    const p2 = makePlayer({ id: 'p2', name: 'Bob', position: 'H1' });
    const p3 = makePlayer({ id: 'p3', name: 'Cara', position: 'M1' });
    const p4 = makePlayer({ id: 'p4', name: 'Dee', position: 'R1' });
    const lootLog = [
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 2 }),
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 2 }),
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 2 }),
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 2 }),
      makeLootEntry({ recipientPlayerId: 'p2', weekNumber: 2 }),
      makeLootEntry({ recipientPlayerId: 'p3', weekNumber: 2 }),
      // Noise: p4 has drops, but only in another week — must still show 0.
      makeLootEntry({ recipientPlayerId: 'p4', weekNumber: 6 }),
    ];

    renderBar(<WeekCountBar players={[p1, p2, p3, p4]} lootLog={lootLog} week={2} />);

    expect(within(tileFor('p1')).getByTestId('week-count-value').style.color).toBe('var(--color-status-info)');
    expect(within(tileFor('p4')).getByTestId('week-count-value').style.color).toBe('var(--color-status-warning)');
    expect(within(tileFor('p2')).getByTestId('week-count-value').style.color).toBe('var(--color-text-secondary)');
  });

  it('returns null (renders nothing) when the roster is empty AND when it contains only substitutes', () => {
    const { container: emptyContainer } = renderBar(<WeekCountBar players={[]} lootLog={[]} week={2} />);
    expect(emptyContainer.firstChild).toBeNull();

    const sub = makePlayer({ id: 's1', name: 'Subby', isSubstitute: true });
    const { container: subsOnlyContainer } = renderBar(
      <WeekCountBar players={[sub]} lootLog={[]} week={2} />,
    );
    expect(subsOnlyContainer.firstChild).toBeNull();
  });

  it('tile tooltip: name, "{n} drops this week", and "At average" for a tile at the average', async () => {
    const p1 = makePlayer({ id: 'p1', name: 'Alice', position: 'T1' });
    const p2 = makePlayer({ id: 'p2', name: 'Bob', position: 'H1' });
    const lootLog = [
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 2 }),
      makeLootEntry({ recipientPlayerId: 'p2', weekNumber: 2 }),
      // Noise in another week.
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 3 }),
    ];

    renderBar(<WeekCountBar players={[p1, p2]} lootLog={lootLog} week={2} />);
    fireEvent.focus(tileFor('p1'));

    // Radix duplicates open content (visible popup + visually-hidden
    // aria-describedby copy) for non-string content — findAllByText per the
    // LogWeekGrid.test.tsx precedent.
    expect((await screen.findAllByText('Alice')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 drop this week').length).toBeGreaterThan(0);
    expect(screen.getAllByText('At average').length).toBeGreaterThan(0);
  });

  it('no text-[…px] class anywhere in the rendered container (12px floor)', () => {
    const p1 = makePlayer({ id: 'p1', name: 'Alice', position: 'T1' });
    const lootLog = [
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 2 }),
      makeLootEntry({ recipientPlayerId: 'p1', weekNumber: 9 }),
    ];
    const { container } = renderBar(<WeekCountBar players={[p1]} lootLog={lootLog} week={2} />);

    const offenders = container.querySelectorAll('[class*="text-["]');
    expect(offenders.length).toBe(0);
    expect(container.innerHTML).not.toMatch(/text-\[\d+px\]/);
  });
});
