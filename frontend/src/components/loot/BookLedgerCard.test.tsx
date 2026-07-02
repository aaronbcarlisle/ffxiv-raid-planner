// The three book modals (EditBookBalanceModal / PlayerLedgerModal /
// MarkFloorClearedModal) are reused UNMODIFIED — this suite asserts
// BookLedgerCard's own wiring contract (which props they're opened with, what
// their onSubmit/onHistoryCleared callbacks do), not the modals' internal UI.
// Mocked here, matching the Loot.test.tsx convention for reused leaf surfaces.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { SnapshotPlayer, PageBalance, PageLedgerEntry } from '../../types';

const { editModalCalls, ledgerModalCalls, markClearedCalls } = vi.hoisted(() => ({
  editModalCalls: [] as Array<Record<string, unknown>>,
  ledgerModalCalls: [] as Array<Record<string, unknown>>,
  markClearedCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock('../history/EditBookBalanceModal', () => ({
  EditBookBalanceModal: (props: Record<string, unknown>) => {
    editModalCalls.push(props);
    if (!props.isOpen) return null;
    return (
      <div data-testid="edit-book-modal">
        <button onClick={() => (props.onSubmit as (a: number, n?: string) => Promise<void>)(5, 'note')}>
          submit-edit
        </button>
      </div>
    );
  },
}));

vi.mock('../history/PlayerLedgerModal', () => ({
  PlayerLedgerModal: (props: Record<string, unknown>) => {
    ledgerModalCalls.push(props);
    if (!props.isOpen) return null;
    return (
      <div data-testid="ledger-modal">
        <button onClick={() => (props.onHistoryCleared as () => void)()}>clear-history</button>
      </div>
    );
  },
}));

vi.mock('../history/MarkFloorClearedModal', () => ({
  MarkFloorClearedModal: (props: Record<string, unknown>) => {
    markClearedCalls.push(props);
    if (!props.isOpen) return null;
    return (
      <div data-testid="mark-cleared-modal">
        <button
          onClick={() =>
            (props.onSubmit as (r: unknown) => Promise<void>)({
              weekNumber: 3,
              floor: 'M9S',
              playerIds: ['p1'],
            })
          }
        >
          submit-mark-cleared
        </button>
      </div>
    );
  },
}));

import { BookLedgerCard } from './BookLedgerCard';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';

function makePlayer(id: string, name: string, opts: { sub?: boolean; userId?: string } = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: opts.sub ?? false,
    userId: opts.userId,
    gear: [], tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}

function makeBalance(playerId: string, playerName: string, overrides: Partial<PageBalance> = {}): PageBalance {
  return { playerId, playerName, bookI: 1, bookII: 2, bookIII: 3, bookIV: 4, ...overrides };
}

const players = [makePlayer('p1', 'Alice', { userId: 'u-alice' }), makePlayer('p2', 'Bob'), makePlayer('s1', 'Sub', { sub: true })];
const balances = [makeBalance('p1', 'Alice'), makeBalance('p2', 'Bob'), makeBalance('s1', 'Sub')];

const baseProps = {
  groupId: 'g1',
  tierId: 't1',
  players,
  floors: ['M9S', 'M10S', 'M11S', 'M12S'],
  currentWeek: 3,
  canEdit: true,
};

beforeEach(() => {
  editModalCalls.length = 0;
  ledgerModalCalls.length = 0;
  markClearedCalls.length = 0;

  // Seed pageBalances and stub every store action BookLedgerCard calls —
  // unstubbed actions fire real fetches that fail CI (see Loot.test.tsx).
  useLootTrackingStore.setState({
    pageBalances: balances,
    fetchPageBalances: vi.fn().mockResolvedValue(undefined),
    adjustBookBalance: vi.fn().mockResolvedValue(undefined),
    markFloorCleared: vi.fn().mockResolvedValue(undefined),
    fetchPageLedger: vi.fn().mockResolvedValue(undefined),
  });
});

/** Read the current (per-test) mocked store actions for assertions. */
function storeActions() {
  const { fetchPageBalances, adjustBookBalance, markFloorCleared, fetchPageLedger } = useLootTrackingStore.getState();
  return {
    fetchPageBalances: fetchPageBalances as ReturnType<typeof vi.fn>,
    adjustBookBalance: adjustBookBalance as ReturnType<typeof vi.fn>,
    markFloorCleared: markFloorCleared as ReturnType<typeof vi.fn>,
    fetchPageLedger: fetchPageLedger as ReturnType<typeof vi.fn>,
  };
}

describe('BookLedgerCard', () => {
  it('renders a row per non-substitute player with all four book balances; the sub row is absent', () => {
    render(<BookLedgerCard {...baseProps} />);

    const aliceRow = document.getElementById('book-row-p1');
    expect(aliceRow).toBeInTheDocument();
    expect(aliceRow).toHaveTextContent('Alice');

    const bobRow = document.getElementById('book-row-p2');
    expect(bobRow).toBeInTheDocument();

    expect(document.getElementById('book-row-s1')).not.toBeInTheDocument();

    // Four book balances shown for Alice's row (1, 2, 3, 4).
    expect(aliceRow).toHaveTextContent('1');
    expect(aliceRow).toHaveTextContent('2');
    expect(aliceRow).toHaveTextContent('3');
    expect(aliceRow).toHaveTextContent('4');
  });

  it('fetches all-time balances by default, then week-scoped balances after toggling scope', () => {
    render(<BookLedgerCard {...baseProps} />);

    const { fetchPageBalances } = storeActions();
    expect(fetchPageBalances).toHaveBeenCalledWith('g1', 't1', undefined);

    fetchPageBalances.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'This week' }));

    expect(fetchPageBalances).toHaveBeenCalledWith('g1', 't1', 3);
  });

  it('re-fetches SCOPED balances after any pageLedger mutation while scoped to "This week"', () => {
    // Discriminator for the unscoped-refetch bug: clearWeekPageLedger /
    // clearAllPageLedger (lootTrackingStore.ts) internally call
    // `fetchPageBalances(groupId, tierId)` UNSCOPED as part of their own
    // refresh, which would overwrite `pageBalances` with all-time data while
    // this card still shows "This week". Every ledger mutation (reset, adjust,
    // mark-cleared) refetches `pageLedger` — simulating that reference change
    // directly must re-fire OUR scoped fetch, landing last and correcting it.
    render(<BookLedgerCard {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'This week' }));

    const { fetchPageBalances } = storeActions();
    fetchPageBalances.mockClear();

    act(() => {
      useLootTrackingStore.setState({
        pageLedger: [{ id: 99 } as unknown as PageLedgerEntry],
      });
    });

    expect(fetchPageBalances).toHaveBeenCalledWith('g1', 't1', 3);
  });

  it('member (canEdit false) sees buttons only on their own row; other rows are plain text', () => {
    render(<BookLedgerCard {...baseProps} canEdit={false} effectiveUserId="u-alice" />);

    const aliceRow = document.getElementById('book-row-p1')!;
    const bobRow = document.getElementById('book-row-p2')!;

    // Alice owns u-alice: her four balance cells are buttons.
    expect(aliceRow.querySelectorAll('button').length).toBeGreaterThanOrEqual(4);
    // Bob's row has no adjust buttons (only the ledger icon button, which is
    // always present) — its balance cells render as plain text.
    const bobButtons = Array.from(bobRow.querySelectorAll('button'));
    const bobAdjustButtons = bobButtons.filter((btn) => /^\d+$/.test(btn.textContent ?? ''));
    expect(bobAdjustButtons).toHaveLength(0);
  });

  it('cell click opens EditBookBalanceModal with the right bookType/currentBalance; submit calls adjustBookBalance with the delta', async () => {
    render(<BookLedgerCard {...baseProps} />);

    const aliceRow = document.getElementById('book-row-p1')!;
    // Book III cell for Alice shows "3".
    fireEvent.click(screen.getAllByText('3').find((el) => aliceRow.contains(el))!);

    const lastCall = editModalCalls[editModalCalls.length - 1];
    expect(lastCall.bookType).toBe('III');
    expect(lastCall.currentBalance).toBe(3);
    expect(lastCall.playerName).toBe('Alice');

    fireEvent.click(screen.getByText('submit-edit'));

    await vi.waitFor(() => {
      expect(storeActions().adjustBookBalance).toHaveBeenCalledWith('g1', 't1', 'p1', 'III', 5, 3, 'note');
    });
  });

  it('hides "Mark floor cleared" when canEdit is false; when shown, submit calls markFloorCleared and refetches', async () => {
    const { rerender } = render(<BookLedgerCard {...baseProps} canEdit={false} />);
    expect(screen.queryByRole('button', { name: 'Mark floor cleared' })).not.toBeInTheDocument();

    rerender(<BookLedgerCard {...baseProps} canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark floor cleared' }));
    fireEvent.click(screen.getByText('submit-mark-cleared'));

    await vi.waitFor(() => {
      const { markFloorCleared, fetchPageLedger } = storeActions();
      expect(markFloorCleared).toHaveBeenCalledWith('g1', 't1', {
        weekNumber: 3,
        floor: 'M9S',
        playerIds: ['p1'],
      });
      expect(fetchPageLedger).toHaveBeenCalledWith('g1', 't1');
    });
  });
});
