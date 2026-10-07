import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ lootLog: [] as unknown[], pageLedger: [] as unknown[], currentWeek: 3 }));
vi.mock('../../stores/lootTrackingStore', () => ({
  useLootTrackingStore: (s: (x: { lootLog: unknown[]; pageLedger: unknown[]; currentWeek: number }) => unknown) =>
    s({ lootLog: mocks.lootLog, pageLedger: mocks.pageLedger, currentWeek: mocks.currentWeek }),
}));
vi.mock('../../gamedata/raid-tiers', () => ({ getTierById: () => ({ floors: ['M9S', 'M12S'] }) }));
import { WeeklyLootSummaryCard } from './WeeklyLootSummaryCard';

describe('WeeklyLootSummaryCard', () => {
  it('lists each fight and fires onLogWeek', () => {
    const onLogWeek = vi.fn();
    render(<WeeklyLootSummaryCard tierId="t1" canManage onLogWeek={onLogWeek} />);
    expect(screen.getByText('M9S')).toBeInTheDocument();
    expect(screen.getByText('M12S')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /log this week's loot/i }));
    expect(onLogWeek).toHaveBeenCalledTimes(1);
  });

  it('gives a non-manager "View loot priority" instead of the log button (R-R1-1)', () => {
    const onLogWeek = vi.fn();
    render(<WeeklyLootSummaryCard tierId="t1" canManage={false} onLogWeek={onLogWeek} />);
    expect(screen.queryByRole('button', { name: /log this week's loot/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View loot priority' }));
    expect(onLogWeek).toHaveBeenCalledTimes(1);
  });

  it('shows cleared status and drop counts honestly', () => {
    mocks.lootLog = [
      { floor: 'M9S', weekNumber: 3 },
      { floor: 'M9S', weekNumber: 3 },
    ];
    mocks.pageLedger = [{ floor: 'M9S', weekNumber: 3, transactionType: 'earned' }];
    render(<WeeklyLootSummaryCard tierId="t1" canManage onLogWeek={vi.fn()} />);
    // M9S is cleared with 2 drops
    expect(screen.getByText(/cleared · 2 drops/i)).toBeInTheDocument();
    // M12S has no clear and no drops → in progress
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
    // total drops in the header
    expect(screen.getByText(/2 drops logged/i)).toBeInTheDocument();
  });
});
