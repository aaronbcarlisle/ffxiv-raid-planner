// `@testing-library/user-event` is not a dependency of this project, so we drive
// interaction via `fireEvent` (the established convention). This suite mocks the
// heavy leaf surfaces (FloorCard, RecipientPicker, LogWeekWizard,
// QuickLogMaterialModal, WeaponPriorityBridge, WeekScopeControl) so we assert
// only the Loot assembly's own contract: header + subtitle, the Priority ⇄ Log
// ⇄ History triad, four floor cards in F4→F1 order at the clock's week, the
// editor toolbar, and the assign/log picker wiring. `useWeekClock` and
// `useLogWeek` are left REAL (the clock reads the seeded loot store; the Log
// week reads the MemoryRouter URL + localStorage). The
// History-view surfaces (FairnessSummary / BookLedgerCard / LootHistoryTable /
// HistoryFilters / LootEntryRow) are left REAL — Task 9 asserts the assembly
// wiring end-to-end. Loot now uses `useUrlTabState` (→ useSearchParams), so
// every render is wrapped in a MemoryRouter.
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type { StaticGroup, TierSnapshot, SnapshotPlayer, LootLogEntry, MaterialLogEntry } from '../../types';

// Capture buckets shared with the hoisted mocks.
const {
  floorCardCalls, pickerCalls, weekScopeCalls, wizardCalls, matrixCalls, materialModalCalls,
  gridCalls, suggestedMaterialRecipientMock, deleteLootMock, deleteMaterialMock,
} = vi.hoisted(() => ({
  floorCardCalls: [] as Array<Record<string, unknown>>,
  pickerCalls: [] as Array<Record<string, unknown>>,
  weekScopeCalls: [] as Array<Record<string, unknown>>,
  wizardCalls: [] as Array<Record<string, unknown>>,
  matrixCalls: [] as Array<Record<string, unknown>>,
  materialModalCalls: [] as Array<Record<string, unknown>>,
  gridCalls: [] as Array<Record<string, unknown>>,
  suggestedMaterialRecipientMock: vi.fn(),
  deleteLootMock: vi.fn().mockResolvedValue(undefined),
  deleteMaterialMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./FloorCard', () => ({
  FloorCard: (props: Record<string, unknown>) => {
    floorCardCalls.push(props);
    return <div data-testid="floor-card" data-floor={String(props.floorNumber)} data-week={String(props.currentWeek)} />;
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

vi.mock('./NeedMatrix', () => ({
  NeedMatrix: (props: Record<string, unknown>) => {
    matrixCalls.push(props);
    return (
      <div data-testid="need-matrix" data-scope={String(props.floorScope)}>
        <button onClick={() => (props.onLogGear as (i: unknown, p: string) => void)({ slot: 'ring', label: 'Ring', floorNumber: 1 }, 'p1')}>
          mock-log-gear
        </button>
        <button onClick={() => (props.onLogMaterial as (m: unknown, p: unknown) => void)('twine', { id: 'p1' })}>
          mock-log-material
        </button>
      </div>
    );
  },
}));

vi.mock('./LogWeekWizard', () => ({
  LogWeekWizard: (props: Record<string, unknown>) => {
    wizardCalls.push(props);
    return props.isOpen ? (
      <div
        data-testid="log-week-wizard"
        data-single={String(props.singleFloorMode)}
        data-floor={String(props.initialFloor)}
      />
    ) : null;
  },
}));

vi.mock('./QuickLogMaterialModal', () => ({
  QuickLogMaterialModal: (props: { isOpen: boolean; floor?: string }) => {
    materialModalCalls.push(props);
    return props.isOpen ? (
      <div
        data-testid="material-modal"
        data-floor={props.floor ?? ''}
        data-mode={props.floor != null ? 'pinned' : 'freeform'}
      />
    ) : null;
  },
}));

vi.mock('./WeaponPriorityBridge', () => ({
  WeaponPriorityBridge: () => <div data-testid="weapon-bridge" />,
}));

vi.mock('./LogWeekGrid', () => ({
  LogWeekGrid: (props: Record<string, unknown>) => {
    gridCalls.push(props);
    return <div data-testid="log-week-grid" data-week={String(props.week)} />;
  },
}));

vi.mock('./materialSuggestion', () => ({
  suggestedMaterialRecipient: (...args: unknown[]) => suggestedMaterialRecipientMock(...args),
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

function makeTier(players: SnapshotPlayer[], tierId = 'aac-heavyweight'): TierSnapshot {
  return { tierId, contentType: 'savage', players } as unknown as TierSnapshot;
}

function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 1, tierSnapshotId: 't1', weekNumber: 3, floor: 'M12S', itemSlot: 'body',
    recipientPlayerId: 'p1', recipientPlayerName: 'Alice', method: 'drop', isExtra: false,
    createdAt: '2026-06-24T12:00:00Z', createdByUserId: 'u1', createdByUsername: 'alice',
    ...overrides,
  };
}

// D3 landing flip (R-1): Who Needs It (formerly "Matrix") is now the default
// Priority sub-view. Tests ABOUT Queues/FloorCard/scope behavior seed the
// pre-D3 view explicitly so their assertions (unchanged) keep exercising the
// Queues body.
function seedQueuesView() {
  localStorage.setItem('v2-loot-priority-view', 'queues');
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

// Set by the copy-link test, which has to redefine `navigator.clipboard`
// (jsdom's is not writable). Undone after every test so the fake can't leak.
let restoreClipboard: (() => void) | null = null;

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
  wizardCalls.length = 0;
  matrixCalls.length = 0;
  materialModalCalls.length = 0;
  gridCalls.length = 0;
  suggestedMaterialRecipientMock.mockReset();
  deleteLootMock.mockClear();
  deleteMaterialMock.mockClear();
  // The Priority sub-view persists under `v2-loot-priority-view` (R-1) and the
  // floor pick under sessionStorage `v2-loot-floor-scope` (R-10) — clear both
  // so one test's choice can't leak into the next.
  localStorage.clear();
  sessionStorage.clear();
  useToastStore.getState().clearAll();
  // Reset the real (unmocked) location to a clean baseline before each test —
  // the copy-link handler reads `window.location.href` directly (not the
  // MemoryRouter's virtual location), so tests that seed real URL params via
  // `window.history.pushState` must not leak into unrelated tests.
  window.history.pushState({}, '', '/');
  // Seed the shared clock at currentWeek 3 / maxWeek 5. `useLogWeek`'s override
  // starts null (D4, R-15), so the Log tab's displayed week resolves to this
  // currentWeek until a test steps it away via `setLogWeek`. Loot's mount
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

afterEach(() => {
  restoreClipboard?.();
  restoreClipboard = null;
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

  it('defaults Queues to ONE card — the newest in-progress floor (R-10; fresh tier → Floor 1)', () => {
    // Empty logs/ledger (beforeEach fixture) = a fresh tier → Floor 1.
    seedQueuesView();
    renderLoot({ tier: makeTier(players) });
    const cards = screen.getAllByTestId('floor-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute('data-floor')).toBe('1');
    // R-15: Priority cards always speak for the clock's current week (3).
    expect(cards[0].getAttribute('data-week')).toBe('3');
  });

  it('defaults Queues to one past the highest floor with recorded activity (R-10)', () => {
    // Loot on M10S (floor 2) → the static is prog'ing floor 3.
    seedQueuesView();
    useLootTrackingStore.setState({ lootLog: [makeLootEntry({ floor: 'M10S' })] });
    renderLoot({ tier: makeTier(players) });
    const cards = screen.getAllByTestId('floor-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute('data-floor')).toBe('3');
  });

  it('the R-10 default is a LANDING default — logging a drop must not move the scope (director F1)', async () => {
    // Prog'ing floor 3 (evidence on M10S). The landing latches at fetch settle.
    seedQueuesView();
    useLootTrackingStore.setState({ lootLog: [makeLootEntry({ floor: 'M10S' })] });
    renderLoot({ tier: makeTier(players) });
    await waitFor(() => expect(screen.getByTestId('floor-card').getAttribute('data-floor')).toBe('3'));

    // The user logs their first M11S drop from the card they are looking at.
    // A live derivation would now say "newest in progress = 4" and swap the
    // card under them; the latched landing must hold floor 3.
    act(() => {
      useLootTrackingStore.setState({
        lootLog: [makeLootEntry({ floor: 'M10S' }), makeLootEntry({ id: 2, floor: 'M11S' })],
      });
    });
    const cards = screen.getAllByTestId('floor-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute('data-floor')).toBe('3');
  });

  it('a stale landing-latch chain from a previous tier is ignored (PR #224 race guard)', async () => {
    // Loot mounts un-keyed, so a tier switch re-runs the mount effect on a live
    // component. Hold tier A's chain open, switch to tier B (whose chain
    // settles immediately), then release A's — the stale .then must NOT
    // overwrite B's latch through A's `floors` closure.
    seedQueuesView();
    let releaseTierA: () => void = () => {};
    const gate = new Promise<void>((res) => { releaseTierA = res; });
    // First call (tier A) blocks on the gate; later calls resolve immediately.
    useLootTrackingStore.setState({
      fetchLootLog: vi.fn().mockImplementationOnce(() => gate).mockResolvedValue(undefined),
      // Evidence on M6S — cruiserweight floor 2 → tier B's landing is floor 3.
      // Through tier A's (heavyweight) floors closure this matches NOTHING, so
      // a stale latch would compute floor 1.
      lootLog: [makeLootEntry({ floor: 'M6S' })],
    });

    const { rerender } = renderLoot({
      tier: { tierId: 'aac-heavyweight', contentType: 'savage', players } as unknown as TierSnapshot,
    });
    rerender(
      <MemoryRouter>
        <Loot {...baseProps} tier={{ tierId: 'aac-cruiserweight', contentType: 'savage', players } as unknown as TierSnapshot} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('floor-card').getAttribute('data-floor')).toBe('3'));

    // Tier A's chain finally resolves — the guard must discard its latch.
    await act(async () => { releaseTierA(); await gate; });
    expect(screen.getByTestId('floor-card').getAttribute('data-floor')).toBe('3');
  });

  it('"Log floor" follows the pill — a non-default pick reaches the wizard (R-7)', () => {
    renderLoot({ tier: makeTier(players) });
    fireEvent.click(screen.getByRole('button', { name: 'M11S' }));
    // The visible label names the target floor (mockup parity).
    fireEvent.click(screen.getByRole('button', { name: 'Log floor — M11S' }));
    const wizard = screen.getByTestId('log-week-wizard');
    expect(wizard.getAttribute('data-single')).toBe('true');
    expect(wizard.getAttribute('data-floor')).toBe('3');
  });

  it('an explicit floor pick survives a remount within the session (R-10 sessionStorage)', () => {
    seedQueuesView();
    const { unmount } = renderLoot({ tier: makeTier(players) });
    fireEvent.click(screen.getByRole('button', { name: 'M10S' }));
    unmount();

    renderLoot({ tier: makeTier(players) });
    const cards = screen.getAllByTestId('floor-card');
    expect(cards.map((c) => c.getAttribute('data-floor'))).toEqual(['2']);
  });

  it('a stored "who-needs-it" sub-view renders the matrix (R-1: Who Needs It is a real, persistable segment)', () => {
    localStorage.setItem('v2-loot-priority-view', 'who-needs-it');
    renderLoot({ tier: makeTier(players) });
    expect(screen.getByTestId('need-matrix')).toBeInTheDocument();
    expect(screen.queryByTestId('floor-card')).not.toBeInTheDocument();
  });

  it('an unrecognized stored sub-view falls back to Who Needs It, the landing default (R-1)', () => {
    localStorage.setItem('v2-loot-priority-view', 'not-a-real-view');
    renderLoot({ tier: makeTier(players) });
    expect(screen.getByTestId('need-matrix')).toBeInTheDocument();
    expect(screen.queryByTestId('floor-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('weapon-bridge')).not.toBeInTheDocument();
  });

  // R-P1: no migration shim — the old 'matrix' value is now just another
  // unrecognized string, so it self-heals to whatever the current default is.
  // This assertion alone is vacuity-prone: a mutant that hardcoded
  // readStoredPriorityView to ALWAYS return the default would also pass it
  // ('matrix' being unrecognized already trivially agrees with "return the
  // default" for any input). Its kill-switch is the 'persists the Priority
  // sub-view ... (R-1)' test below, which clicks Weapons — a RECOGNIZED,
  // non-default choice — and checks it round-trips to ITS OWN body. That pin
  // fails under the always-default mutant (a fresh mount would wrongly show
  // the matrix instead of the weapon bridge), so together the two tests kill
  // it even though neither would alone.
  it('a stale "matrix" stored value does not render Queues — it self-heals to the new default (R-P1)', () => {
    localStorage.setItem('v2-loot-priority-view', 'matrix');
    renderLoot({ tier: makeTier(players) });
    expect(screen.queryByTestId('floor-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('need-matrix')).toBeInTheDocument();
  });

  it('the Priority-view toggle lists Queues | Who Needs It | Weapons, in that order', () => {
    renderLoot({ tier: makeTier(players) });
    const toggle = screen.getByRole('group', { name: 'Priority view' });
    const buttons = within(toggle).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Queues', 'Who Needs It', 'Weapons']);
  });

  // Re-points the prior "stored queues renders floor-cards, not the matrix"
  // regression pin: starts from the same seeded-queues/floor-card assertion,
  // then extends it into a full round-trip (click → persisted value → fresh
  // mount reads it back) proving the explicit choice of "who-needs-it"
  // persists under its own name, not the retired 'matrix' string.
  it('explicit choice persists as "who-needs-it" (round-trip: click, then a fresh mount reads it back)', () => {
    seedQueuesView();
    const { unmount } = renderLoot({ tier: makeTier(players) });
    expect(screen.getByTestId('floor-card')).toBeInTheDocument();
    expect(screen.queryByTestId('need-matrix')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Who Needs It' }));
    expect(localStorage.getItem('v2-loot-priority-view')).toBe('who-needs-it');
    unmount();

    renderLoot({ tier: makeTier(players) });
    expect(screen.getByTestId('need-matrix')).toBeInTheDocument();
    expect(screen.queryByTestId('floor-card')).not.toBeInTheDocument();
  });

  it('R-10.2: each view opens at its own default — Who Needs It at All, Queues at the newest in-progress floor', () => {
    renderLoot({ tier: makeTier(players) });
    // Who Needs It (default landing): floorScope 'all' — the whole-tier read is its purpose.
    expect(matrixCalls[matrixCalls.length - 1].floorScope).toBe('all');

    // Switch to Queues — no pill click yet, so ITS OWN per-view default applies:
    // the newest in-progress floor (fresh tier → Floor 1), not Who Needs It's 'all'.
    fireEvent.click(screen.getByRole('button', { name: 'Queues' }));
    const cards = screen.getAllByTestId('floor-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute('data-floor')).toBe('1');

    // Back to Who Needs It — its own default reasserts, unaffected by Queues' pick.
    fireEvent.click(screen.getByRole('button', { name: 'Who Needs It' }));
    expect(matrixCalls[matrixCalls.length - 1].floorScope).toBe('all');
  });

  it('R-10.3: a pill click while on Who Needs It is a GLOBAL scope — it carries into Queues too', () => {
    renderLoot({ tier: makeTier(players) });
    fireEvent.click(screen.getByRole('button', { name: 'M10S' }));
    expect(matrixCalls[matrixCalls.length - 1].floorScope).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'Queues' }));
    const cards = screen.getAllByTestId('floor-card');
    expect(cards.map((c) => c.getAttribute('data-floor'))).toEqual(['2']);
  });

  it('R-4: a matrix gear-cell click opens the picker in assign mode, pre-filled with the recipient', () => {
    renderLoot({ tier: makeTier(players) });
    fireEvent.click(screen.getByRole('button', { name: 'mock-log-gear' }));
    const last = pickerCalls[pickerCalls.length - 1];
    expect(last.mode).toBe('assign');
    expect(last.initialRecipientId).toBe('p1');
    // aac-heavyweight floors: M9S…M12S — floorNumber 1 resolves to floors[0].
    expect(last.item).toMatchObject({ slot: 'ring', label: 'Ring', floorNumber: 1, floorName: 'M9S' });
  });

  it('R-4: a matrix material-cell click opens the material modal, floor derived from the material\'s home floor', () => {
    renderLoot({ tier: makeTier(players) });
    fireEvent.click(screen.getByRole('button', { name: 'mock-log-material' }));
    // Twine's home floor is 3 (loot-tables.ts) — floors[2] = 'M11S'.
    expect(screen.getByTestId('material-modal')).toHaveAttribute('data-floor', 'M11S');
    expect(screen.getByTestId('material-modal')).toHaveAttribute('data-mode', 'pinned');
    // D8 M4 coherence: the cell door now carries showNotes + initialWeek === writeWeek — on
    // Priority (this test's view), writeWeek is the clock's current week (3).
    const last = materialModalCalls[materialModalCalls.length - 1];
    expect(last.showNotes).toBe(true);
    expect(last.initialWeek).toBe(3);
    // R-a preserved (D5): the matrix cell door does NOT gain R-D5a's `allowSubs`
    // rider — that's the GRID door's rider alone — and stays on mainRosterPlayers,
    // pinned on IDENTITY (not just value) against the wizard's own `players` prop,
    // which is also fed `mainRosterPlayers` (Loot.tsx :837), against a fixture that
    // contains a substitute (so a silent widen to the full roster would still pass
    // a same-VALUES check but fail this identity one).
    expect(last.allowSubs).toBeUndefined();
    expect(last.allPlayers).toBe(wizardCalls[wizardCalls.length - 1].players);
  });

  it('R-4/D5: a FloorCard material-cell click ALSO stays on mainRosterPlayers, no allowSubs (R-a preserved)', () => {
    seedQueuesView();
    renderLoot({ tier: makeTier(players) });
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    const f4 = floorCardCalls.find((c) => c.floorNumber === 4)!;
    const suggested = makePlayer('p1', 'Alice');
    act(() => {
      (f4.onAssignMaterial as (m: string, p: SnapshotPlayer) => void)('universal_tomestone', suggested);
    });
    const last = materialModalCalls[materialModalCalls.length - 1];
    expect(last.material).toBe('universal_tomestone');
    expect(last.suggestedPlayer).toBe(suggested);
    expect(last.allowSubs).toBeUndefined();
    expect(last.allPlayers).toBe(wizardCalls[wizardCalls.length - 1].players);
  });

  it('renders four FloorCards in F4→F1 order when the All pill is picked (R-2)', () => {
    seedQueuesView();
    renderLoot({ tier: makeTier(players) });
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    const cards = screen.getAllByTestId('floor-card');
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.getAttribute('data-floor'))).toEqual(['4', '3', '2', '1']);
    cards.forEach((c) => expect(c.getAttribute('data-week')).toBe('3'));
  });

  it('disables auto-collapse only for a solo-scoped card (R-49)', () => {
    seedQueuesView();
    renderLoot({ tier: makeTier(players) });
    // Default single-card scope → the card must not auto-collapse.
    expect(floorCardCalls[floorCardCalls.length - 1].autoCollapse).toBe(false);

    // All → the four-card stack keeps the collapse behaviour.
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    const latestFour = floorCardCalls.slice(-4);
    latestFour.forEach((p) => expect(p.autoCollapse).toBe(true));

    // Back to an explicit single floor → collapse disabled again.
    fireEvent.click(screen.getByRole('button', { name: 'M12S' }));
    expect(floorCardCalls[floorCardCalls.length - 1].autoCollapse).toBe(false);
  });

  it('shows the editor toolbar actions only when canEdit', () => {
    const { rerender } = renderLoot({ tier: makeTier(players) });
    expect(screen.getByRole('button', { name: /log a drop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log material/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log this week's loot/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adjustments/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rules/i })).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <Loot {...baseProps} canEdit={false} tier={makeTier(players)} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /log a drop/i })).not.toBeInTheDocument();
    // D8: "Log material" is gated the same as the rest of the editor cluster (R-b).
    expect(screen.queryByRole('button', { name: /log material/i })).not.toBeInTheDocument();
  });

  it('D8/R-20/R-26: the toolbar\'s "Log material" opens the free-form door — full roster incl. subs (R-a), no pinned trio, initialWeek === writeWeek', () => {
    renderLoot({ tier: makeTier(players) });
    fireEvent.click(screen.getByRole('button', { name: /log material/i }));

    expect(screen.getByTestId('material-modal')).toHaveAttribute('data-mode', 'freeform');
    const last = materialModalCalls[materialModalCalls.length - 1];
    // aac-heavyweight floors: M9S…M12S.
    expect(last.floors).toEqual(['M9S', 'M10S', 'M11S', 'M12S']);
    // On Priority (this test's default view), writeWeek falls back to the clock's current week (3).
    expect(last.initialWeek).toBe(3);
    expect(last.floor).toBeUndefined();
    expect(last.material).toBeUndefined();
    expect(last.suggestedPlayer).toBeUndefined();
    // R-a: the free-form door gets the FULL roster (incl. the sub), not mainRosterPlayers — the
    // modal's own "Include substitutes" checkbox does the widening.
    expect((last.allPlayers as SnapshotPlayer[]).map((p) => p.id)).toEqual(['p1', 'p2', 's1']);
  });

  it('renders the week control on Log regardless of canEdit (R-22 is a read affordance too)', () => {
    // The old "WeekScopeControl is always present" assertion lived in the
    // canEdit test above; R-15 moved the control to Log, so its
    // canEdit-independence is asserted here — where the control actually lives.
    const editor = renderLoot({ tier: makeTier(players) }, ['/?lview=log']);
    expect(screen.getByTestId('week-scope')).toBeInTheDocument();
    editor.unmount();

    renderLoot({ canEdit: false, tier: makeTier(players) }, ['/?lview=log']);
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
    seedQueuesView();
    renderLoot({ tier: makeTier(players) });
    // Scope to All so the F4 card renders, then invoke its onAssignGear.
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
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

  it('renders the weapon bridge as the Weapons segment body, not a card footer (R-3)', () => {
    renderLoot({ tier: makeTier(players) });
    // Queues: no bridge anywhere (the F4-footer mount is gone).
    expect(screen.queryByTestId('weapon-bridge')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Weapons' }));
    expect(screen.getByTestId('weapon-bridge')).toBeInTheDocument();
    // No floor cards in the Weapons view.
    expect(screen.queryByTestId('floor-card')).not.toBeInTheDocument();
  });

  it('replaces the pills with a static floor label in Weapons, in place (R-5)', () => {
    renderLoot({ tier: makeTier(players) });
    expect(screen.getByRole('group', { name: 'Floor scope' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Weapons' }));
    expect(screen.queryByRole('group', { name: 'Floor scope' })).not.toBeInTheDocument();
    // aac-heavyweight floors: M9S…M12S — the label states the fixed scope.
    expect(screen.getByText('M12S · Floor 4')).toBeInTheDocument();
  });

  it('persists the Priority sub-view per user under v2-loot-priority-view (R-1)', () => {
    const { unmount } = renderLoot({ tier: makeTier(players) });
    fireEvent.click(screen.getByRole('button', { name: 'Weapons' }));
    expect(localStorage.getItem('v2-loot-priority-view')).toBe('weapons');
    unmount();

    // A fresh mount reads the stored choice.
    renderLoot({ tier: makeTier(players) });
    expect(screen.getByTestId('weapon-bridge')).toBeInTheDocument();
  });

  it('makes the first pill click a GLOBAL scope — view switches never move it (R-10)', () => {
    seedQueuesView();
    renderLoot({ tier: makeTier(players) });
    fireEvent.click(screen.getByRole('button', { name: 'M10S' }));
    let cards = screen.getAllByTestId('floor-card');
    expect(cards.map((c) => c.getAttribute('data-floor'))).toEqual(['2']);

    // Round-trip through Weapons and back: the explicit pick survives — the
    // per-view default (floor 1 on this fixture) must NOT reassert itself.
    fireEvent.click(screen.getByRole('button', { name: 'Weapons' }));
    fireEvent.click(screen.getByRole('button', { name: 'Queues' }));
    cards = screen.getAllByTestId('floor-card');
    expect(cards.map((c) => c.getAttribute('data-floor'))).toEqual(['2']);
  });

  it('shows "Log floor" only when a floor is scoped, and runs the wizard in single-floor mode (R-7)', () => {
    seedQueuesView();
    renderLoot({ tier: makeTier(players) });
    // Default fresh-tier scope is floor 1 — the button is present and targets it.
    fireEvent.click(screen.getByRole('button', { name: /log floor/i }));
    let wizard = screen.getByTestId('log-week-wizard');
    expect(wizard.getAttribute('data-single')).toBe('true');
    expect(wizard.getAttribute('data-floor')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    // The wizard closes on scope change? No — it closes only via onClose; close it here.
    act(() => { (wizardCalls[wizardCalls.length - 1].onClose as () => void)(); });

    // On All the button steps aside for the toolbar's whole-week wizard (R-7).
    expect(screen.queryByRole('button', { name: /log floor/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /log this week's loot/i }));
    wizard = screen.getByTestId('log-week-wizard');
    expect(wizard.getAttribute('data-single')).toBe('false');
  });

  it('pins "Log floor" to Floor 4 in the Weapons view (R-5/R-7)', () => {
    renderLoot({ tier: makeTier(players) });
    fireEvent.click(screen.getByRole('button', { name: 'Weapons' }));
    fireEvent.click(screen.getByRole('button', { name: /log floor/i }));
    const wizard = screen.getByTestId('log-week-wizard');
    expect(wizard.getAttribute('data-single')).toBe('true');
    expect(wizard.getAttribute('data-floor')).toBe('4');
  });

  it('hides the Priority controls row in the History view', () => {
    renderLoot({ tier: makeTier(players) }, ['/?lview=history']);
    expect(screen.queryByRole('button', { name: 'Queues' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Floor scope' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log floor/i })).not.toBeInTheDocument();
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
    seedQueuesView();
    renderLoot({ tier: makeTier(players) });
    // Priority is the default: floor cards present (one — the R-10 default), History body absent.
    expect(screen.getAllByTestId('floor-card')).toHaveLength(1);
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
    // The sender's ?shell= must be STRIPPED (coverage-plan D4): with the
    // session-sticky shell tier, a pinned value would lock the recipient's
    // whole tab into the sender's shell.
    window.history.pushState({}, '', '/group/g1?tier=xyz&shell=v2');
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
    expect(copied).not.toContain('shell=');
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

// ── D4: the triad, and the death of scopedWeek (R-13/R-15/R-20/R-22) ─────────
// `useLogWeek` is REAL here — these tests drive the displayed week through the
// mocked WeekScopeControl's captured `onWeekChange`, which is exactly the wire
// the real control uses, and observe the result through the props Loot hands
// back out (displayedWeek / picker / wizard) and the URL probe.
describe('Loot — D4 triad + the Log tab week model', () => {
  /** The toggle's own button (the toolbar also has "Log a drop"/"Log … loot"). */
  function viewButton(name: string): HTMLElement {
    return within(screen.getByRole('group', { name: 'Loot view' })).getByRole('button', { name });
  }

  /** Drive the Log week exactly as the real WeekScopeControl's chevrons do. */
  function setLogWeek(week: number) {
    const scopeProps = weekScopeCalls[weekScopeCalls.length - 1];
    act(() => {
      (scopeProps.onWeekChange as (w: number) => void)(week);
    });
  }

  // ── The `mirrorToUrl` gate at the call site (PR #235 final review) ──
  // `useLogWeek`'s 4th argument is `lview === 'log'`. Hardcoding it to EITHER
  // constant used to pass this whole suite, so both directions are pinned
  // here through observable URL behaviour (the hook is real in this file).
  // The gate only acts on a tier RE-resolve, so each test switches tier.
  const LOG_WEEK_KEY = (tierId: string) => `v2-history-week-g1-${tierId}`;

  /** Re-render the same tree pointed at a different tier — `Loot` mounts
   *  un-keyed under `NewShell`, so this is what a tier switch really does. */
  function switchTier(
    rerender: (ui: React.ReactElement) => void,
    tierId: string,
  ) {
    rerender(
      <MemoryRouter>
        <Loot {...baseProps} tier={makeTier(players, tierId)} />
        <LocationProbe />
      </MemoryRouter>,
    );
  }

  it('mirrors the week to ?week= on a tier switch while the LOG view is showing', () => {
    // Hardcoding the 4th argument to `false` fails here: the new tier's week
    // would never reach the URL.
    localStorage.setItem(LOG_WEEK_KEY('aac-heavyweight'), '2');
    localStorage.setItem(LOG_WEEK_KEY('aac-light'), '4');
    const { rerender } = renderLoot({ tier: makeTier(players) }, ['/?lview=log']);
    // A first resolve never mirrors — the week is displayed, not yet in the URL.
    expect(weekScopeCalls[weekScopeCalls.length - 1].displayedWeek).toBe(2);
    expect(screen.getByTestId('loc').getAttribute('data-search')).not.toContain('week=');

    switchTier(rerender, 'aac-light');

    expect(weekScopeCalls[weekScopeCalls.length - 1].displayedWeek).toBe(4);
    expect(screen.getByTestId('loc').getAttribute('data-search')).toContain('week=4');
  });

  it('does NOT mirror — it clears — on a tier switch while Priority is showing', () => {
    // Hardcoding the 4th argument to `true` fails here: a `?week=` would be
    // planted on a view that renders no week control to clear it with.
    localStorage.setItem(LOG_WEEK_KEY('aac-light'), '4');
    const { rerender } = renderLoot({ tier: makeTier(players) }, ['/?lview=priority&week=2']);
    // The mount deep link itself is never touched, whatever the view.
    expect(screen.getByTestId('loc').getAttribute('data-search')).toContain('week=2');

    switchTier(rerender, 'aac-light');

    expect(screen.getByTestId('loc').getAttribute('data-search')).not.toContain('week=');
  });

  it('lists Priority | Log | History in the view toggle, in that order', () => {
    renderLoot({ tier: makeTier(players) });
    const toggle = screen.getByRole('group', { name: 'Loot view' });
    expect(within(toggle).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Priority', 'Log', 'History',
    ]);
  });

  it('switches to Log via the toggle — grid body, week control, lview in the URL', () => {
    seedQueuesView();
    renderLoot({ tier: makeTier(players) });
    expect(screen.getAllByTestId('floor-card')).toHaveLength(1);
    expect(screen.queryByTestId('log-week-grid')).not.toBeInTheDocument();

    fireEvent.click(viewButton('Log'));

    // Drop 'log' from `lview`'s value list and `useUrlTabState`'s READ
    // (useUrlTabState.ts:81) falls back to 'priority' on the next render —
    // even though `setValue` (:83-96) still WRITES `?lview=log` to the URL
    // unconditionally, since the whitelist gates the read, not the write. So
    // the URL assertion below does NOT catch that mutation; the render
    // assertions that follow do (the grid never mounts, the floor cards
    // stay) — that's what this test actually proves. The route itself
    // landing on Log from a deep link is pinned separately, by
    // 'mounts the Log tab directly from an ?lview=log deep-link' below in
    // this describe block.
    expect(screen.getByTestId('log-week-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('floor-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('week-scope')).toBeInTheDocument();
    expect(screen.getByTestId('loc').getAttribute('data-search')).toContain('lview=log');
  });

  it('mounts the Log tab directly from an ?lview=log deep-link', () => {
    renderLoot({ tier: makeTier(players) }, ['/?lview=log']);
    expect(screen.getByTestId('log-week-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('floor-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('need-matrix')).not.toBeInTheDocument();
  });

  it('renders the Log subtitle on Log (not the fairness or History one)', () => {
    renderLoot({ tier: makeTier(players) }, ['/?lview=log']);
    expect(
      screen.getByText("The week's record — every drop, book and material, floor by floor"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/fairness rules/)).not.toBeInTheDocument();
    expect(screen.queryByText(/transparent record/)).not.toBeInTheDocument();
  });

  it('gives Priority NO week control at all — the week belongs to Log (R-13/R-15)', () => {
    // The discriminator for the death of scopedWeek: bring the pre-D4 model
    // back (WeekScopeControl slotted for anything that isn't History) and the
    // first assertion fails immediately.
    const priority = renderLoot({ tier: makeTier(players) });
    expect(screen.queryByTestId('week-scope')).not.toBeInTheDocument();
    priority.unmount();

    // History slots its own filter pills, not the week control…
    const history = renderLoot({ tier: makeTier(players) }, ['/?lview=history']);
    expect(screen.queryByTestId('week-scope')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All weeks' })).toBeInTheDocument();
    history.unmount();

    // …and Log is the one place it lives.
    renderLoot({ tier: makeTier(players) }, ['/?lview=log']);
    expect(screen.getByTestId('week-scope')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All weeks' })).not.toBeInTheDocument();
  });

  it('hands WeekScopeControl the RAW store slices the revert summary itemises', () => {
    // ⚠ WeekScopeControl decides WHETHER to open the revert summary from freshly
    // fetched store state, but the modal itemises from these props. Pass a
    // week-filtered or otherwise derived list and the modal opens on a positive
    // pre-check and renders "Nothing logged for Week N". Seed entries on a week
    // OTHER than the displayed one: a filtered slice would drop them.
    const loot = [makeLootEntry({ id: 1, weekNumber: 1 })];
    const material = [makeMaterialEntry({ id: 2, weekNumber: 1 })];
    useLootTrackingStore.setState({ lootLog: loot, materialLog: material, pageLedger: [] });
    renderLoot({ tier: makeTier(players) }, ['/?lview=log']);

    const scopeProps = weekScopeCalls[weekScopeCalls.length - 1];
    expect(scopeProps.lootLog).toBe(useLootTrackingStore.getState().lootLog);
    expect(scopeProps.materialLog).toBe(useLootTrackingStore.getState().materialLog);
    expect(scopeProps.pageLedger).toBe(useLootTrackingStore.getState().pageLedger);
    // `players` is the full tier roster (subs included) — the summary names
    // whoever actually received something, not just the main eight.
    expect((scopeProps.players as SnapshotPlayer[]).map((p) => p.id)).toEqual(['p1', 'p2', 's1']);
  });

  it('D8: the free-form material door targets the Log tab\'s displayed week, not the clock\'s', () => {
    renderLoot({ tier: makeTier(players) }, ['/?lview=log']);
    setLogWeek(2);
    expect(weekScopeCalls[weekScopeCalls.length - 1].displayedWeek).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: /log material/i }));
    const last = materialModalCalls[materialModalCalls.length - 1];
    expect(last.initialWeek).toBe(2);
  });

  it('targets the displayed week from Log and the clock week everywhere else (R-20 split)', () => {
    // Queues (not Who Needs It) so switching back to Priority below renders floor
    // cards — needed for the FloorCard invariant assertion further down.
    seedQueuesView();
    // The clock is week 3; the Log is stepped back to week 1.
    renderLoot({ tier: makeTier(players) }, ['/?lview=log']);
    setLogWeek(1);
    expect(weekScopeCalls[weekScopeCalls.length - 1].displayedWeek).toBe(1);
    // R-22: canPrev/canNext are the hook's real bounds, not hardcoded — week 1
    // has nowhere to prev to. A `canPrev={true}` stub fails this.
    expect(weekScopeCalls[weekScopeCalls.length - 1].canPrev).toBe(false);
    // canNext's OTHER bound: week 1 has somewhere to go next (maxWeek is 5).
    // A hardcoded `canNext={false}` stub — permanently disabling the
    // Next-week chevron for every user — fails this.
    expect(weekScopeCalls[weekScopeCalls.length - 1].canNext).toBe(true);

    // groupId/tierId must be the real static + tier, never swapped or
    // aliased to each other — the revert pre-check fetches against these, so
    // a swap targets a foreign static/tier's data and overwrites the store's
    // logs with it.
    expect(weekScopeCalls[weekScopeCalls.length - 1].groupId).toBe('g1');
    expect(weekScopeCalls[weekScopeCalls.length - 1].tierId).toBe('aac-heavyweight');

    // R-22 headline affordance, end-to-end: invoke the captured `onFollowClock`
    // exactly as the real WeekScopeControl's go-to-current control would, and
    // confirm the Log week actually returns to the clock's week (3) and
    // `?week=` is cleared. A `onFollowClock={() => {}}` stub leaves
    // `displayedWeek` at 1 and `week=1` in the URL, failing both assertions.
    act(() => {
      (weekScopeCalls[weekScopeCalls.length - 1].onFollowClock as () => void)();
    });
    expect(weekScopeCalls[weekScopeCalls.length - 1].displayedWeek).toBe(3);
    expect(weekScopeCalls[weekScopeCalls.length - 1].canPrev).toBe(true);
    expect(screen.getByTestId('loc').getAttribute('data-search')).not.toContain('week=');

    // R-22: canNext is likewise the hook's real bound — the seeded clock's
    // maxWeek is 5, so week 5 has nowhere to next to. A `canNext={true}` stub
    // fails this.
    setLogWeek(5);
    expect(weekScopeCalls[weekScopeCalls.length - 1].canNext).toBe(false);

    // Re-diverge so the rest of this test (which targets week 1 from Log) is
    // unaffected by the go-to-current/bounds probes above.
    setLogWeek(1);
    expect(weekScopeCalls[weekScopeCalls.length - 1].displayedWeek).toBe(1);

    // From Log both write paths target the displayed week…
    fireEvent.click(screen.getByRole('button', { name: /log a drop/i }));
    expect(pickerCalls[pickerCalls.length - 1].currentWeek).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Log Week 1 loot' }));
    expect(wizardCalls[wizardCalls.length - 1].currentWeek).toBe(1);

    // …and from Priority — same instance, so the Log week genuinely still
    // holds 1 — both fall back to the clock's week 3. A `writeWeek` wired
    // unconditionally to either side fails one half of this test.
    fireEvent.click(viewButton('Priority'));
    // The slice's central invariant (R-15): Priority's FloorCards are ALWAYS
    // pinned to the clock's week (3), never the Log's displayed week (1),
    // which is still in effect here. This is the one assertion in the suite
    // that can tell `currentWeek={clock.currentWeek}` (Loot.tsx) apart from
    // an accidental `currentWeek={logWeek.week}` — every other `data-week`
    // check in this file runs while the two happen to be equal.
    expect(screen.getAllByTestId('floor-card')[0].getAttribute('data-week')).toBe('3');
    fireEvent.click(screen.getByRole('button', { name: /log a drop/i }));
    expect(pickerCalls[pickerCalls.length - 1].currentWeek).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: "Log this week's loot" }));
    expect(wizardCalls[wizardCalls.length - 1].currentWeek).toBe(3);
  });

  it("names the week on the wizard action when Log isn't showing the clock's week (R-22)", () => {
    renderLoot({ tier: makeTier(players) }, ['/?lview=log']);
    // At the clock's own week the copy is unchanged…
    expect(screen.getByRole('button', { name: "Log this week's loot" })).toBeInTheDocument();

    setLogWeek(1);

    // …and names the week once they diverge. Drop `logWeekLabel` and the button
    // keeps claiming "this week" while writing to week 1.
    expect(screen.getByRole('button', { name: 'Log Week 1 loot' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Log this week's loot" })).not.toBeInTheDocument();
  });

  it('re-points the Log week to the week a Log wizard run logged (R-20)', () => {
    renderLoot({ tier: makeTier(players) }, ['/?lview=log']);
    expect(weekScopeCalls[weekScopeCalls.length - 1].displayedWeek).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: "Log this week's loot" }));
    act(() => {
      (wizardCalls[wizardCalls.length - 1].onSuccess as (w: number) => void)(2);
    });

    expect(weekScopeCalls[weekScopeCalls.length - 1].displayedWeek).toBe(2);
    expect(screen.getByTestId('loc').getAttribute('data-search')).toContain('week=2');
  });

  it('a wizard run from Priority moves no week (R-20: nothing is displayed to move)', () => {
    // Drop the `lview === 'log'` guard on the wizard's onSuccess and a Priority
    // run silently writes `?week=2` — which legacy History reads too.
    renderLoot({ tier: makeTier(players) });
    fireEvent.click(screen.getByRole('button', { name: "Log this week's loot" }));
    act(() => {
      (wizardCalls[wizardCalls.length - 1].onSuccess as (w: number) => void)(2);
    });

    expect(screen.getByTestId('loc').getAttribute('data-search')).not.toContain('week=');
    expect(localStorage.getItem('v2-history-week-g1-aac-heavyweight')).toBeNull();
  });

  it("strips ?week= from a copied History link so it can't ship the sender's Log week", async () => {
    // copyLink builds from the REAL location, so seed a week there. Leaving it
    // emergent would ship the sender's week — into legacy's History view too,
    // which reads the same shared param.
    window.history.pushState({}, '', '/group/g1?tier=xyz&week=4');
    const writeText = vi.fn().mockResolvedValue(undefined);
    // Captured so the redefinition is undone — leaving a fake `navigator.
    // clipboard` installed leaks into every test that runs after this one.
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    restoreClipboard = () => {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'clipboard');
    };
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    useLootTrackingStore.setState({ lootLog: [makeLootEntry({ id: 21, weekNumber: 3 })] });
    renderLoot({ tier: makeTier(players) }, ['/?lview=history']);

    const row = document.getElementById('loot-entry-21')!;
    fireEvent.keyDown(within(row).getByRole('button', { name: 'Entry actions' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy link' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain('tier=xyz');
    expect(copied).not.toContain('week=');
  });
});

// ── D5: LogWeekGrid wired into the Log body + the R-21 material edit door ────
// `LogWeekGrid` and `suggestedMaterialRecipient` are mocked (prop-capturing, the
// D8 modal-mock precedent above) so this suite asserts only Loot's OWN wiring:
// the grid mounts at the Log tab's DISPLAYED week (not the clock's), and its
// four callbacks route to the right door with the right roster. The retired
// placeholder's own absence pins live in the D4-triad describe above.
describe('Loot — D5: LogWeekGrid + the material edit door', () => {
  function lastGrid() {
    return gridCalls[gridCalls.length - 1];
  }

  it('mounts LogWeekGrid on Log at the DISPLAYED week, not the clock week (vacuous-assert trap: drive them apart first)', () => {
    // The clock is seeded at week 3 (beforeEach) — a `?week=` on mount is the
    // Log tab's FIRST resolve, so it wins outright (useLogWeek.ts). Diverge
    // from 3 here so `week={logWeek.week}` and an accidental
    // `week={clock.currentWeek}` produce DIFFERENT numbers — see Step 5's
    // deletion trace, which fails exactly this assertion.
    renderLoot({ tier: makeTier(players) }, ['/?lview=log&week=1']);
    expect(screen.getByTestId('log-week-grid')).toBeInTheDocument();
    const last = lastGrid();
    expect(last.week).toBe(1);
    expect(last.week).not.toBe(3);
    expect(last.canEdit).toBe(true);
    // mainRosterPlayers = [Alice, Bob] (Sub excluded) — non-empty.
    expect(last.canAssignMaterial).toBe(true);
  });

  it('onAssignGear opens the picker in assign mode, floor name resolved from floorNumber, at the displayed week', () => {
    renderLoot({ tier: makeTier(players) }, ['/?lview=log&week=1']);
    act(() => {
      (lastGrid().onAssignGear as (i: { slot: string; label: string; floorNumber: number }) => void)({
        slot: 'ring', label: 'Ring', floorNumber: 1,
      });
    });
    const picker = screen.getByTestId('recipient-picker');
    expect(picker).toHaveAttribute('data-mode', 'assign');
    const last = pickerCalls[pickerCalls.length - 1];
    expect(last.mode).toBe('assign');
    // aac-heavyweight floors: M9S…M12S — floorNumber 1 resolves to floors[0].
    expect(last.item).toMatchObject({ slot: 'ring', label: 'Ring', floorNumber: 1, floorName: 'M9S' });
    expect(last.currentWeek).toBe(1);
  });

  it('onEditGear opens the picker in edit mode with that entry', () => {
    renderLoot({ tier: makeTier(players) }, ['/?lview=log']);
    const entry = makeLootEntry({ id: 42 });
    act(() => {
      (lastGrid().onEditGear as (e: LootLogEntry) => void)(entry);
    });
    const picker = screen.getByTestId('recipient-picker');
    expect(picker).toHaveAttribute('data-mode', 'edit');
    expect(picker).toHaveAttribute('data-edit-id', '42');
  });

  it('onAssignMaterial opens the pinned door with allowSubs + the FULL roster, and the CLOCK-week suggestion (R-D5c)', () => {
    const suggested = makePlayer('p2', 'Bob');
    suggestedMaterialRecipientMock.mockReturnValue(suggested);
    // Displayed week (1) diverges from the clock week (3) — proves the
    // suggestion runs against the clock, not the displayed week, while the
    // WRITE (initialWeek) still targets the displayed week.
    renderLoot({ tier: makeTier(players) }, ['/?lview=log&week=1']);
    act(() => {
      (lastGrid().onAssignMaterial as (m: string, f: number) => void)('glaze', 2);
    });

    expect(suggestedMaterialRecipientMock).toHaveBeenCalledWith(
      expect.objectContaining({ material: 'glaze', currentWeek: 3 }),
    );

    expect(screen.getByTestId('material-modal')).toBeInTheDocument();
    const last = materialModalCalls[materialModalCalls.length - 1];
    // floorNumber 2 resolves to floors[1] = 'M10S'.
    expect(last.floor).toBe('M10S');
    expect(last.material).toBe('glaze');
    expect(last.initialWeek).toBe(1);
    expect(last.showNotes).toBe(true);
    // R-D5a: ONLY the grid's door widens — allowSubs true, allPlayers the FULL
    // roster, pinned on identity against the same array RecipientPicker gets
    // (a fixture containing a substitute, so a values-only check couldn't
    // distinguish this from mainRosterPlayers coincidentally matching).
    expect(last.allowSubs).toBe(true);
    expect(last.suggestedPlayer).toBe(suggested);
    expect(last.allPlayers).toBe(pickerCalls[pickerCalls.length - 1].players);
  });

  it('falls back to mainRosterPlayers[0] when suggestedMaterialRecipient returns undefined', () => {
    suggestedMaterialRecipientMock.mockReturnValue(undefined);
    renderLoot({ tier: makeTier(players) }, ['/?lview=log']);
    act(() => {
      (lastGrid().onAssignMaterial as (m: string, f: number) => void)('twine', 3);
    });
    const last = materialModalCalls[materialModalCalls.length - 1];
    // mainRosterPlayers[0] is Alice (p1) — identity against the wizard's own
    // `players` prop, which is also fed `mainRosterPlayers`.
    expect(last.suggestedPlayer).toBe((wizardCalls[wizardCalls.length - 1].players as SnapshotPlayer[])[0]);
  });

  it('onEditMaterial opens the EDIT door with the FULL roster, not mainRosterPlayers (§5(a))', () => {
    renderLoot({ tier: makeTier(players) }, ['/?lview=log']);
    const entry = makeMaterialEntry({ id: 99 });
    act(() => {
      (lastGrid().onEditMaterial as (e: MaterialLogEntry) => void)(entry);
    });
    const last = materialModalCalls[materialModalCalls.length - 1];
    expect(last.editEntry).toBe(entry);
    expect(last.floors).toEqual(['M9S', 'M10S', 'M11S', 'M12S']);
    // FULL roster — the entry's recipient may be a substitute — pinned on
    // identity against the fixture containing one (RecipientPicker also gets
    // the unfiltered `players`, so this is the same array reference).
    expect(last.allPlayers).toBe(pickerCalls[pickerCalls.length - 1].players);
    expect((last.allPlayers as SnapshotPlayer[]).map((p) => p.id)).toEqual(['p1', 'p2', 's1']);
  });
});

// A10 void'd-promise sweep: the mount effect void'd four re-throwing fetches
// (fetchWeekDataTypes does NOT re-throw — left bare), and refresh() void'd the
// re-throwing fetchCurrentWeek (fetchTier does not re-throw — left bare).
describe("Loot — A10 void'd-promise fixes", () => {
  it('mount fetches: rejecting store fetches surface ONE error toast instead of unhandled rejections', async () => {
    useLootTrackingStore.setState({
      fetchLootLog: vi.fn().mockRejectedValue(new Error('boom')),
      fetchMaterialLog: vi.fn().mockRejectedValue(new Error('boom')),
      fetchPageLedger: vi.fn().mockRejectedValue(new Error('boom')),
      fetchCurrentWeek: vi.fn().mockRejectedValue(new Error('boom')),
    });
    renderLoot({ tier: makeTier(players) });
    await waitFor(() => {
      expect(useToastStore.getState().toasts.filter(
        (t) => t.type === 'error' && t.message === 'Failed to load loot data',
      )).toHaveLength(1);
    });
  });

  it('refresh(): a rejecting fetchCurrentWeek surfaces an error toast instead of an unhandled rejection', async () => {
    renderLoot({ tier: makeTier(players) });
    // Re-stub AFTER mount. The mount effect re-runs with the rejecting stub too
    // (fetchCurrentWeek is a dep) — the fixed effect catches that with the
    // 'Failed to load loot data' toast; the refresh-specific message below is
    // the discriminating assertion for THIS site.
    act(() => {
      useLootTrackingStore.setState({
        fetchCurrentWeek: vi.fn().mockRejectedValue(new Error('boom')),
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /log a drop/i }));
    const picker = pickerCalls[pickerCalls.length - 1];
    act(() => {
      (picker.onSuccess as () => void)();
    });
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'Failed to refresh the week clock',
      )).toBe(true);
    });
  });
});
