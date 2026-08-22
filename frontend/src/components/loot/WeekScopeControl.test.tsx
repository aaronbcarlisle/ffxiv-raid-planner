// `@testing-library/user-event` is not a dependency of this project — every
// existing test in this codebase drives Radix dropdowns via `fireEvent`
// (see `components/roster/RosterToolbar.test.tsx`), so we follow that
// established convention here.
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeekScopeControl, type WeekScopeControlProps } from './WeekScopeControl';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { toast } from '../../stores/toastStore';
import type { WeekClock } from '../../hooks/useWeekClock';
import type { LootLogEntry } from '../../types';

beforeEach(() => {
  // jsdom has no matchMedia; Modal -> useDevice depends on it (ConfirmModal
  // renders a Modal even while `isOpen` is false).
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
    }))
  );

  // The component pulls the pre-check's fetch actions off
  // `useLootTrackingStore.getState()` directly (D-41), so tests drive the
  // real store rather than mocking the module — reset it fresh each test to
  // avoid leaking state/spies across cases.
  useLootTrackingStore.setState({
    lootLog: [],
    materialLog: [],
    pageLedger: [],
    fetchLootLog: vi.fn().mockResolvedValue(undefined),
    fetchMaterialLog: vi.fn().mockResolvedValue(undefined),
    fetchPageLedger: vi.fn().mockResolvedValue(undefined),
  });
});

function makeClock(overrides: Partial<WeekClock> = {}): WeekClock {
  return {
    currentWeek: 3,
    maxWeek: 4,
    weekStartDate: '2026-06-10T00:00:00Z',
    weeksWithData: new Set([1, 3]),
    weekDataTypes: new Map(),
    rangeOfWeek: () => ({ start: new Date('2026-06-10'), end: new Date('2026-06-16T23:59:59Z') }),
    isCurrent: (w: number) => w === 3,
    startNextWeek: vi.fn().mockResolvedValue(4),
    revertWeek: vi.fn().mockResolvedValue(2),
    ...overrides,
  };
}

function makeProps(overrides: Partial<WeekScopeControlProps> = {}): WeekScopeControlProps {
  return {
    clock: makeClock(),
    displayedWeek: 3,
    onWeekChange: vi.fn(),
    onFollowClock: vi.fn(),
    canEdit: false,
    canPrev: true,
    canNext: true,
    groupId: 'group-1',
    tierId: 'tier-1',
    lootLog: [],
    materialLog: [],
    pageLedger: [],
    players: [],
    ...overrides,
  };
}

function lootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 1,
    tierSnapshotId: 'snap-1',
    weekNumber: 3,
    floor: 'M9S',
    itemSlot: 'head',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Tester',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'Tester',
    ...overrides,
  };
}

// The chevrons/go-to-current buttons flank the dropdown trigger, so
// `getByRole('button')` alone is no longer unique — the trigger is the one
// Radix marks `aria-haspopup="menu"`.
function openMenu() {
  const trigger = document.querySelector('[aria-haspopup="menu"]') as HTMLElement;
  fireEvent.keyDown(trigger, { key: 'Enter' });
}

describe('WeekScopeControl', () => {
  it('labels the trigger "This week (Week N)" when displayed at the current week', () => {
    render(<WeekScopeControl {...makeProps({ displayedWeek: 3 })} />);
    expect(screen.getByRole('button', { name: 'This week (Week 3)' })).toBeInTheDocument();
  });

  it('labels the trigger "Week N" when displayed away from the current week', () => {
    render(<WeekScopeControl {...makeProps({ displayedWeek: 2 })} />);
    expect(screen.getByRole('button', { name: 'Week 2' })).toBeInTheDocument();
  });

  it('lists weeks maxWeek..1 descending, with UTC-pinned date ranges', async () => {
    render(<WeekScopeControl {...makeProps()} />);
    openMenu();
    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(4);
    expect(within(items[0]).getByText(/Week 4/)).toBeInTheDocument();
    expect(within(items[0]).getByText(/Jun 10 – Jun 16/)).toBeInTheDocument();
    expect(within(items[1]).getByText(/Week 3/)).toBeInTheDocument();
    expect(within(items[2]).getByText(/Week 2/)).toBeInTheDocument();
    expect(within(items[3]).getByText(/Week 1/)).toBeInTheDocument();
  });

  it('calls onWeekChange when a week item is selected', async () => {
    const onWeekChange = vi.fn();
    render(<WeekScopeControl {...makeProps({ onWeekChange })} />);
    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Week 1/ }));
    expect(onWeekChange).toHaveBeenCalledWith(1);
  });

  it('renders data dots for weeks with logged entry types, named in the item title', async () => {
    const clock = makeClock({
      weekDataTypes: new Map([
        [3, ['loot', 'books']],
        [1, ['mats']],
      ]),
    });
    render(<WeekScopeControl {...makeProps({ clock })} />);
    openMenu();
    const items = await screen.findAllByRole('menuitem');
    const week3Item = items.find((i) => /Week 3/.test(i.textContent ?? ''));
    const week1Item = items.find((i) => /Week 1/.test(i.textContent ?? ''));
    expect(week3Item?.querySelector('[title="loot, books"]')).toBeTruthy();
    expect(week1Item?.querySelector('[title="mats"]')).toBeTruthy();
    // Pins the opt-out from index.css's aria-hidden display-revert rule — without
    // it the dots wrapper loses flex and the h-1.5/w-1.5 dots collapse invisible.
    const dotsWrapper = week3Item?.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(dotsWrapper).toHaveAttribute('role', 'presentation');
  });

  it('hides "Start next week" / "Revert week" when canEdit is false', async () => {
    render(<WeekScopeControl {...makeProps({ canEdit: false })} />);
    openMenu();
    await screen.findAllByRole('menuitem');
    expect(screen.queryByRole('menuitem', { name: /start next week/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /revert week/i })).not.toBeInTheDocument();
  });

  it('canEdit=false still renders the chevrons, trigger and go-to-current controls', () => {
    render(<WeekScopeControl {...makeProps({ canEdit: false })} />);
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to the current week/ })).toBeInTheDocument();
  });

  it('shows "Start next week" / "Revert week" when canEdit is true', async () => {
    render(<WeekScopeControl {...makeProps({ canEdit: true })} />);
    openMenu();
    expect(await screen.findByRole('menuitem', { name: /start next week/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /revert week/i })).toBeInTheDocument();
  });

  describe('chevrons + go-to-current — wrapped as one tight group', () => {
    it('wraps the prev chevron, trigger, next chevron and go-to-current in a shared, non-bare-fragment flex parent', () => {
      // Regression guard: `Dropdown` renders `DropdownMenuPrimitive.Root`,
      // which emits NO DOM of its own, and `DropdownTrigger asChild` makes
      // the trigger `Button` a direct sibling of the chevrons. Under the OLD
      // bare-fragment render, all four controls were direct children of
      // `container` too, so a shared-`parentElement` check alone can't tell
      // the two apart — the `not.toBe(container)` + `flex` class assertions
      // are what actually distinguish "wrapped" from "still a fragment".
      const { container } = render(<WeekScopeControl {...makeProps()} />);
      const prev = screen.getByRole('button', { name: 'Previous week' });
      const next = screen.getByRole('button', { name: 'Next week' });
      const goToCurrent = screen.getByRole('button', { name: /Go to the current week/ });
      const trigger = screen.getByRole('button', { name: 'This week (Week 3)' });

      expect(prev.parentElement).toBe(next.parentElement);
      expect(prev.parentElement).toBe(goToCurrent.parentElement);
      expect(prev.parentElement).toBe(trigger.parentElement);
      expect(prev.parentElement).not.toBe(container);
      expect(prev.parentElement).toHaveClass('flex');
    });

    it('disables Previous week when canPrev is false, and fires onWeekChange(displayedWeek - 1) when enabled', () => {
      const onWeekChange = vi.fn();
      const { rerender } = render(
        <WeekScopeControl {...makeProps({ displayedWeek: 3, canPrev: false, onWeekChange })} />
      );
      expect(screen.getByRole('button', { name: 'Previous week' })).toBeDisabled();

      rerender(<WeekScopeControl {...makeProps({ displayedWeek: 3, canPrev: true, onWeekChange })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
      expect(onWeekChange).toHaveBeenCalledWith(2);
    });

    it('disables Next week when canNext is false, and fires onWeekChange(displayedWeek + 1) when enabled', () => {
      const onWeekChange = vi.fn();
      const { rerender } = render(
        <WeekScopeControl {...makeProps({ displayedWeek: 3, canNext: false, onWeekChange })} />
      );
      expect(screen.getByRole('button', { name: 'Next week' })).toBeDisabled();

      rerender(<WeekScopeControl {...makeProps({ displayedWeek: 3, canNext: true, onWeekChange })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
      expect(onWeekChange).toHaveBeenCalledWith(4);
    });

    it('disables go-to-current when displayedWeek already equals the clock\'s current week', () => {
      render(<WeekScopeControl {...makeProps({ displayedWeek: 3, clock: makeClock({ currentWeek: 3 }) })} />);
      expect(screen.getByRole('button', { name: 'Go to the current week (Week 3)' })).toBeDisabled();
    });

    it('enables go-to-current and fires onFollowClock when displayed diverges from the clock', () => {
      const onFollowClock = vi.fn();
      render(
        <WeekScopeControl
          {...makeProps({ displayedWeek: 1, clock: makeClock({ currentWeek: 3 }), onFollowClock })}
        />
      );
      const button = screen.getByRole('button', { name: 'Go to the current week (Week 3)' });
      expect(button).not.toBeDisabled();
      fireEvent.click(button);
      expect(onFollowClock).toHaveBeenCalled();
    });
  });

  describe('Start next week', () => {
    it('opens a confirm modal and only advances the clock on confirm, calling onFollowClock (not onWeekChange)', async () => {
      const onFollowClock = vi.fn();
      const onWeekChange = vi.fn();
      const clock = makeClock();
      render(<WeekScopeControl {...makeProps({ clock, canEdit: true, onFollowClock, onWeekChange })} />);
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /start next week/i }));
      expect(clock.startNextWeek).not.toHaveBeenCalled();
      expect(await screen.findByText(/Advance the week clock to Week 4/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Start next week' }));

      await waitFor(() => expect(clock.startNextWeek).toHaveBeenCalled());
      await waitFor(() => expect(onFollowClock).toHaveBeenCalled());
      expect(onWeekChange).not.toHaveBeenCalled();
    });

    it('does not mutate and closes the modal when the mutation rejects', async () => {
      const onFollowClock = vi.fn();
      const clock = makeClock({ startNextWeek: vi.fn().mockRejectedValue(new Error('nope')) });
      render(<WeekScopeControl {...makeProps({ clock, canEdit: true, onFollowClock })} />);
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /start next week/i }));
      fireEvent.click(await screen.findByRole('button', { name: 'Start next week' }));

      await waitFor(() => expect(clock.startNextWeek).toHaveBeenCalled());
      expect(onFollowClock).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.queryByText(/Advance the week clock/)).not.toBeInTheDocument()
      );
    });

    it('shows the divergence line only when displayedWeek differs from the clock\'s current week', async () => {
      const clock = makeClock({ currentWeek: 3 });
      const { rerender } = render(
        <WeekScopeControl {...makeProps({ clock, displayedWeek: 3, canEdit: true })} />
      );
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /start next week/i }));
      expect(await screen.findByText(/Advance the week clock to Week 4/)).toBeInTheDocument();
      expect(
        screen.queryByText(/This acts on the clock/)
      ).not.toBeInTheDocument();

      // Close and reopen scoped to a different displayed week.
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      rerender(<WeekScopeControl {...makeProps({ clock, displayedWeek: 1, canEdit: true })} />);
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /start next week/i }));
      expect(
        await screen.findByText("You're viewing Week 1. This acts on the clock — Week 3.")
      ).toBeInTheDocument();
    });
  });

  describe('Revert week — one confirmation per path (director-ruled)', () => {
    it('disables the dropdown item when the current week is 1 (would read "Week 0")', async () => {
      render(
        <WeekScopeControl
          {...makeProps({ clock: makeClock({ currentWeek: 1, maxWeek: 1 }), displayedWeek: 1, canEdit: true })}
        />
      );
      openMenu();
      const revert = await screen.findByRole('menuitem', { name: /revert week/i });
      expect(revert).toHaveAttribute('data-disabled');
    });

    it('fires the pre-check directly from the dropdown item — no intermediate confirm before the fetch', async () => {
      const clock = makeClock({ currentWeek: 3 });
      render(<WeekScopeControl {...makeProps({ clock, canEdit: true, groupId: 'g1', tierId: 't1' })} />);
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));

      await waitFor(() => expect(useLootTrackingStore.getState().fetchLootLog).toHaveBeenCalledWith('g1', 't1'));
      expect(useLootTrackingStore.getState().fetchMaterialLog).toHaveBeenCalledWith('g1', 't1');
      expect(useLootTrackingStore.getState().fetchPageLedger).toHaveBeenCalledWith('g1', 't1');
    });

    describe('empty week — the lightweight ConfirmModal is the only confirmation', () => {
      it('opens after the pre-check settles, and the itemized summary modal never appears', async () => {
        const clock = makeClock({ currentWeek: 3 });
        render(<WeekScopeControl {...makeProps({ clock, canEdit: true })} />);
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));

        expect(await screen.findByText(/Move the clock back to Week 2/)).toBeInTheDocument();
        expect(clock.revertWeek).not.toHaveBeenCalled();
        expect(screen.queryByText(/Revert to Week/)).not.toBeInTheDocument();
      });

      it('shows the divergence line only when displayedWeek differs from the clock\'s current week', async () => {
        const clock = makeClock({ currentWeek: 3 });
        render(<WeekScopeControl {...makeProps({ clock, displayedWeek: 3, canEdit: true })} />);
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
        expect(await screen.findByText(/Move the clock back to Week 2/)).toBeInTheDocument();
        expect(screen.queryByText(/This acts on the clock/)).not.toBeInTheDocument();
      });

      it('shows the divergence line when displayedWeek diverges from the clock', async () => {
        const clock = makeClock({ currentWeek: 3 });
        render(<WeekScopeControl {...makeProps({ clock, displayedWeek: 1, canEdit: true })} />);
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
        expect(
          await screen.findByText("You're viewing Week 1. This acts on the clock — Week 3.")
        ).toBeInTheDocument();
      });

      it('cancels without reverting', async () => {
        const clock = makeClock();
        render(<WeekScopeControl {...makeProps({ clock, canEdit: true })} />);
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
        expect(await screen.findByText(/Move the clock back to Week 2/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(clock.revertWeek).not.toHaveBeenCalled();
        await waitFor(() =>
          expect(screen.queryByText(/Move the clock back to Week 2/)).not.toBeInTheDocument()
        );
      });

      it('confirming reverts and calls onFollowClock, not onWeekChange', async () => {
        const onFollowClock = vi.fn();
        const onWeekChange = vi.fn();
        const clock = makeClock({ currentWeek: 3 });
        render(
          <WeekScopeControl {...makeProps({ clock, canEdit: true, onFollowClock, onWeekChange })} />
        );
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
        fireEvent.click(await screen.findByRole('button', { name: 'Revert week' }));

        await waitFor(() => expect(clock.revertWeek).toHaveBeenCalled());
        await waitFor(() => expect(onFollowClock).toHaveBeenCalled());
        expect(onWeekChange).not.toHaveBeenCalled();
      });
    });

    describe('non-empty week — the data-summary modal is the only confirmation', () => {
      function seedNonEmptyWeek(entry: LootLogEntry) {
        useLootTrackingStore.setState({
          fetchLootLog: vi.fn().mockImplementation(async () => {
            useLootTrackingStore.setState({ lootLog: [entry] });
          }),
        });
      }

      it('opens with the clock\'s week, and the lightweight confirm never appears', async () => {
        seedNonEmptyWeek(lootEntry({ weekNumber: 3 }));
        const clock = makeClock({ currentWeek: 3 });
        render(<WeekScopeControl {...makeProps({ clock, canEdit: true })} />);
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));

        expect(await screen.findByText('Revert to Week 2?')).toBeInTheDocument();
        expect(clock.revertWeek).not.toHaveBeenCalled();
        expect(screen.queryByText(/Move the clock back to Week 2/)).not.toBeInTheDocument();
      });

      it('forwards the seeded entry through props to the itemized list — not just the store (Important 4)', async () => {
        // The pre-check refetches into the STORE, but the modal is fed the
        // component's `lootLog` PROP — seed both, matching what Task 4's
        // real wiring does (the store selector IS the prop at the call
        // site), so this fails if the data props stop being forwarded to
        // RevertWeekSummaryModal and it silently falls back to "Nothing
        // logged for Week 3."
        const seeded = lootEntry({ weekNumber: 3, recipientPlayerName: 'Alsbet' });
        seedNonEmptyWeek(seeded);
        const clock = makeClock({ currentWeek: 3 });
        render(<WeekScopeControl {...makeProps({ clock, canEdit: true, lootLog: [seeded] })} />);
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));

        expect(await screen.findByText('Revert to Week 2?')).toBeInTheDocument();
        expect(screen.getByText('1 drop')).toBeInTheDocument();
        expect(screen.getByText(/Alsbet/)).toBeInTheDocument();
        expect(screen.queryByText(/Nothing logged/)).not.toBeInTheDocument();
      });

      it('carries the divergence line via the notice prop only when diverged', async () => {
        seedNonEmptyWeek(lootEntry({ weekNumber: 3 }));
        const clock = makeClock({ currentWeek: 3 });
        render(<WeekScopeControl {...makeProps({ clock, displayedWeek: 1, canEdit: true })} />);
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));

        expect(await screen.findByText('Revert to Week 2?')).toBeInTheDocument();
        expect(
          await screen.findByText("You're viewing Week 1. This acts on the clock — Week 3.")
        ).toBeInTheDocument();
      });

      it('omits the notice when not diverged', async () => {
        seedNonEmptyWeek(lootEntry({ weekNumber: 3 }));
        const clock = makeClock({ currentWeek: 3 });
        render(<WeekScopeControl {...makeProps({ clock, displayedWeek: 3, canEdit: true })} />);
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));

        expect(await screen.findByText('Revert to Week 2?')).toBeInTheDocument();
        expect(screen.queryByText(/This acts on the clock/)).not.toBeInTheDocument();
      });

      it('confirming reverts and calls onFollowClock, not onWeekChange', async () => {
        seedNonEmptyWeek(lootEntry({ weekNumber: 3 }));
        const onFollowClock = vi.fn();
        const onWeekChange = vi.fn();
        const clock = makeClock({ currentWeek: 3 });
        render(
          <WeekScopeControl {...makeProps({ clock, canEdit: true, onFollowClock, onWeekChange })} />
        );
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
        expect(await screen.findByText('Revert to Week 2?')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Revert week' }));

        await waitFor(() => expect(clock.revertWeek).toHaveBeenCalled());
        await waitFor(() => expect(onFollowClock).toHaveBeenCalled());
        expect(onWeekChange).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.queryByText('Revert to Week 2?')).not.toBeInTheDocument());
      });

      it('confirming twice only reverts once (m6 double-click guard)', async () => {
        seedNonEmptyWeek(lootEntry({ weekNumber: 3 }));
        const clock = makeClock({ currentWeek: 3 });
        render(<WeekScopeControl {...makeProps({ clock, canEdit: true })} />);
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
        expect(await screen.findByText('Revert to Week 2?')).toBeInTheDocument();

        const confirmButton = screen.getByRole('button', { name: 'Revert week' });
        fireEvent.click(confirmButton);
        fireEvent.click(confirmButton);

        await waitFor(() => expect(clock.revertWeek).toHaveBeenCalledTimes(1));
      });
    });

    describe('tier-identity guard — a static/tier switch mid-pre-check', () => {
      /** A pre-check whose loot fetch parks until the returned `release` is
       *  called — the in-flight window the tier switch has to land inside. */
      function gatedPreCheck() {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const fetchLootLog = vi.fn().mockImplementation(async () => {
          await gate;
        });
        useLootTrackingStore.setState({ fetchLootLog });
        return { release: () => release(), fetchLootLog };
      }

      /** Drain the continuation's microtask chain (mock → Promise.all → the
       *  code after the await) inside act, so React state settles. */
      async function flush() {
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
        });
      }

      it('drops the continuation: no modal opens and revertWeek is never called', async () => {
        // Seeded so that WITHOUT the guard the summary modal would open — the
        // control below proves this harness really can produce one.
        useLootTrackingStore.setState({ lootLog: [lootEntry({ weekNumber: 3 })] });
        const { release } = gatedPreCheck();
        const clock = makeClock({ currentWeek: 3 });
        const { rerender } = render(
          <WeekScopeControl {...makeProps({ clock, canEdit: true, groupId: 'g1', tierId: 't1' })} />
        );
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
        await waitFor(() =>
          expect(useLootTrackingStore.getState().fetchLootLog).toHaveBeenCalledWith('g1', 't1')
        );

        // The user reaches the TopBar tier selector while the fetches are
        // still parked — nothing on screen blocks them.
        rerender(
          <WeekScopeControl {...makeProps({ clock, canEdit: true, groupId: 'g1', tierId: 't2' })} />
        );
        release();
        await flush();

        expect(screen.queryByText('Revert to Week 2?')).not.toBeInTheDocument();
        expect(screen.queryByText(/Move the clock back to Week 2/)).not.toBeInTheDocument();
        expect(clock.revertWeek).not.toHaveBeenCalled();
      });

      it('releases isReverting, so a Revert on the NEW tier still reaches the fetches', async () => {
        const { release, fetchLootLog } = gatedPreCheck();
        const clock = makeClock({ currentWeek: 3 });
        const { rerender } = render(
          <WeekScopeControl {...makeProps({ clock, canEdit: true, groupId: 'g1', tierId: 't1' })} />
        );
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
        await waitFor(() => expect(fetchLootLog).toHaveBeenCalledTimes(1));

        rerender(
          <WeekScopeControl {...makeProps({ clock, canEdit: true, groupId: 'g1', tierId: 't2' })} />
        );
        release();
        await flush();

        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));

        // A stuck guard would swallow this click entirely.
        await waitFor(() => expect(fetchLootLog).toHaveBeenCalledTimes(2));
        expect(fetchLootLog).toHaveBeenLastCalledWith('g1', 't2'); // the NEW tier
      });

      it('a groupId switch is caught too, not just tierId', async () => {
        useLootTrackingStore.setState({ lootLog: [lootEntry({ weekNumber: 3 })] });
        const { release } = gatedPreCheck();
        const clock = makeClock({ currentWeek: 3 });
        const { rerender } = render(
          <WeekScopeControl {...makeProps({ clock, canEdit: true, groupId: 'g1', tierId: 't1' })} />
        );
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));

        rerender(
          <WeekScopeControl {...makeProps({ clock, canEdit: true, groupId: 'g2', tierId: 't1' })} />
        );
        release();
        await flush();

        expect(screen.queryByText('Revert to Week 2?')).not.toBeInTheDocument();
        expect(clock.revertWeek).not.toHaveBeenCalled();
      });

      it('CONTROL: the same harness with NO switch still opens the summary modal', async () => {
        // Without this, the three tests above could be passing because the
        // gated harness never produces a modal at all.
        useLootTrackingStore.setState({ lootLog: [lootEntry({ weekNumber: 3 })] });
        const { release } = gatedPreCheck();
        const clock = makeClock({ currentWeek: 3 });
        render(
          <WeekScopeControl
            {...makeProps({ clock, canEdit: true, groupId: 'g1', tierId: 't1', lootLog: [lootEntry({ weekNumber: 3 })] })}
          />
        );
        openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));

        release();
        await flush();

        expect(await screen.findByText('Revert to Week 2?')).toBeInTheDocument();
      });
    });

    it('a failed pre-check fetch toasts, aborts without mutating or opening any modal, and releases isReverting for the next attempt', async () => {
      const fetchLootLog = vi
        .fn()
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValue(undefined);
      useLootTrackingStore.setState({ fetchLootLog });
      const errorSpy = vi.spyOn(toast, 'error');
      const clock = makeClock({ currentWeek: 3 });
      render(<WeekScopeControl {...makeProps({ clock, canEdit: true })} />);
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));

      await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Failed to check week data'));
      expect(screen.queryByText(/Move the clock back to Week 2/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Revert to Week/)).not.toBeInTheDocument();
      expect(clock.revertWeek).not.toHaveBeenCalled();

      // isReverting must have been released — a second attempt still has to
      // reach the fetch, not be swallowed by a stuck re-entrancy guard.
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
      await waitFor(() => expect(fetchLootLog).toHaveBeenCalledTimes(2));
    });
  });
});
