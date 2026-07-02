// `@testing-library/user-event` is not a dependency of this project, so we drive
// interaction via `fireEvent` (the established convention). This suite mocks the
// heavy leaf surfaces (FloorCard, RecipientPicker, LogWeekWizard,
// QuickLogMaterialModal, WeaponPriorityBridge, WeekScopeControl) so we assert
// only the Loot assembly's own contract: header + subtitle, four floor cards in
// F4→F1 order at the scoped week, the editor toolbar, and the assign/log picker
// wiring. `useWeekClock` is left REAL (reads the seeded loot store). The
// History-view surfaces (FairnessSummary / BookLedgerCard / LootHistoryTable /
// HistoryFilters / LootEntryRow) are left REAL — Task 9 asserts the assembly
// wiring end-to-end. Loot now uses `useUrlTabState` (→ useSearchParams), so
// every render is wrapped in a MemoryRouter.
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { StaticGroup, TierSnapshot, SnapshotPlayer, LootLogEntry, MaterialLogEntry } from '../../types';

// Capture buckets shared with the hoisted mocks.
const { floorCardCalls, pickerCalls, weekScopeCalls, deleteLootMock, deleteMaterialMock } = vi.hoisted(() => ({
  floorCardCalls: [] as Array<Record<string, unknown>>,
  pickerCalls: [] as Array<Record<string, unknown>>,
  weekScopeCalls: [] as Array<Record<string, unknown>>,
  deleteLootMock: vi.fn().mockResolvedValue(undefined),
  deleteMaterialMock: vi.fn().mockResolvedValue(undefined),
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
    return props.isOpen ? (
      <div
        data-testid="recipient-picker"
        data-mode={String(props.mode)}
        data-edit-id={props.editEntry ? String((props.editEntry as LootLogEntry).id) : ''}
      />
    ) : null;
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

// The Reset menu + delete paths run through the REAL coordination utils; mock
// them so we assert the assembly's call shape without touching the network.
vi.mock('../../utils/lootCoordination', () => ({
  deleteLootAndRevertGear: deleteLootMock,
}));
vi.mock('../../utils/materialCoordination', () => ({
  deleteMaterialAndRevertGear: deleteMaterialMock,
}));

import { Loot } from './Loot';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useToastStore } from '../../stores/toastStore';

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

function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 1, tierSnapshotId: 't1', weekNumber: 3, floor: 'M12S', itemSlot: 'body',
    recipientPlayerId: 'p1', recipientPlayerName: 'Alice', method: 'drop', isExtra: false,
    createdAt: '2026-06-24T12:00:00Z', createdByUserId: 'u1', createdByUsername: 'alice',
    ...overrides,
  };
}

function makeMaterialEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id: 1, tierSnapshotId: 't1', weekNumber: 3, floor: 'M12S', materialType: 'twine',
    recipientPlayerId: 'p1', recipientPlayerName: 'Alice', method: 'drop',
    createdAt: '2026-06-24T12:00:00Z', createdByUserId: 'u1', createdByUsername: 'alice',
    ...overrides,
  };
}

const baseProps = { group, canEdit: true, onNavigate: vi.fn() };

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-search={loc.search} />;
}

function renderLoot(
  props: Partial<Parameters<typeof Loot>[0]> & { tier: TierSnapshot | null },
  initialEntries: string[] = ['/'],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Loot {...baseProps} {...props} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

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
  deleteLootMock.mockClear();
  deleteMaterialMock.mockClear();
  useToastStore.getState().clearAll();
  // Reset the real (unmocked) location to a clean baseline before each test —
  // the copy-link handler reads `window.location.href` directly (not the
  // MemoryRouter's virtual location), so tests that seed real URL params via
  // `window.history.pushState` must not leak into unrelated tests.
  window.history.pushState({}, '', '/');
  // Seed the shared clock: scopedWeek defaults to currentWeek. Loot's mount
  // effect (Loot.tsx) fires five lootTrackingStore fetch actions unconditionally
  // — stub them here (zustand setState can override action fields on the real
  // store) so they never fall through to the real api client. Without this,
  // the mount effect hits `fetch` for real; locally that resolves quietly
  // against a dev backend on :8001, but in CI (no backend) it rejects with
  // ECONNREFUSED as an UNHANDLED rejection and fails the whole run.
  // `fetchPageBalances` is added for the History view — BookLedgerCard fires it
  // in its own mount effect once the History body renders.
  useLootTrackingStore.setState({
    currentWeek: 3, maxWeek: 5, lootLog: [], materialLog: [], pageLedger: [], pageBalances: [],
    fetchLootLog: vi.fn().mockResolvedValue(undefined),
    fetchMaterialLog: vi.fn().mockResolvedValue(undefined),
    fetchPageLedger: vi.fn().mockResolvedValue(undefined),
    fetchPageBalances: vi.fn().mockResolvedValue(undefined),
    fetchCurrentWeek: vi.fn().mockResolvedValue(undefined),
    fetchWeekDataTypes: vi.fn().mockResolvedValue(undefined),
  });
});

const players = [makePlayer('p1', 'Alice'), makePlayer('p2', 'Bob'), makePlayer('s1', 'Sub', { sub: true })];

describe('Loot', () => {
  it('renders the "Loot" header with a fairness-rules subtitle', () => {
    renderLoot({ tier: makeTier(players) });
    expect(screen.getByTestId('loot-screen')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Loot' })).toBeInTheDocument();
    expect(screen.getByText(/fairness rules: role priority \+ need/)).toBeInTheDocument();
  });

  it('fetches loot log, material log, page ledger, current week, and week data types on mount', () => {
    // Guards the mount effect in Loot.tsx AND proves the beforeEach stubs above
    // actually intercept it (rather than silently falling through to the real
    // api client / network, which is what caused the CI ECONNREFUSED failure).
    renderLoot({ tier: makeTier(players) });
    const { fetchLootLog, fetchMaterialLog, fetchPageLedger, fetchCurrentWeek, fetchWeekDataTypes } =
      useLootTrackingStore.getState();
    expect(fetchLootLog).toHaveBeenCalledWith('g1', 'aac-heavyweight');
    expect(fetchMaterialLog).toHaveBeenCalledWith('g1', 'aac-heavyweight');
    expect(fetchPageLedger).toHaveBeenCalledWith('g1', 'aac-heavyweight');
    expect(fetchCurrentWeek).toHaveBeenCalledWith('g1', 'aac-heavyweight');
    expect(fetchWeekDataTypes).toHaveBeenCalledWith('g1', 'aac-heavyweight');
  });

  it('renders four FloorCards in F4→F1 order at the scoped (current) week', () => {
    renderLoot({ tier: makeTier(players) });
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
    renderLoot({ tier: makeTier(players) });
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

  it('defaults the picker to the scoped week in Priority view but the clock week in History view (PR review finding)', () => {
    // Discriminator: a week-scope override set while viewing Priority must NOT
    // leak into the History view's "Log a drop" default — the picker there
    // must fall back to the clock's real currentWeek (3), not the stale
    // Priority-view scope (1). Same component instance (no remount) so the
    // override state genuinely persists across the view toggle.
    renderLoot({ tier: makeTier(players) });
    const scopeProps = weekScopeCalls[weekScopeCalls.length - 1];
    act(() => {
      (scopeProps.onScopedWeekChange as (w: number) => void)(1);
    });

    // Priority view: picker defaults to the scoped week (1) — unchanged behavior.
    fireEvent.click(screen.getByRole('button', { name: /log a drop/i }));
    const priorityPick = pickerCalls[pickerCalls.length - 1];
    expect(priorityPick.currentWeek).toBe(1);

    // Switch to History (same instance — the override persists as local state).
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    fireEvent.click(screen.getByRole('button', { name: /log a drop/i }));
    const historyPick = pickerCalls[pickerCalls.length - 1];
    expect(historyPick.currentWeek).toBe(3);
  });

  it('shows the editor toolbar actions only when canEdit', () => {
    const { rerender } = renderLoot({ tier: makeTier(players) });
    expect(screen.getByRole('button', { name: /log a drop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log this week's loot/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adjustments/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rules/i })).toBeInTheDocument();
    // WeekScopeControl is always present regardless of canEdit.
    expect(screen.getByTestId('week-scope')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <Loot {...baseProps} canEdit={false} tier={makeTier(players)} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /log a drop/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('week-scope')).toBeInTheDocument();
  });

  it('opens the picker in log mode when "Log a drop" is clicked', () => {
    renderLoot({ tier: makeTier(players) });
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
    renderLoot({ tier: makeTier(players) });
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
    renderLoot({ tier: makeTier(players) });
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
    renderLoot({ tier: makeTier(players) });
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
    renderLoot({ tier: null });
    expect(screen.getByTestId('loot-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('floor-card')).not.toBeInTheDocument();
  });

  // ── History view (Task 9 assembly) ────────────────────────────────────────

  it('defaults to the Priority view and swaps to History via the toggle (updating lview)', () => {
    renderLoot({ tier: makeTier(players) });
    // Priority is the default: floor cards present, History body absent.
    expect(screen.getAllByTestId('floor-card')).toHaveLength(4);
    expect(screen.queryByText('Drops this tier')).not.toBeInTheDocument();
    // The view toggle is present.
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    // History body: fairness strip + Books + record. Floor cards gone.
    expect(screen.getByText('Drops this tier')).toBeInTheDocument();
    expect(screen.getByText('Books')).toBeInTheDocument();
    expect(screen.queryByTestId('floor-card')).not.toBeInTheDocument();
    // lview is reflected in the URL.
    expect(screen.getByTestId('loc').getAttribute('data-search')).toContain('lview=history');
  });

  it('mounts the History view directly from an ?lview=history deep-link', () => {
    renderLoot({ tier: makeTier(players) }, ['/?lview=history']);
    expect(screen.getByText('Drops this tier')).toBeInTheDocument();
    expect(screen.queryByTestId('floor-card')).not.toBeInTheDocument();
  });

  it('renders the History subtitle in history view and the fairness subtitle in priority view', () => {
    // MemoryRouter's initialEntries only apply on mount, so switch views by
    // unmounting + re-rendering at the target deep-link (not rerender).
    const priority = renderLoot({ tier: makeTier(players) });
    expect(screen.getByText(/fairness rules: role priority \+ need/)).toBeInTheDocument();
    expect(screen.queryByText(/transparent record/)).not.toBeInTheDocument();
    priority.unmount();

    renderLoot({ tier: makeTier(players) }, ['/?lview=history']);
    expect(screen.getByText('Every drop, who received it, and why — the transparent record')).toBeInTheDocument();
  });

  it('shows the Reset menu only in the history view for editors', () => {
    // Priority view: no Reset trigger.
    const priority = renderLoot({ tier: makeTier(players) });
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    priority.unmount();

    // History + editor: Reset trigger present.
    const editor = renderLoot({ tier: makeTier(players) }, ['/?lview=history']);
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    editor.unmount();

    // History + viewer: no Reset (the whole editor cluster is gated).
    renderLoot({ canEdit: false, tier: makeTier(players) }, ['/?lview=history']);
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });

  it('reset "week loot" deletes exactly the current-week loot entries with gear reversion', async () => {
    useLootTrackingStore.setState({
      lootLog: [
        makeLootEntry({ id: 1, weekNumber: 3 }),
        makeLootEntry({ id: 2, weekNumber: 3 }),
        makeLootEntry({ id: 3, weekNumber: 1 }),
      ],
    });
    renderLoot({ tier: makeTier(players) }, ['/?lview=history']);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Reset' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reset week loot' }));

    // ResetConfirmModal requires typing RESET before the confirm enables.
    expect(await screen.findByText('Confirm Reset')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Type RESET'), { target: { value: 'RESET' } });
    const resetButtons = screen.getAllByRole('button', { name: 'Reset' });
    fireEvent.click(resetButtons[resetButtons.length - 1]);

    await waitFor(() => expect(deleteLootMock).toHaveBeenCalledTimes(2));
    // Only the two week-3 entries, each reverting gear.
    for (const call of deleteLootMock.mock.calls) {
      expect(call[0]).toBe('g1');
      expect(call[1]).toBe('aac-heavyweight');
      expect(call[4]).toEqual({ revertGear: true });
    }
    expect(deleteLootMock.mock.calls.map((c) => (c[3] as LootLogEntry).weekNumber)).toEqual([3, 3]);
  });

  it('opens the picker in edit mode from a loot row kebab', async () => {
    useLootTrackingStore.setState({ lootLog: [makeLootEntry({ id: 7, weekNumber: 3 })] });
    renderLoot({ tier: makeTier(players) }, ['/?lview=history']);

    const row = document.getElementById('loot-entry-7')!;
    fireEvent.keyDown(within(row).getByRole('button', { name: 'Entry actions' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));

    const picker = screen.getByTestId('recipient-picker');
    expect(picker).toHaveAttribute('data-mode', 'edit');
    expect(picker).toHaveAttribute('data-edit-id', '7');
  });

  it('deletes a material row (revertGear true) after confirming', async () => {
    useLootTrackingStore.setState({ materialLog: [makeMaterialEntry({ id: 9, weekNumber: 3 })] });
    renderLoot({ tier: makeTier(players) }, ['/?lview=history']);

    const row = document.getElementById('material-entry-9')!;
    fireEvent.keyDown(within(row).getByRole('button', { name: 'Entry actions' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(deleteMaterialMock).toHaveBeenCalledTimes(1));
    const call = deleteMaterialMock.mock.calls[0];
    expect(call[0]).toBe('g1');
    expect(call[1]).toBe('aac-heavyweight');
    expect((call[3] as MaterialLogEntry).id).toBe(9);
    expect(call[4]).toEqual({ revertGear: true });
  });

  it('copies a v2 deep-link containing lview=history&entry= for a loot row, preserving existing URL params (e.g. tier=)', async () => {
    // Copy-link builds from the REAL `window.location.href` (not the
    // MemoryRouter's virtual location) so an existing `?tier=` param survives —
    // seed it via pushState to prove the fix, undone by the beforeEach reset.
    window.history.pushState({}, '', '/group/g1?tier=xyz');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    useLootTrackingStore.setState({ lootLog: [makeLootEntry({ id: 4, weekNumber: 3 })] });
    renderLoot({ tier: makeTier(players) }, ['/?lview=history']);

    const row = document.getElementById('loot-entry-4')!;
    fireEvent.keyDown(within(row).getByRole('button', { name: 'Entry actions' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy link' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain('tier=xyz');
    expect(copied).toContain('lview=history&entry=4');
    expect(copied).not.toContain('entryType');
  });

  it('sets entryType=material (and deletes it for loot) in the copied link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    useLootTrackingStore.setState({ materialLog: [makeMaterialEntry({ id: 12, weekNumber: 3 })] });
    renderLoot({ tier: makeTier(players) }, ['/?lview=history']);

    const row = document.getElementById('material-entry-12')!;
    fireEvent.keyDown(within(row).getByRole('button', { name: 'Entry actions' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy link' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('entryType=material');
  });

  it('shows an error toast (no success toast, no throw) when copying the link rejects', async () => {
    // Discriminator for the F6c phantom-analytics class applied to copy-link:
    // an un-awaited clipboard write becomes an unhandled rejection AND fires
    // the success toast unconditionally. Stub a rejecting clipboard and assert
    // neither happens.
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    useLootTrackingStore.setState({ lootLog: [makeLootEntry({ id: 6, weekNumber: 3 })] });
    renderLoot({ tier: makeTier(players) }, ['/?lview=history']);

    const row = document.getElementById('loot-entry-6')!;
    fireEvent.keyDown(within(row).getByRole('button', { name: 'Entry actions' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy link' }));

    await waitFor(() => {
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error' && t.message === "Couldn't copy the link")).toBe(true);
    });
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success')).toBe(false);
  });

  it('shows an error toast (and does not throw) when a loot delete rejects', async () => {
    // Discriminator for the F6c phantom-analytics class: an uncaught rejection
    // in DeleteLootConfirmModal's onConfirm would leave the modal stuck open
    // and surface as an unhandled rejection. The wrapping try/catch in Loot.tsx
    // must swallow it and toast instead.
    deleteLootMock.mockRejectedValueOnce(new Error('boom'));
    useLootTrackingStore.setState({ lootLog: [makeLootEntry({ id: 5, weekNumber: 3 })] });
    renderLoot({ tier: makeTier(players) }, ['/?lview=history']);

    const row = document.getElementById('loot-entry-5')!;
    fireEvent.keyDown(within(row).getByRole('button', { name: 'Entry actions' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Entry' }));

    await waitFor(() => {
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error' && t.message === 'Failed to delete entry')).toBe(true);
    });
  });

  it('reset "Reset ALL data" deletes every seeded loot+material entry (unfiltered by week) and clears all page ledger', async () => {
    const clearAllPageLedgerMock = vi.fn().mockResolvedValue(undefined);
    useLootTrackingStore.setState({
      lootLog: [
        makeLootEntry({ id: 1, weekNumber: 3 }),
        makeLootEntry({ id: 2, weekNumber: 1 }),
      ],
      materialLog: [
        makeMaterialEntry({ id: 10, weekNumber: 3 }),
        makeMaterialEntry({ id: 11, weekNumber: 1 }),
      ],
      clearAllPageLedger: clearAllPageLedgerMock,
    });
    renderLoot({ tier: makeTier(players) }, ['/?lview=history']);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Reset' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reset ALL data' }));

    expect(await screen.findByText('Confirm Reset')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Type RESET'), { target: { value: 'RESET' } });
    const resetButtons = screen.getAllByRole('button', { name: 'Reset' });
    fireEvent.click(resetButtons[resetButtons.length - 1]);

    await waitFor(() => expect(deleteLootMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(deleteMaterialMock).toHaveBeenCalledTimes(2));
    // Both weeks (3 and 1) are present — proving scope="all" is NOT week-filtered.
    expect(deleteLootMock.mock.calls.map((c) => (c[3] as LootLogEntry).weekNumber).sort()).toEqual([1, 3]);
    expect(deleteMaterialMock.mock.calls.map((c) => (c[3] as MaterialLogEntry).weekNumber).sort()).toEqual([1, 3]);
    await waitFor(() => expect(clearAllPageLedgerMock).toHaveBeenCalledWith('g1', 'aac-heavyweight'));
  });
});
