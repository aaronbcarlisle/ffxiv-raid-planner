// `@testing-library/user-event` is not a dependency of this project — every
// existing test in this codebase drives Radix dropdowns via `fireEvent`
// (see `components/roster/RosterToolbar.test.tsx`), so we follow that
// established convention here.
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeekScopeControl } from './WeekScopeControl';
import type { WeekClock } from '../../hooks/useWeekClock';

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

function openMenu() {
  fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
}

describe('WeekScopeControl', () => {
  it('labels the trigger "This week (Week N)" when scoped to the current week', () => {
    render(
      <WeekScopeControl clock={makeClock()} scopedWeek={3} onScopedWeekChange={vi.fn()} canEdit={false} />
    );
    expect(screen.getByRole('button', { name: 'This week (Week 3)' })).toBeInTheDocument();
  });

  it('labels the trigger "Week N" when scoped away from the current week', () => {
    render(
      <WeekScopeControl clock={makeClock()} scopedWeek={2} onScopedWeekChange={vi.fn()} canEdit={false} />
    );
    expect(screen.getByRole('button', { name: 'Week 2' })).toBeInTheDocument();
  });

  it('lists weeks maxWeek..1 descending, with UTC-pinned date ranges', async () => {
    render(
      <WeekScopeControl clock={makeClock()} scopedWeek={3} onScopedWeekChange={vi.fn()} canEdit={false} />
    );
    openMenu();
    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(4);
    expect(within(items[0]).getByText(/Week 4/)).toBeInTheDocument();
    expect(within(items[0]).getByText(/Jun 10 – Jun 16/)).toBeInTheDocument();
    expect(within(items[1]).getByText(/Week 3/)).toBeInTheDocument();
    expect(within(items[2]).getByText(/Week 2/)).toBeInTheDocument();
    expect(within(items[3]).getByText(/Week 1/)).toBeInTheDocument();
  });

  it('calls onScopedWeekChange when a week item is selected', async () => {
    const onScopedWeekChange = vi.fn();
    render(
      <WeekScopeControl
        clock={makeClock()}
        scopedWeek={3}
        onScopedWeekChange={onScopedWeekChange}
        canEdit={false}
      />
    );
    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Week 1/ }));
    expect(onScopedWeekChange).toHaveBeenCalledWith(1);
  });

  it('renders data dots for weeks with logged entry types, named in the item title', async () => {
    const clock = makeClock({
      weekDataTypes: new Map([
        [3, ['loot', 'books']],
        [1, ['mats']],
      ]),
    });
    render(<WeekScopeControl clock={clock} scopedWeek={3} onScopedWeekChange={vi.fn()} canEdit={false} />);
    openMenu();
    const items = await screen.findAllByRole('menuitem');
    const week3Item = items.find((i) => /Week 3/.test(i.textContent ?? ''));
    const week1Item = items.find((i) => /Week 1/.test(i.textContent ?? ''));
    expect(week3Item?.querySelector('[title="loot, books"]')).toBeTruthy();
    expect(week1Item?.querySelector('[title="mats"]')).toBeTruthy();
  });

  it('hides "Start next week" / "Revert week" when canEdit is false', async () => {
    render(
      <WeekScopeControl clock={makeClock()} scopedWeek={3} onScopedWeekChange={vi.fn()} canEdit={false} />
    );
    openMenu();
    await screen.findAllByRole('menuitem');
    expect(screen.queryByRole('menuitem', { name: /start next week/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /revert week/i })).not.toBeInTheDocument();
  });

  it('shows "Start next week" / "Revert week" when canEdit is true', async () => {
    render(<WeekScopeControl clock={makeClock()} scopedWeek={3} onScopedWeekChange={vi.fn()} canEdit />);
    openMenu();
    expect(await screen.findByRole('menuitem', { name: /start next week/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /revert week/i })).toBeInTheDocument();
  });

  it('opens a confirm modal for "Start next week" and only advances on confirm', async () => {
    const onScopedWeekChange = vi.fn();
    const clock = makeClock();
    render(
      <WeekScopeControl clock={clock} scopedWeek={3} onScopedWeekChange={onScopedWeekChange} canEdit />
    );
    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /start next week/i }));
    expect(clock.startNextWeek).not.toHaveBeenCalled();
    expect(await screen.findByText(/Advance the week clock to Week 4/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start next week' }));

    await waitFor(() => expect(clock.startNextWeek).toHaveBeenCalled());
    await waitFor(() => expect(onScopedWeekChange).toHaveBeenCalledWith(4));
  });

  it('disables "Revert week" when the current week is 1 (would read "Week 0")', async () => {
    render(
      <WeekScopeControl clock={makeClock({ currentWeek: 1, maxWeek: 1 })} scopedWeek={1} onScopedWeekChange={vi.fn()} canEdit />
    );
    openMenu();
    const revert = await screen.findByRole('menuitem', { name: /revert week/i });
    expect(revert).toHaveAttribute('data-disabled');
  });

  it('opens a confirm modal for "Revert week" and only reverts on confirm', async () => {
    const onScopedWeekChange = vi.fn();
    const clock = makeClock();
    render(
      <WeekScopeControl clock={clock} scopedWeek={3} onScopedWeekChange={onScopedWeekChange} canEdit />
    );
    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
    expect(clock.revertWeek).not.toHaveBeenCalled();
    expect(await screen.findByText(/Move the clock back to Week 2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revert week' }));

    await waitFor(() => expect(clock.revertWeek).toHaveBeenCalled());
    await waitFor(() => expect(onScopedWeekChange).toHaveBeenCalledWith(2));
  });

  it('cancels the revert confirm modal without calling revertWeek', async () => {
    const onScopedWeekChange = vi.fn();
    const clock = makeClock();
    render(
      <WeekScopeControl clock={clock} scopedWeek={3} onScopedWeekChange={onScopedWeekChange} canEdit />
    );
    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /revert week/i }));
    expect(await screen.findByText(/Move the clock back to Week 2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(clock.revertWeek).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText(/Move the clock back to Week 2/)).not.toBeInTheDocument()
    );
  });

  it('does not change scope and closes the modal when the mutation rejects', async () => {
    const onScopedWeekChange = vi.fn();
    const clock = makeClock({ startNextWeek: vi.fn().mockRejectedValue(new Error('nope')) });
    render(
      <WeekScopeControl clock={clock} scopedWeek={3} onScopedWeekChange={onScopedWeekChange} canEdit />
    );
    openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /start next week/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start next week' }));

    await waitFor(() => expect(clock.startNextWeek).toHaveBeenCalled());
    expect(onScopedWeekChange).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText(/Advance the week clock/)).not.toBeInTheDocument()
    );
  });
});
