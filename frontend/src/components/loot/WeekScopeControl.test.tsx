// `@testing-library/user-event` is not a dependency of this project — every
// existing test in this codebase drives Radix dropdowns via `fireEvent`
// (see `components/roster/RosterToolbar.test.tsx`), so we follow that
// established convention here.
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeekScopeControl, type WeekScopeControlProps } from './WeekScopeControl';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
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
    it('wraps the prev chevron, trigger, next chevron and go-to-current in a shared parent', () => {
      render(<WeekScopeControl {...makeProps()} />);
      const prev = screen.getByRole('button', { name: 'Previous week' });
      const next = screen.getByRole('button', { name: 'Next week' });
      const goToCurrent = screen.getByRole('button', { name: /Go to the current week/ });
      const trigger = screen.getByRole('button', { name: 'This week (Week 3)' });
      expect(prev.parentElement).toBe(next.parentElement);
      expect(prev.parentElement).toBe(goToCurrent.parentElement);
      expect(prev.parentElement).toBe(trigger.parentElement);
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

  describe('Revert week', () => {
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

    it('shows the divergence line only when displayedWeek differs from the clock\'s current week', async () => {
      const clock = makeClock({ currentWeek: 3 });
      const { rerender } = render(
        <WeekScopeControl {...makeProps({ clock, displayedWeek: 3, canEdit: true })} />
      );
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
      expect(await screen.findByText(/Move the clock back to Week 2/)).toBeInTheDocument();
      expect(screen.queryByText(/This acts on the clock/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      rerender(<WeekScopeControl {...makeProps({ clock, displayedWeek: 1, canEdit: true })} />);
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
      expect(
        await screen.findByText("You're viewing Week 1. This acts on the clock — Week 3.")
      ).toBeInTheDocument();
    });

    it('cancels the lightweight confirm without fetching or reverting', async () => {
      const clock = makeClock();
      render(<WeekScopeControl {...makeProps({ clock, canEdit: true })} />);
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
      expect(await screen.findByText(/Move the clock back to Week 2/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(useLootTrackingStore.getState().fetchLootLog).not.toHaveBeenCalled();
      expect(clock.revertWeek).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.queryByText(/Move the clock back to Week 2/)).not.toBeInTheDocument()
      );
    });

    it('the pre-check refetches and, on an empty week, reverts directly without opening the data-summary modal', async () => {
      const onFollowClock = vi.fn();
      const clock = makeClock({ currentWeek: 3 });
      render(<WeekScopeControl {...makeProps({ clock, canEdit: true, onFollowClock, groupId: 'g1', tierId: 't1' })} />);
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
      fireEvent.click(await screen.findByRole('button', { name: 'Revert week' }));

      await waitFor(() => expect(useLootTrackingStore.getState().fetchLootLog).toHaveBeenCalledWith('g1', 't1'));
      expect(useLootTrackingStore.getState().fetchMaterialLog).toHaveBeenCalledWith('g1', 't1');
      expect(useLootTrackingStore.getState().fetchPageLedger).toHaveBeenCalledWith('g1', 't1');

      await waitFor(() => expect(clock.revertWeek).toHaveBeenCalled());
      await waitFor(() => expect(onFollowClock).toHaveBeenCalled());
      // Task 2's itemized modal never appears for an empty week.
      expect(screen.queryByText(/Revert to Week/)).not.toBeInTheDocument();
    });

    it('the pre-check refetches and, on a non-empty week, opens the data-summary modal with the clock\'s week', async () => {
      useLootTrackingStore.setState({
        fetchLootLog: vi.fn().mockImplementation(async () => {
          useLootTrackingStore.setState({ lootLog: [lootEntry({ weekNumber: 3 })] });
        }),
      });
      const clock = makeClock({ currentWeek: 3 });
      render(<WeekScopeControl {...makeProps({ clock, canEdit: true })} />);
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
      fireEvent.click(await screen.findByRole('button', { name: 'Revert week' }));

      expect(await screen.findByText('Revert to Week 2?')).toBeInTheDocument();
      expect(clock.revertWeek).not.toHaveBeenCalled();

      // Confirming Task 2's modal is what actually mutates.
      fireEvent.click(screen.getByRole('button', { name: 'Revert week' }));
      await waitFor(() => expect(clock.revertWeek).toHaveBeenCalled());
    });

    it('a failed pre-check fetch toasts and aborts without mutating or opening the data-summary modal', async () => {
      useLootTrackingStore.setState({
        fetchLootLog: vi.fn().mockRejectedValue(new Error('network down')),
      });
      const clock = makeClock({ currentWeek: 3 });
      render(<WeekScopeControl {...makeProps({ clock, canEdit: true })} />);
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
      fireEvent.click(await screen.findByRole('button', { name: 'Revert week' }));

      await waitFor(() =>
        expect(screen.queryByText(/Move the clock back to Week 2/)).not.toBeInTheDocument()
      );
      expect(screen.queryByText(/Revert to Week/)).not.toBeInTheDocument();
      expect(clock.revertWeek).not.toHaveBeenCalled();
    });

    it('a successful revert (via the data-summary modal) calls onFollowClock, not onWeekChange', async () => {
      useLootTrackingStore.setState({
        fetchLootLog: vi.fn().mockImplementation(async () => {
          useLootTrackingStore.setState({ lootLog: [lootEntry({ weekNumber: 3 })] });
        }),
      });
      const onFollowClock = vi.fn();
      const onWeekChange = vi.fn();
      const clock = makeClock({ currentWeek: 3 });
      render(
        <WeekScopeControl {...makeProps({ clock, canEdit: true, onFollowClock, onWeekChange })} />
      );
      openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
      fireEvent.click(await screen.findByRole('button', { name: 'Revert week' }));
      expect(await screen.findByText('Revert to Week 2?')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Revert week' }));

      await waitFor(() => expect(clock.revertWeek).toHaveBeenCalled());
      await waitFor(() => expect(onFollowClock).toHaveBeenCalled());
      expect(onWeekChange).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByText('Revert to Week 2?')).not.toBeInTheDocument());
    });
  });
});
