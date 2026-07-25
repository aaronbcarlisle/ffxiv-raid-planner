import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LootHistoryTable } from './LootHistoryTable';
import { DEFAULT_HISTORY_FILTERS } from '../../utils/historyItems';
import type { LootLogEntry, MaterialLogEntry, SnapshotPlayer } from '../../types';

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Aria',
    job: 'WHM',
    role: 'healer',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {},
    weaponPriorities: [],
    ...overrides,
  } as unknown as SnapshotPlayer;
}

function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 2,
    floor: 'M10S',
    itemSlot: 'body',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Aria',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-06-24T12:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'aria',
    ...overrides,
  };
}

function makeMaterialEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 2,
    floor: 'M10S',
    materialType: 'twine',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Aria',
    method: 'drop',
    createdAt: '2026-06-24T12:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'aria',
    ...overrides,
  };
}

const floors = ['M9S', 'M10S', 'M11S', 'M12S'];
const players = [makePlayer()];
const rangeOfWeek = () => null;

function renderTable(overrides: Partial<Parameters<typeof LootHistoryTable>[0]> = {}, initialEntries: string[] = ['/']) {
  const props = {
    lootLog: [],
    materialLog: [],
    players,
    floors,
    filters: DEFAULT_HISTORY_FILTERS,
    currentWeek: 2,
    rangeOfWeek,
    canEdit: true,
    onEdit: vi.fn(),
    onCopyLink: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LootHistoryTable {...props} />
    </MemoryRouter>
  );
}

function openKebab(container: HTMLElement) {
  fireEvent.keyDown(within(container).getByRole('button', { name: 'Entry actions' }), { key: 'Enter' });
}

describe('LootHistoryTable', () => {
  it('groups entries into two week cards with correct counts', () => {
    const lootLog = [
      makeLootEntry({ id: 1, weekNumber: 2 }),
      makeLootEntry({ id: 2, weekNumber: 2 }),
      makeLootEntry({ id: 3, weekNumber: 1 }),
    ];
    renderTable({ lootLog });
    expect(screen.getByText('WEEK 2')).toBeInTheDocument();
    expect(screen.getByText('WEEK 1')).toBeInTheDocument();
    expect(screen.getByText('2 drops')).toBeInTheDocument();
    expect(screen.getByText('1 drop')).toBeInTheDocument();
  });

  it('marks the current-week header with the accent pill', () => {
    const lootLog = [makeLootEntry({ id: 1, weekNumber: 2 }), makeLootEntry({ id: 2, weekNumber: 1 })];
    renderTable({ lootLog, currentWeek: 2 });
    expect(screen.getByText('WEEK 2')).toHaveClass('bg-accent/15', 'text-accent-hover');
    expect(screen.getByText('WEEK 1')).toHaveClass('bg-surface-elevated', 'text-text-secondary');
  });

  it('applies the filters prop to narrow rendered rows', () => {
    const lootLog = [
      makeLootEntry({ id: 1, weekNumber: 2, method: 'drop' }),
      makeLootEntry({ id: 2, weekNumber: 2, method: 'tome' }),
    ];
    renderTable({ lootLog, filters: { ...DEFAULT_HISTORY_FILTERS, source: 'tome' } });
    expect(document.getElementById('loot-entry-2')).toBeInTheDocument();
    expect(document.getElementById('loot-entry-1')).not.toBeInTheDocument();
  });

  it('renders the muted empty line when the filtered set is empty', () => {
    renderTable({ lootLog: [], materialLog: [] });
    expect(screen.getByText('No entries match — log a drop from the Priority view.')).toBeInTheDocument();
  });

  it('renders material rows with the material-entry id', () => {
    const materialLog = [makeMaterialEntry({ id: 5, weekNumber: 2 })];
    renderTable({ materialLog });
    expect(document.getElementById('material-entry-5')).toBeInTheDocument();
  });

  it('fires onEdit with the underlying entry when the kebab Edit item is selected', async () => {
    const onEdit = vi.fn();
    const entry = makeLootEntry({ id: 1, weekNumber: 2 });
    renderTable({ lootLog: [entry], onEdit });
    openKebab(document.getElementById('loot-entry-1')!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(entry);
  });

  describe('deep-link highlight', () => {
    beforeEach(() => {
      // jsdom doesn't implement scrollIntoView.
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('marks the row matching ?entry= as highlight-pulse and clears the param after 2.5s', () => {
      const lootLog = [makeLootEntry({ id: 1, weekNumber: 2 })];
      renderTable({ lootLog }, ['/?entry=1']);

      const row = document.getElementById('loot-entry-1')!;
      expect(row).toHaveClass('highlight-pulse');

      act(() => {
        vi.advanceTimersByTime(2500);
      });

      expect(row).not.toHaveClass('highlight-pulse');
    });

    it('honors entryType=material for the deep link', () => {
      const materialLog = [makeMaterialEntry({ id: 5, weekNumber: 2 })];
      renderTable({ materialLog }, ['/?entry=5&entryType=material']);

      const row = document.getElementById('material-entry-5')!;
      expect(row).toHaveClass('highlight-pulse');
    });

    it('does not highlight when the entry id is not present in the unfiltered log', () => {
      const lootLog = [makeLootEntry({ id: 1, weekNumber: 2 })];
      renderTable({ lootLog }, ['/?entry=999']);
      expect(document.getElementById('loot-entry-1')).not.toHaveClass('highlight-pulse');
    });
  });
});
