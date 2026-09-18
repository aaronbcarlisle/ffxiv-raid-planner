// The three book modals (EditBookBalanceModal / PlayerLedgerModal /
// MarkFloorClearedModal) are reused UNMODIFIED — this suite asserts
// BookLedgerCard's own wiring contract (which props they're opened with, what
// their onSubmit/onHistoryCleared callbacks do), not the modals' internal UI.
// Mocked here, matching the Loot.test.tsx convention for reused leaf surfaces.
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

/** Surfaces the live search string so the param-clearing effect is assertable. */
function LocationProbe() {
  return <div data-testid="location-search">{useLocation().search}</div>;
}

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
  clockWeek: 3,
  canEdit: true,
  onResetConfig: vi.fn(),
};

beforeEach(() => {
  editModalCalls.length = 0;
  ledgerModalCalls.length = 0;
  markClearedCalls.length = 0;
  baseProps.onResetConfig.mockClear();

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
    render(<BookLedgerCard {...baseProps} />, { wrapper: MemoryRouter });

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
    render(<BookLedgerCard {...baseProps} />, { wrapper: MemoryRouter });

    const { fetchPageBalances } = storeActions();
    expect(fetchPageBalances).toHaveBeenCalledWith('g1', 't1', undefined);

    fetchPageBalances.mockClear();
    // R-D7f: with currentWeek === clockWeek (both 3, baseProps) the label is
    // "This week (Week 3)".
    fireEvent.click(screen.getByRole('button', { name: 'This week (Week 3)' }));

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
    render(<BookLedgerCard {...baseProps} />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByRole('button', { name: 'This week (Week 3)' }));

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
    render(<BookLedgerCard {...baseProps} canEdit={false} effectiveUserId="u-alice" />, { wrapper: MemoryRouter });

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
    render(<BookLedgerCard {...baseProps} />, { wrapper: MemoryRouter });

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

  it('adjust-flow error: onSubmit rethrows to the modal handler (modal stays open) and skips the refetch', async () => {
    const { adjustBookBalance, fetchPageBalances } = storeActions();
    adjustBookBalance.mockRejectedValueOnce(new Error('server said no'));
    render(<BookLedgerCard {...baseProps} />, { wrapper: MemoryRouter });

    const aliceRow = document.getElementById('book-row-p1')!;
    fireEvent.click(screen.getAllByText('3').find((el) => aliceRow.contains(el))!);
    fetchPageBalances.mockClear();

    // Call onSubmit the way the real EditBookBalanceModal does: its own error
    // handler awaits it and keeps the modal open on rejection — dropping the
    // rethrow in BookLedgerCard would resolve this promise and close the modal.
    const onSubmit = editModalCalls[editModalCalls.length - 1].onSubmit as (a: number, n?: string) => Promise<void>;
    await expect(onSubmit(5, 'note')).rejects.toThrow('Failed to update');

    // editState was NOT cleared and the success-path refetch never fired.
    expect(screen.getByTestId('edit-book-modal')).toBeInTheDocument();
    expect(fetchPageBalances).not.toHaveBeenCalled();
  });

  it('hides "Mark floor cleared" when canEdit is false; when shown, submit calls markFloorCleared and refetches', async () => {
    const { rerender } = render(<BookLedgerCard {...baseProps} canEdit={false} />, { wrapper: MemoryRouter });
    expect(screen.queryByRole('button', { name: 'Mark floor cleared' })).not.toBeInTheDocument();

    rerender(<BookLedgerCard {...baseProps} canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark floor cleared' }));
    storeActions().fetchPageBalances.mockClear();
    fireEvent.click(screen.getByText('submit-mark-cleared'));

    await vi.waitFor(() => {
      const { markFloorCleared, fetchPageBalances, fetchPageLedger } = storeActions();
      expect(markFloorCleared).toHaveBeenCalledWith('g1', 't1', {
        weekNumber: 3,
        floor: 'M9S',
        playerIds: ['p1'],
      });
      // BOTH halves of the scoped refetch: page balances re-fetched with the
      // card's current scope (default all-time → undefined), plus the ledger.
      expect(fetchPageBalances).toHaveBeenCalledWith('g1', 't1', undefined);
      expect(fetchPageLedger).toHaveBeenCalledWith('g1', 't1');
    });
  });

  // ── D7b (R-14): the row regains its JobIcon ─────────────────────────────
  it("a balance row shows the player's JobIcon beside the name", () => {
    render(<BookLedgerCard {...baseProps} />, { wrapper: MemoryRouter });

    // Alice's fixture job is 'PLD' (makePlayer default) — JobIcon renders an
    // <img alt={job}>, so its accessible name IS the job code.
    const aliceRow = document.getElementById('book-row-p1')!;
    expect(within(aliceRow).getByRole('img', { name: 'PLD' })).toBeInTheDocument();
  });

  it('a balance row whose player is missing from the roster renders the name without an icon', () => {
    // A pageBalances row can outlive its player (e.g. the player was removed
    // from the roster) — playersById.get() then returns undefined, and the
    // row's `player?.job` guard must skip JobIcon entirely rather than throw.
    useLootTrackingStore.setState({
      pageBalances: [...balances, makeBalance('ghost1', 'Ghost')],
    });
    render(<BookLedgerCard {...baseProps} />, { wrapper: MemoryRouter });

    const ghostRow = document.getElementById('book-row-ghost1')!;
    expect(ghostRow).toHaveTextContent('Ghost');
    expect(within(ghostRow).queryByRole('img')).not.toBeInTheDocument();
  });

  // ── R-D7f: the scope-toggle's "This week" label must stay honest once
  // `currentWeek` is the DISPLAYED week (which can diverge from the clock) ──
  it('R-D7f: the scope-toggle label reflects displayed-vs-clock-week divergence', () => {
    const { rerender } = render(
      <BookLedgerCard {...baseProps} currentWeek={3} clockWeek={3} />,
      { wrapper: MemoryRouter },
    );
    // Displayed === clock: "This week (Week N)".
    expect(screen.getByRole('button', { name: 'This week (Week 3)' })).toBeInTheDocument();

    rerender(<BookLedgerCard {...baseProps} currentWeek={1} clockWeek={3} />);
    // Diverged: bare "Week N" — no "This week" claim on a backlogged view.
    expect(screen.getByRole('button', { name: 'Week 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /This week/ })).not.toBeInTheDocument();
  });

  // ── director change-review C-1: adjust and mark-cleared must key off the
  // DISPLAYED week (`currentWeek`), not the clock — proven by driving them
  // apart (baseProps coincide at 3/3, which would pass vacuously) ──
  it('C-1: cell-edit and mark-cleared both write at the DISPLAYED week, not the clock week', async () => {
    render(<BookLedgerCard {...baseProps} currentWeek={1} clockWeek={3} />, { wrapper: MemoryRouter });

    const aliceRow = document.getElementById('book-row-p1')!;
    fireEvent.click(screen.getAllByText('3').find((el) => aliceRow.contains(el))!);
    fireEvent.click(screen.getByText('submit-edit'));

    await vi.waitFor(() => {
      const call = storeActions().adjustBookBalance.mock.calls.at(-1);
      expect(call?.[5]).toBe(1); // the week arg
      expect(call?.[5]).not.toBe(3); // the clock's currentWeek — divergence proof
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mark floor cleared' }));
    expect(markClearedCalls.at(-1)?.currentWeek).toBe(1);
    expect(markClearedCalls.at(-1)?.currentWeek).not.toBe(3);
  });
});

// ── C7 (D-05): the Books deep-link highlight ──
// The roster kebab's "Edit Books" jump writes `?book={playerId}` on this same
// route; the card scrolls that row into view and pulses it, then clears the
// param so a refresh (or a second jump to the same row) isn't a no-op. This is
// the v2 replacement for legacy's `highlightedBookPlayerId` state, which the
// F6d Loot screen deliberately left unbuilt until a navigation produced it.
describe('BookLedgerCard — book deep-link highlight (C7, D-05)', () => {
  // jsdom defines no scrollIntoView at all, so this suite installs one — and
  // puts the prototype back afterwards (deleting it when there was none), so
  // the stub can never leak into a later suite (PR #200 review).
  let originalScrollIntoView: typeof Element.prototype.scrollIntoView | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    if (originalScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
  });

  function renderWithParams(search: string) {
    return render(
      <MemoryRouter initialEntries={[`/group/G1${search}`]}>
        <BookLedgerCard {...baseProps} />
        <LocationProbe />
      </MemoryRouter>
    );
  }

  it('pulses and scrolls the linked row', () => {
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;

    renderWithParams('?book=p1');
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(document.getElementById('book-row-p1')?.className).toContain('highlight-pulse');
    expect(document.getElementById('book-row-p2')?.className).not.toContain('highlight-pulse');
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('clears the param once the pulse has run', () => {
    renderWithParams('?book=p1');

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.getByTestId('location-search').textContent).not.toContain('book=p1');
  });

  it('ignores a book param naming a player with no row', () => {
    renderWithParams('?book=nobody');
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(document.querySelector('.highlight-pulse')).toBeNull();
  });

  it('waits for the balances to arrive before starting the clear clock', () => {
    // The jump navigates Roster → Loot, which mounts this card with an EMPTY
    // pageBalances — the fetch is what fills it. If the clear ran on that
    // empty first render, a fetch slower than 2.5s would delete `book` before
    // the row ever existed: right screen, no highlight, jump unrepeatable
    // (PR #200 review).
    useLootTrackingStore.setState({ pageBalances: [] });
    renderWithParams('?book=p1');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId('location-search').textContent).toContain('book=p1');

    // Balances land late — the highlight still happens.
    act(() => {
      useLootTrackingStore.setState({ pageBalances: balances });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(document.getElementById('book-row-p1')?.className).toContain('highlight-pulse');
  });

  it('still clears a book param that matched no row', () => {
    // Substitutes are filtered out of this card (and a player can be removed
    // between the jump and the landing), so a jump CAN arrive with nothing to
    // highlight. The param must not survive that: it would ride along in every
    // later copied deep link from this route (director C7 finding 1).
    renderWithParams('?book=s1');

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.getByTestId('location-search').textContent).not.toContain('book=');
  });
});

// ── D7b (R-16 4/4): column + row kebabs, follow-the-toggle ─────────────────
// Every reset item's label AND config flip together with the card's own
// `scope` toggle (This week / All time) — the legacy books-menu mechanism,
// re-expressed as ONE item per kebab rather than two.
describe('BookLedgerCard — column + row kebabs (D7b, R-16 4/4)', () => {
  it('column kebab (Book II, floor 2): default "All time" emits a week-less floor config; toggling to "This week" flips label AND config together', () => {
    render(<BookLedgerCard {...baseProps} />, { wrapper: MemoryRouter });

    const kebab = screen.getByRole('button', { name: 'Book II actions' });
    expect(kebab).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.click(kebab);

    // ONE item, never two.
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    expect(screen.getByRole('menuitem', { name: 'Reset ALL Floor 2 books' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reset ALL Floor 2 books' }));
    expect(baseProps.onResetConfig).toHaveBeenCalledWith({ scope: 'floor', target: 'books', floor: 2 });

    baseProps.onResetConfig.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'This week (Week 3)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Book II actions' }));
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    expect(screen.getByRole('menuitem', { name: 'Reset Floor 2 books (Week 3)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reset Floor 2 books (Week 3)' }));
    expect(baseProps.onResetConfig).toHaveBeenCalledWith({
      scope: 'floor', target: 'books', week: 3, floor: 2,
    });
  });

  it('column kebab label/config follow currentWeek, not a hardcoded 3 (anti-vacuous)', () => {
    render(<BookLedgerCard {...baseProps} currentWeek={1} clockWeek={3} />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByRole('button', { name: 'Week 1' })); // scope -> 'week'
    fireEvent.click(screen.getByRole('button', { name: 'Book II actions' }));
    expect(screen.getByRole('menuitem', { name: 'Reset Floor 2 books (Week 1)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reset Floor 2 books (Week 1)' }));
    expect(baseProps.onResetConfig).toHaveBeenCalledWith({
      scope: 'floor', target: 'books', week: 1, floor: 2,
    });
  });

  it('right-clicking a Book column header opens the SAME single item the kebab click does', () => {
    render(<BookLedgerCard {...baseProps} />, { wrapper: MemoryRouter });

    const header = screen.getByText('Book II').closest('th')!;
    fireEvent.contextMenu(header);
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    expect(screen.getByRole('menuitem', { name: 'Reset ALL Floor 2 books' })).toBeInTheDocument();
  });

  it('row kebab (Alice): default "All time" emits a week-less all-scope config naming the player; toggling flips label AND config together', () => {
    render(<BookLedgerCard {...baseProps} />, { wrapper: MemoryRouter });

    const kebab = screen.getByRole('button', { name: 'Alice book actions' });
    expect(kebab).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.click(kebab);
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    expect(screen.getByRole('menuitem', { name: "Reset ALL Alice's books" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: "Reset ALL Alice's books" }));
    expect(baseProps.onResetConfig).toHaveBeenCalledWith({
      scope: 'all', target: 'books', playerId: 'p1', playerName: 'Alice',
    });

    baseProps.onResetConfig.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'This week (Week 3)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alice book actions' }));
    expect(screen.getByRole('menuitem', { name: "Reset Alice's Week 3 books" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: "Reset Alice's Week 3 books" }));
    expect(baseProps.onResetConfig).toHaveBeenCalledWith({
      scope: 'week', target: 'books', week: 3, playerId: 'p1', playerName: 'Alice',
    });
  });

  it("right-clicking Alice's row opens the SAME single item the kebab click does", () => {
    render(<BookLedgerCard {...baseProps} />, { wrapper: MemoryRouter });

    const row = document.getElementById('book-row-p1')!;
    fireEvent.contextMenu(row);
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    expect(screen.getByRole('menuitem', { name: "Reset ALL Alice's books" })).toBeInTheDocument();
  });

  it('canEdit=false: no kebabs render, and right-clicking the header/row opens nothing', () => {
    render(<BookLedgerCard {...baseProps} canEdit={false} />, { wrapper: MemoryRouter });

    expect(screen.queryByRole('button', { name: 'Book II actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alice book actions' })).not.toBeInTheDocument();

    const header = screen.getByText('Book II').closest('th')!;
    fireEvent.contextMenu(header);
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);

    const row = document.getElementById('book-row-p1')!;
    fireEvent.contextMenu(row);
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it("member-own-row (D7-g): canEdit=false + effectiveUserId matching Alice's row still shows NO row kebab", () => {
    render(<BookLedgerCard {...baseProps} canEdit={false} effectiveUserId="u-alice" />, { wrapper: MemoryRouter });

    // Alice's cells are still editable (member-own-row exception) but the
    // bulk-reset kebab gates on `canEdit` alone (never `rowCanEdit`) — no
    // row grants a member a bulk-reset door onto their own ledger.
    expect(screen.queryByRole('button', { name: 'Alice book actions' })).not.toBeInTheDocument();
    const row = document.getElementById('book-row-p1')!;
    fireEvent.contextMenu(row);
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });
});
