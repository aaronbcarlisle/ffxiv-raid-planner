// `@testing-library/user-event` is not a dependency of this project, so we drive
// interaction via `fireEvent` (the established convention). This suite mocks the
// heavy leaf surfaces (FloorCard, RecipientPicker, LogWeekWizard,
// QuickLogMaterialModal, WeaponPriorityBridge, WeekScopeControl) so we assert
// only the Loot assembly's own contract: header + subtitle, four floor cards in
// F4→F1 order at the scoped week, the editor toolbar, and the assign/log picker
// wiring. `useWeekClock` is left REAL (reads the seeded loot store).
import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { StaticGroup, TierSnapshot, SnapshotPlayer } from '../../types';

// Capture buckets shared with the hoisted mocks.
const { floorCardCalls, pickerCalls, weekScopeCalls } = vi.hoisted(() => ({
  floorCardCalls: [] as Array<Record<string, unknown>>,
  pickerCalls: [] as Array<Record<string, unknown>>,
  weekScopeCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock('./FloorCard', () => ({
  FloorCard: (props: Record<string, unknown>) => {
    floorCardCalls.push(props);
    return <div data-testid="floor-card" data-floor={String(props.floorNumber)} data-scoped={String(props.scopedWeek)} />;
  },
}));

vi.mock('./RecipientPicker', () => ({
  RecipientPicker: (props: Record<string, unknown>) => {
    pickerCalls.push(props);
    return props.isOpen ? <div data-testid="recipient-picker" data-mode={String(props.mode)} /> : null;
  },
}));

vi.mock('./LogWeekWizard', () => ({
  LogWeekWizard: (props: { isOpen: boolean }) => (props.isOpen ? <div data-testid="log-week-wizard" /> : null),
}));

vi.mock('./QuickLogMaterialModal', () => ({
  QuickLogMaterialModal: (props: { isOpen: boolean }) => (props.isOpen ? <div data-testid="material-modal" /> : null),
}));

vi.mock('./WeaponPriorityBridge', () => ({
  WeaponPriorityBridge: () => <div data-testid="weapon-bridge" />,
}));

vi.mock('./WeekScopeControl', () => ({
  WeekScopeControl: (props: Record<string, unknown>) => {
    weekScopeCalls.push(props);
    return <div data-testid="week-scope" />;
  },
}));

import { Loot } from './Loot';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';

function makePlayer(id: string, name: string, opts: { sub?: boolean } = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: opts.sub ?? false,
    gear: [], tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}

const group = { id: 'g1', name: 'Test Static' } as unknown as StaticGroup;

function makeTier(players: SnapshotPlayer[]): TierSnapshot {
  return { tierId: 'aac-heavyweight', contentType: 'savage', players } as unknown as TierSnapshot;
}

const baseProps = { group, canEdit: true, onNavigate: vi.fn() };

beforeEach(() => {
  // jsdom has no matchMedia; Modal -> useDevice depends on it (LootAdjustmentsModal
  // renders a Modal even while closed).
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  );
  floorCardCalls.length = 0;
  pickerCalls.length = 0;
  weekScopeCalls.length = 0;
  // Seed the shared clock: scopedWeek defaults to currentWeek. Loot's mount
  // effect (Loot.tsx) fires five lootTrackingStore fetch actions unconditionally
  // — stub them here (zustand setState can override action fields on the real
  // store) so they never fall through to the real api client. Without this,
  // the mount effect hits `fetch` for real; locally that resolves quietly
  // against a dev backend on :8001, but in CI (no backend) it rejects with
  // ECONNREFUSED as an UNHANDLED rejection and fails the whole run.
  useLootTrackingStore.setState({
    currentWeek: 3, maxWeek: 5, lootLog: [], materialLog: [], pageLedger: [],
    fetchLootLog: vi.fn().mockResolvedValue(undefined),
    fetchMaterialLog: vi.fn().mockResolvedValue(undefined),
    fetchPageLedger: vi.fn().mockResolvedValue(undefined),
    fetchCurrentWeek: vi.fn().mockResolvedValue(undefined),
    fetchWeekDataTypes: vi.fn().mockResolvedValue(undefined),
  });
});

const players = [makePlayer('p1', 'Alice'), makePlayer('p2', 'Bob'), makePlayer('s1', 'Sub', { sub: true })];

describe('Loot', () => {
  it('renders the "Loot" header with a fairness-rules subtitle', () => {
    render(<Loot {...baseProps} tier={makeTier(players)} />);
    expect(screen.getByTestId('loot-screen')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Loot' })).toBeInTheDocument();
    expect(screen.getByText(/fairness rules: role priority \+ need/)).toBeInTheDocument();
  });

  it('fetches loot log, material log, page ledger, current week, and week data types on mount', () => {
    // Guards the mount effect in Loot.tsx AND proves the beforeEach stubs above
    // actually intercept it (rather than silently falling through to the real
    // api client / network, which is what caused the CI ECONNREFUSED failure).
    render(<Loot {...baseProps} tier={makeTier(players)} />);
    const { fetchLootLog, fetchMaterialLog, fetchPageLedger, fetchCurrentWeek, fetchWeekDataTypes } =
      useLootTrackingStore.getState();
    expect(fetchLootLog).toHaveBeenCalledWith('g1', 'aac-heavyweight');
    expect(fetchMaterialLog).toHaveBeenCalledWith('g1', 'aac-heavyweight');
    expect(fetchPageLedger).toHaveBeenCalledWith('g1', 'aac-heavyweight');
    expect(fetchCurrentWeek).toHaveBeenCalledWith('g1', 'aac-heavyweight');
    expect(fetchWeekDataTypes).toHaveBeenCalledWith('g1', 'aac-heavyweight');
  });

  it('renders four FloorCards in F4→F1 order at the scoped (current) week', () => {
    render(<Loot {...baseProps} tier={makeTier(players)} />);
    const cards = screen.getAllByTestId('floor-card');
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.getAttribute('data-floor'))).toEqual(['4', '3', '2', '1']);
    // scopedWeek defaults to the clock's current week (3).
    cards.forEach((c) => expect(c.getAttribute('data-scoped')).toBe('3'));
  });

  it('keeps FloorCard currentWeek pinned to the clock while scoping to another week', () => {
    // Discriminator for the currentWeek/scopedWeek split at the assembly level:
    // scoping the view to week 1 re-renders the cards with scopedWeek=1, but the
    // FloorCard `currentWeek` prop must STAY the clock's real week (3). Deleting
    // `currentWeek={clock.currentWeek}` in Loot.tsx must fail this test.
    render(<Loot {...baseProps} tier={makeTier(players)} />);
    const scopeProps = weekScopeCalls[weekScopeCalls.length - 1];
    expect(scopeProps.scopedWeek).toBe(3);
    act(() => {
      (scopeProps.onScopedWeekChange as (w: number) => void)(1);
    });

    // Re-rendered cards: scoped to 1, currentWeek still the real clock week 3.
    const cards = screen.getAllByTestId('floor-card');
    cards.forEach((c) => expect(c.getAttribute('data-scoped')).toBe('1'));
    const latestFour = floorCardCalls.slice(-4);
    expect(latestFour).toHaveLength(4);
    latestFour.forEach((p) => {
      expect(p.scopedWeek).toBe(1);
      expect(p.currentWeek).toBe(3);
    });
  });

  it('shows the editor toolbar actions only when canEdit', () => {
    const { rerender } = render(<Loot {...baseProps} tier={makeTier(players)} />);
    expect(screen.getByRole('button', { name: /log a drop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log this week's loot/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adjustments/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rules/i })).toBeInTheDocument();
    // WeekScopeControl is always present regardless of canEdit.
    expect(screen.getByTestId('week-scope')).toBeInTheDocument();

    rerender(<Loot {...baseProps} canEdit={false} tier={makeTier(players)} />);
    expect(screen.queryByRole('button', { name: /log a drop/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('week-scope')).toBeInTheDocument();
  });

  it('opens the picker in log mode when "Log a drop" is clicked', () => {
    render(<Loot {...baseProps} tier={makeTier(players)} />);
    fireEvent.click(screen.getByRole('button', { name: /log a drop/i }));
    const picker = screen.getByTestId('recipient-picker');
    expect(picker).toHaveAttribute('data-mode', 'log');
    // Latest captured picker props: open, log mode, no fixed item.
    const last = pickerCalls[pickerCalls.length - 1];
    expect(last.isOpen).toBe(true);
    expect(last.mode).toBe('log');
    expect(last.item).toBeUndefined();
  });

  it('opens the picker in assign mode with item context when a floor row assigns gear', () => {
    render(<Loot {...baseProps} tier={makeTier(players)} />);
    // F4 is the first captured card; invoke its onAssignGear with a slot+label.
    const f4 = floorCardCalls.find((c) => c.floorNumber === 4)!;
    act(() => {
      (f4.onAssignGear as (i: { slot: string; label: string }) => void)({ slot: 'weapon', label: 'Weapon' });
    });
    const picker = screen.getByTestId('recipient-picker');
    expect(picker).toHaveAttribute('data-mode', 'assign');
    const last = pickerCalls[pickerCalls.length - 1];
    expect(last.mode).toBe('assign');
    expect(last.item).toMatchObject({ slot: 'weapon', label: 'Weapon', floorName: 'M12S', floorNumber: 4 });
  });

  it('passes a footer (weapon bridge) to the F4 card only', () => {
    render(<Loot {...baseProps} tier={makeTier(players)} />);
    const f4 = floorCardCalls.find((c) => c.floorNumber === 4)!;
    const f3 = floorCardCalls.find((c) => c.floorNumber === 3)!;
    expect(f4.footer).toBeTruthy();
    expect(f3.footer).toBeUndefined();
  });

  it('refetches the week clock (in addition to the tier) when a child onSuccess fires', () => {
    // Regression: the FIRST-ever loot entry for a tier can set the tier's
    // `week_start_date` anchor server-side — `refresh` must refetch the week
    // clock too, or the week pill stays stale until remount. Drive it via the
    // mocked RecipientPicker's captured `onSuccess` (shared by the picker /
    // material modal / wizard — all route through the same `refresh`).
    render(<Loot {...baseProps} tier={makeTier(players)} />);
    const { fetchCurrentWeek } = useLootTrackingStore.getState();
    const callsBefore = vi.mocked(fetchCurrentWeek).mock.calls.length;
    const last = pickerCalls[pickerCalls.length - 1];
    act(() => {
      (last.onSuccess as () => void)();
    });
    expect(vi.mocked(fetchCurrentWeek).mock.calls.length).toBe(callsBefore + 1);
    expect(fetchCurrentWeek).toHaveBeenLastCalledWith('g1', 'aac-heavyweight');
  });

  it('renders an empty screen shell for a null tier', () => {
    render(<Loot {...baseProps} tier={null} />);
    expect(screen.getByTestId('loot-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('floor-card')).not.toBeInTheDocument();
  });
});
