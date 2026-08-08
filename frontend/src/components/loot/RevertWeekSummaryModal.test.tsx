import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RevertWeekSummaryModal } from './RevertWeekSummaryModal';
import type { LootLogEntry, MaterialLogEntry, PageLedgerEntry, SnapshotPlayer } from '../../types';

beforeEach(() => {
  // jsdom has no matchMedia; Modal -> useDevice depends on it.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

function makeLoot(id: number, week: number, overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id,
    tierSnapshotId: 't1',
    weekNumber: week,
    floor: 'M5S',
    itemSlot: 'head',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Player One',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'Leader',
    ...overrides,
  };
}

function makeMaterial(id: number, week: number, overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id,
    tierSnapshotId: 't1',
    weekNumber: week,
    floor: 'M6S',
    materialType: 'twine',
    recipientPlayerId: 'p2',
    recipientPlayerName: 'Player Two',
    method: 'drop',
    createdAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'Leader',
    ...overrides,
  };
}

function makeLedger(id: number, week: number, overrides: Partial<PageLedgerEntry> = {}): PageLedgerEntry {
  return {
    id,
    tierSnapshotId: 't1',
    playerId: 'p1',
    playerName: 'Player One',
    weekNumber: week,
    floor: 'M7S',
    bookType: 'I',
    transactionType: 'earned',
    quantity: 1,
    createdAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'Leader',
    ...overrides,
  };
}

function makePlayer(id: string, name: string): SnapshotPlayer {
  return {
    id,
    tierSnapshotId: 't1',
    name,
    job: 'BLM',
    role: 'caster',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {},
    weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}

const players = [makePlayer('p1', 'Player One'), makePlayer('p2', 'Player Two')];

function baseProps() {
  return {
    isOpen: true,
    week: 5,
    lootLog: [] as LootLogEntry[],
    materialLog: [] as MaterialLogEntry[],
    pageLedger: [] as PageLedgerEntry[],
    players,
    isReverting: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };
}

describe('RevertWeekSummaryModal', () => {
  it('renders the pluralised counts-summary line', () => {
    render(
      <RevertWeekSummaryModal
        {...baseProps()}
        lootLog={[makeLoot(1, 5), makeLoot(2, 5), makeLoot(3, 5)]}
        materialLog={[makeMaterial(1, 5), makeMaterial(2, 5)]}
        pageLedger={[makeLedger(1, 5), makeLedger(2, 5), makeLedger(3, 5), makeLedger(4, 5)]}
      />,
    );
    expect(screen.getByText('3 drops · 2 materials · 4 book entries')).toBeInTheDocument();
  });

  it('singularises each count at exactly 1', () => {
    render(
      <RevertWeekSummaryModal
        {...baseProps()}
        lootLog={[makeLoot(1, 5)]}
        materialLog={[makeMaterial(1, 5)]}
        pageLedger={[makeLedger(1, 5)]}
      />,
    );
    expect(screen.getByText('1 drop · 1 material · 1 book entry')).toBeInTheDocument();
  });

  it('renders each group only when its list is non-empty', () => {
    render(<RevertWeekSummaryModal {...baseProps()} lootLog={[makeLoot(1, 5)]} />);
    expect(screen.getByText('Loot (1)')).toBeInTheDocument();
    expect(screen.queryByText(/^Materials/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Books/)).not.toBeInTheDocument();
  });

  it('renders the Materials group when non-empty, pinning the display-name mapping', () => {
    render(
      <RevertWeekSummaryModal
        {...baseProps()}
        materialLog={[makeMaterial(1, 5, { materialType: 'universal_tomestone' })]}
      />,
    );
    expect(screen.getByText('Materials (1)')).toBeInTheDocument();
    // UPGRADE_MATERIAL_DISPLAY_NAMES mapping, not legacy's charAt(0).toUpperCase() ad-hoc cap.
    expect(screen.getByText(/Universal Tomestone/)).toBeInTheDocument();
    expect(screen.queryByText(/Universal_tomestone/)).not.toBeInTheDocument();
  });

  it('renders the Books group when non-empty, pinning the Unknown player fallback', () => {
    render(
      <RevertWeekSummaryModal
        {...baseProps()}
        pageLedger={[makeLedger(1, 5, { playerId: 'no-such-player' })]}
      />,
    );
    expect(screen.getByText('Books (1)')).toBeInTheDocument();
    expect(screen.getByText(/Unknown/)).toBeInTheDocument();
  });

  it('renders a spent book row as a negative magnitude and an earned row as a signed positive', () => {
    render(
      <RevertWeekSummaryModal
        {...baseProps()}
        pageLedger={[
          makeLedger(1, 5, { bookType: 'I', transactionType: 'spent', quantity: 3 }),
          makeLedger(2, 5, { bookType: 'II', transactionType: 'earned', quantity: 2 }),
        ]}
      />,
    );
    expect(screen.getByText(/Page I \(-3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Page II \(\+2\)/)).toBeInTheDocument();
  });

  it('excludes entries from a different week — from the rows and from the counts line', () => {
    render(
      <RevertWeekSummaryModal
        {...baseProps()}
        lootLog={[makeLoot(1, 5), makeLoot(2, 6)]}
        materialLog={[makeMaterial(1, 5), makeMaterial(2, 6)]}
        pageLedger={[makeLedger(1, 5), makeLedger(2, 6)]}
      />,
    );
    expect(screen.getByText('1 drop · 1 material · 1 book entry')).toBeInTheDocument();
    expect(screen.getByText('Loot (1)')).toBeInTheDocument();
    expect(screen.getByText('Materials (1)')).toBeInTheDocument();
    expect(screen.getByText('Books (1)')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('omits zero-count segments from the counts line instead of printing "0 materials"', () => {
    render(<RevertWeekSummaryModal {...baseProps()} lootLog={[makeLoot(1, 5)]} />);
    expect(screen.getByText('1 drop')).toBeInTheDocument();
    expect(screen.queryByText(/material/)).not.toBeInTheDocument();
    expect(screen.queryByText(/book/)).not.toBeInTheDocument();
  });

  it('renders every row of a long week with no truncation, inside the scroll container', () => {
    const longLoot = Array.from({ length: 23 }, (_, i) => makeLoot(i + 1, 5, { recipientPlayerName: `Player ${i}` }));
    render(<RevertWeekSummaryModal {...baseProps()} lootLog={longLoot} />);
    expect(screen.getByText('Loot (23)')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(23);
    // Regression guard: an earlier draft capped lists at 5 rows with a "+N more" tail.
    expect(screen.queryByText(/more/i)).not.toBeInTheDocument();
    // Modal renders via a portal onto document.body, not the RTL container.
    const scrollContainer = document.body.querySelector('.max-h-64.overflow-y-auto');
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.querySelectorAll('li')).toHaveLength(23);
  });

  it('renders the defensive empty fallback with the confirm button still enabled', () => {
    render(<RevertWeekSummaryModal {...baseProps()} />);
    expect(screen.getByText('Nothing logged for Week 5.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revert week/i })).not.toBeDisabled();
  });

  it('names the two correct weeks in the title and body', () => {
    render(<RevertWeekSummaryModal {...baseProps()} week={7} lootLog={[makeLoot(1, 7)]} />);
    expect(screen.getByText('Revert to Week 6?')).toBeInTheDocument();
    expect(screen.getByText(/Week 7's entries are not deleted/)).toBeInTheDocument();
  });

  it('fires onConfirm and onCancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<RevertWeekSummaryModal {...baseProps()} onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Revert week/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('isReverting disables Cancel and puts Revert week into its loading state', () => {
    render(<RevertWeekSummaryModal {...baseProps()} isReverting />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    const confirmButton = screen.getByRole('button', { name: /Revert week/i });
    expect(confirmButton).toBeDisabled();
    expect(confirmButton.querySelector('[role="status"]')).not.toBeNull();
  });

  it('isReverting blocks Escape and the header close button from cancelling', () => {
    const onCancel = vi.fn();
    render(<RevertWeekSummaryModal {...baseProps()} isReverting onCancel={onCancel} />);

    // Modal attaches its keydown handler to window.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Escape and the header close button still cancel when not reverting', () => {
    const onCancel = vi.fn();
    render(<RevertWeekSummaryModal {...baseProps()} onCancel={onCancel} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('the scroll container is keyboard-reachable with an accessible name', () => {
    render(<RevertWeekSummaryModal {...baseProps()} lootLog={[makeLoot(1, 5)]} />);
    const scrollContainer = screen.getByLabelText('Entries that will move');
    expect(scrollContainer).toHaveAttribute('tabIndex', '0');
  });
});
