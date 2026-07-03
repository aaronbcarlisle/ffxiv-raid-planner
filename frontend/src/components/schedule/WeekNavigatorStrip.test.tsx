// `@testing-library/user-event` is not a dependency of this project — every
// existing test in this codebase drives interactions via `fireEvent` (see
// `components/loot/WeekScopeControl.test.tsx`), so we follow that
// established convention here.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WeekNavigatorStrip } from './WeekNavigatorStrip';
import type { WeekClock } from '../../hooks/useWeekClock';

const clock = {
  currentWeek: 3,
  maxWeek: 3,
  weekStartDate: '2026-06-23',
  weeksWithData: new Set(),
  weekDataTypes: new Map(),
  rangeOfWeek: (w: number) => ({
    start: new Date(Date.UTC(2026, 5, 23 + (w - 1) * 7)),
    end: new Date(Date.UTC(2026, 5, 29 + (w - 1) * 7)),
  }),
  isCurrent: (w: number) => w === 3,
  startNextWeek: vi.fn(),
  revertWeek: vi.fn(),
} as unknown as WeekClock;

const nullAnchorClock = {
  ...clock,
  weekStartDate: null,
  rangeOfWeek: () => null,
} as unknown as WeekClock;

function renderStrip(overrides: Partial<Parameters<typeof WeekNavigatorStrip>[0]> = {}) {
  return render(
    <WeekNavigatorStrip
      clock={clock}
      scopedWeek={3}
      onScopedWeekChange={vi.fn()}
      canManage={false}
      onAddSession={vi.fn()}
      {...overrides}
    />
  );
}

describe('WeekNavigatorStrip', () => {
  it('renders "Week 3", "· this week", and the UTC-pinned range for the current week', () => {
    renderStrip({ scopedWeek: 3 });
    expect(screen.getByText('Week 3')).toBeInTheDocument();
    expect(screen.getByText('· this week')).toBeInTheDocument();
    expect(screen.getByText(/Jul 7 – Jul 13/)).toBeInTheDocument();
  });

  it('renders "Week 2" without "· this week" and the correct range for a non-current scoped week', () => {
    renderStrip({ scopedWeek: 2 });
    expect(screen.getByText('Week 2')).toBeInTheDocument();
    expect(screen.queryByText('· this week')).not.toBeInTheDocument();
    expect(screen.getByText(/Jun 30 – Jul 6/)).toBeInTheDocument();
  });

  it('‹ calls onScopedWeekChange(scopedWeek - 1)', () => {
    const onScopedWeekChange = vi.fn();
    renderStrip({ scopedWeek: 2, onScopedWeekChange });
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(onScopedWeekChange).toHaveBeenCalledWith(1);
  });

  it('› calls onScopedWeekChange(scopedWeek + 1)', () => {
    const onScopedWeekChange = vi.fn();
    renderStrip({ scopedWeek: 2, onScopedWeekChange });
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(onScopedWeekChange).toHaveBeenCalledWith(3);
  });

  it('disables ‹ when scopedWeek <= 1', () => {
    renderStrip({ scopedWeek: 1 });
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeDisabled();
  });

  it('disables › when scopedWeek >= currentWeek + 12', () => {
    renderStrip({ scopedWeek: 15 });
    expect(screen.getByRole('button', { name: 'Next week' })).toBeDisabled();
  });

  it('renders "This week" with no week number and both steppers disabled for a null anchor', () => {
    renderStrip({ clock: nullAnchorClock, scopedWeek: 3 });
    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(screen.queryByText(/Week 3/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next week' })).toBeDisabled();
  });

  it('renders the recurringSummary Tag text when provided', () => {
    renderStrip({ recurringSummary: 'Recurring: Tue/Fri 8:00 PM' });
    expect(screen.getByText('Recurring: Tue/Fri 8:00 PM')).toBeInTheDocument();
  });

  it('does not render the recurringSummary Tag when null/undefined', () => {
    renderStrip({ recurringSummary: null });
    expect(screen.queryByText(/Recurring/)).not.toBeInTheDocument();
  });

  it('hides "Add session" when canManage is false', () => {
    renderStrip({ canManage: false });
    expect(screen.queryByRole('button', { name: 'Add session' })).not.toBeInTheDocument();
  });

  it('shows "Add session" and fires onAddSession when canManage is true', () => {
    const onAddSession = vi.fn();
    renderStrip({ canManage: true, onAddSession });
    const addButton = screen.getByRole('button', { name: 'Add session' });
    fireEvent.click(addButton);
    expect(onAddSession).toHaveBeenCalled();
  });

  it('renders tierLabel in line 2', () => {
    renderStrip({ tierLabel: 'AAC Heavyweight' });
    expect(screen.getByText(/AAC Heavyweight/)).toBeInTheDocument();
  });
});
