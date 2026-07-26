// `@testing-library/user-event` is not a dependency of this project, so every
// existing test drives interaction via `fireEvent` (see RosterToolbar.test) —
// we follow that convention. This suite mocks the wiring hooks/stores
// (`useGroupViewState`, `usePlayerActions`, `authStore`, `viewAsStore`) so the
// assembly renders purely from fixture players, and stubs the heavy leaf
// components (`RosterCard`, `CharacterManageBridge`) so we assert only the
// Roster assembly's own contract: header + subtitle, a card per player, and the
// once-per-screen gear-source legend.
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { SnapshotPlayer, StaticGroup, TierSnapshot } from '../../types';

// ── Wiring mocks ──────────────────────────────────────────────────────────────
const setGroupView = vi.fn();
const setSubsView = vi.fn();
const setSortPreset = vi.fn();
const setEditingPlayerId = vi.fn();
const setClipboardPlayer = vi.fn();
let mockClipboardPlayer: SnapshotPlayer | null = null;

vi.mock('../../hooks/useGroupViewState', () => ({
  useGroupViewState: () => ({
    searchParams: new URLSearchParams(),
    groupView: true,
    setGroupView,
    subsView: true,
    setSubsView,
    sortPreset: 'standard',
    setSortPreset,
    setEditingPlayerId,
    clipboardPlayer: mockClipboardPlayer,
    setClipboardPlayer,
  }),
}));

const playerActions = {
  handleUpdatePlayer: vi.fn(),
  handleRemovePlayer: vi.fn(),
  handleClaimPlayer: vi.fn(),
  handleReleasePlayer: vi.fn(),
  handleAdminAssignPlayer: vi.fn(),
  handleOwnerAssignPlayer: vi.fn(),
  handleConfigurePlayer: vi.fn(),
  handleAddPlayer: vi.fn(),
  handleDuplicatePlayer: vi.fn(),
  handleResetGear: vi.fn(),
  handleReorder: vi.fn(),
};
vi.mock('../../hooks/usePlayerActions', () => ({
  usePlayerActions: () => playerActions,
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: string; isAdmin: boolean } }) => unknown) =>
    selector({ user: { id: 'u1', isAdmin: false } }),
}));

vi.mock('../../stores/viewAsStore', () => ({
  useViewAsStore: (selector: (s: { viewAsUser: null }) => unknown) =>
    selector({ viewAsUser: null }),
}));

// Phase A A1: Roster's "Add player" goes through the SHARED AddPlayerModal
// flow (useGroupActions().onAddPlayer). Roster renders WITHOUT a
// <GroupActionModals> provider in this suite, so the context hook must be
// mocked (it throws outside a provider). Same shape NewShell.roster.test.tsx
// already uses.
const groupActionsOnAddPlayer = vi.fn();
vi.mock('../../pages/groupActionsContext', () => ({
  // C1: Roster also reads the chrome modal-open flag to gate the V shortcut
  // (real hook returns false outside a provider; mirror that here).
  useGroupActionModalOpen: () => false,
  useGroupActions: () => ({
    onTierChange: vi.fn(),
    onAddPlayer: groupActionsOnAddPlayer,
    onNewTier: vi.fn(),
    onRollover: vi.fn(),
    onDeleteTier: vi.fn(),
  }),
}));

// RosterCard is heavy (kebab, modals, inline edits) — stub it so we only assert
// the assembly's card-per-player contract.
vi.mock('./RosterCard', () => ({
  RosterCard: ({ player, actions }: {
    player: SnapshotPlayer;
    actions: { onCopyUrl?: () => void; onPaste?: () => void };
  }) => (
    <div data-testid="roster-card">
      {player.name}
      <button data-testid={`copy-url-${player.id}`} onClick={() => actions.onCopyUrl?.()}>
        copy url
      </button>
      <button data-testid={`paste-${player.id}`} onClick={() => actions.onPaste?.()}>
        paste
      </button>
    </div>
  ),
}));

// CharacterManageBridge pulls the character panel + its stores — stub it.
vi.mock('./CharacterManageBridge', () => ({
  CharacterManageBridge: () => <div data-testid="char-bridge" />,
}));

import { Roster } from './Roster';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useToastStore } from '../../stores/toastStore';
import type { GearSlotStatus } from '../../types';

function makePlayer(overrides: Partial<SnapshotPlayer> & { id: string }): SnapshotPlayer {
  return {
    tierSnapshotId: 't1',
    name: 'Player',
    job: 'PLD',
    role: 'tank',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {},
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as unknown as SnapshotPlayer;
}

const group = {
  id: 'g1',
  name: 'Test Static',
  userRole: 'owner',
  isAdminAccess: false,
} as unknown as StaticGroup;

function makeTier(players: SnapshotPlayer[]): TierSnapshot {
  return { tierId: 't1', contentType: 'savage', players } as unknown as TierSnapshot;
}

const baseProps = {
  group,
  canManage: true,
  onNavigate: vi.fn(),
  onOpenRequests: vi.fn(),
};

// `useUrlTabState` reads react-router's `useSearchParams`, so renders must be
// wrapped in a router. We use BrowserRouter (reads window.location) so a test
// can seed `?rview=board` via history.pushState before rendering.
function renderRoster(tier: TierSnapshot | null) {
  return render(
    <BrowserRouter>
      <Roster {...baseProps} tier={tier} />
    </BrowserRouter>,
  );
}

// The `?player=` deep-link effect reads `useSearchParams()` directly (NOT via
// the mocked `useGroupViewState`, which always returns a fixed, URL-independent
// snapshot — see Roster.tsx's deep-link effect comment), so these tests need a
// router that actually reflects the seeded URL. `MemoryRouter` + `initialEntries`
// (same pattern as Loot.test.tsx / Schedule.test.tsx) rather than the
// `BrowserRouter` + `history.pushState` convention above.
function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-search={loc.search} />;
}

function renderRosterAtUrl(tier: TierSnapshot | null, initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Roster {...baseProps} tier={tier} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  groupActionsOnAddPlayer.mockClear();
  playerActions.handleAddPlayer.mockClear();
  playerActions.handleConfigurePlayer.mockClear();
  window.history.pushState({}, '', '/group/DEVTST?tab=roster');
  mockClipboardPlayer = null;
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  useToastStore.setState({ toasts: [] });
  // Roster now subscribes to lootTrackingStore and fires three fetch actions
  // on mount (fetchLootLog / fetchMaterialLog / fetchCurrentWeek — the material
  // log feeds the C4 tome-weapon jump). Stub them via setState so they never
  // fall through to the real api client — unstubbed they reject with
  // ECONNREFUSED in CI (no backend) as an unhandled rejection. Same pattern as
  // Loot.test.tsx.
  useLootTrackingStore.setState({
    lootLog: [], materialLog: [], currentWeek: 1,
    fetchLootLog: vi.fn().mockResolvedValue(undefined),
    fetchMaterialLog: vi.fn().mockResolvedValue(undefined),
    fetchCurrentWeek: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

/** A gear array with a single raid BiS-target `body` slot still needed. */
function bodyNeededGear(): GearSlotStatus[] {
  return [
    { slot: 'body', bisSource: 'raid', hasItem: false, isAugmented: false },
    { slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false },
  ] as GearSlotStatus[];
}

describe('Roster', () => {
  it('renders the "Roster" header with a raider-count subtitle, a card per player, and the gear-source legend', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' }),
      makePlayer({ id: 'p2', name: 'Healer One', job: 'WHM', role: 'healer', position: 'H1' }),
    ];

    renderRoster(makeTier(players));

    // Page header + dynamic subtitle with the raider count.
    expect(screen.getByRole('heading', { name: 'Roster' })).toBeInTheDocument();
    expect(screen.getByText(/2 raiders/)).toBeInTheDocument();

    // A card per configured player.
    expect(screen.getAllByTestId('roster-card')).toHaveLength(2);
    expect(screen.getByText('Tank One')).toBeInTheDocument();
    expect(screen.getByText('Healer One')).toBeInTheDocument();

    // The once-per-screen gear-source legend (default swatches).
    expect(screen.getByText('tome (aug)')).toBeInTheDocument();
    expect(screen.getByText('needed')).toBeInTheDocument();

    // Toolbar "Add player" control is present and enabled for a manager.
    expect(screen.getByRole('button', { name: /add player/i })).toBeEnabled();
  });

  it('renders a singular "1 raider" subtitle and tolerates a null tier', () => {
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Solo' })]));
    expect(screen.getByText(/1 raider\b/)).toBeInTheDocument();

    renderRoster(null);
    expect(screen.getAllByRole('heading', { name: 'Roster' }).length).toBeGreaterThan(0);
  });

  // With rview=board in the URL, the Board matrix renders instead of the cards grid.
  it('renders the Board (gear matrix) when rview=board', () => {
    window.history.pushState({}, '', '/group/DEVTST?tab=roster&rview=board');
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' })]));
    // Board has a "Player" column header + the Board subtitle names BiS slots.
    expect(screen.getByRole('columnheader', { name: 'Player' })).toBeInTheDocument();
    expect(screen.getByText(/BiS slots obtained/i)).toBeInTheDocument();
  });

  // The Board lights the next-upgrade (●) glyph for the #1 needer of a slot and
  // adds the swatch to the legend; disabling priority in settings removes both.
  it('shows the next-upgrade glyph + legend swatch on the Board when priority is active', () => {
    window.history.pushState({}, '', '/group/DEVTST?tab=roster&rview=board');
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One', role: 'melee', position: 'M1', gear: bodyNeededGear() })]));
    expect(screen.getAllByText('●').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('● next upgrade')).toBeInTheDocument();
  });

  it('renders no next-upgrade glyph on the Board when priority is disabled in settings', () => {
    window.history.pushState({}, '', '/group/DEVTST?tab=roster&rview=board');
    const disabledGroup = { ...group, settings: { priorityMode: 'disabled' } } as unknown as StaticGroup;
    render(
      <BrowserRouter>
        <Roster {...baseProps} group={disabledGroup} tier={makeTier([makePlayer({ id: 'p1', name: 'Tank One', role: 'melee', position: 'M1', gear: bodyNeededGear() })])} />
      </BrowserRouter>,
    );
    expect(screen.queryByText('●')).not.toBeInTheDocument();
  });

  // Phase A A1 — the toolbar's Add player must open the SHARED AddPlayerModal
  // flow (create + configure atomically), NEVER the raw blank-slot primitive
  // (which left permanently-stuck `configured: false` slots).
  it('wires the toolbar "Add player" to useGroupActions().onAddPlayer, not the raw blank-slot primitive', () => {
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' })]));

    fireEvent.click(screen.getByRole('button', { name: /add player/i }));

    expect(groupActionsOnAddPlayer).toHaveBeenCalledTimes(1);
    expect(playerActions.handleAddPlayer).not.toHaveBeenCalled();
  });

  // Phase A A1 — an open seat's inline configure routes through
  // handleConfigurePlayer with THAT seat's id (real RosterCards + OpenSeatCard;
  // only the RosterCard leaf is stubbed in this suite).
  it("routes an open seat's inline configure to handleConfigurePlayer with that seat's id", () => {
    renderRoster(makeTier([
      makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' }),
      makePlayer({ id: 'p2', name: '', job: '', configured: false, position: 'H1', templateRole: 'pure-healer' }),
    ]));

    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: 'New Healer' } });
    fireEvent.click(screen.getByTitle('WHM - White Mage'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(playerActions.handleConfigurePlayer).toHaveBeenCalledWith('p2', 'New Healer', 'WHM', 'healer');
  });
});

// `?player=` deep link (Spec §3.2 / flip-P1 readiness Task 2). GroupViewContent's
// shared effect (GroupViewContent.tsx:234-257) owns the tab-switch, the 100ms
// scroll, and the 2500ms clear + URL-strip — but its `highlightedPlayerId`
// state never reaches this slotted Roster. Roster must resolve the id against
// ITS OWN players, track its own local highlight, render the SAME
// `player-card-${id}` anchor id the shared effect scrolls to, and — critically
// — never touch the URL itself (the shared effect owns the strip).
describe('Roster — ?player= deep link', () => {
  it('anchors + highlights the matching card; other cards get the anchor id without the highlight', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' }),
      makePlayer({ id: 'p2', name: 'Healer One', job: 'WHM', role: 'healer', position: 'H1' }),
    ];

    const { container } = renderRosterAtUrl(
      makeTier(players),
      ['/group/DEVTST?tab=roster&player=p2'],
    );

    const targetCard = container.querySelector('#player-card-p2');
    expect(targetCard).not.toBeNull();
    expect(targetCard).toHaveClass('highlight-pulse');

    const otherCard = container.querySelector('#player-card-p1');
    expect(otherCard).not.toBeNull();
    expect(otherCard).not.toHaveClass('highlight-pulse');
  });

  it('clears the highlight 2500ms after it is set', () => {
    vi.useFakeTimers();
    const players = [makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' })];

    const { container } = renderRosterAtUrl(
      makeTier(players),
      ['/group/DEVTST?tab=roster&player=p1'],
    );

    expect(container.querySelector('#player-card-p1')).toHaveClass('highlight-pulse');

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(container.querySelector('#player-card-p1')).not.toHaveClass('highlight-pulse');
    // Roster's clear-timer effect must only clear the local highlight — never
    // touch the URL. GroupViewContent.tsx:248-255 owns the `player` strip on its
    // OWN 2500ms timer; a copy-paste of that strip into THIS effect (same magic
    // number) must fail here, not just in the synchronous no-strip test below.
    expect(screen.getByTestId('loc').dataset.search).toContain('player=p1');
  });

  it('does not highlight (and does not crash) for an unresolvable player id', () => {
    const players = [makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' })];

    const { container } = renderRosterAtUrl(
      makeTier(players),
      ['/group/DEVTST?tab=roster&player=does-not-exist'],
    );

    expect(container.querySelector('.highlight-pulse')).toBeNull();
    // The card itself still renders (with its anchor id) — resolution merely
    // found no match, it didn't blow up the render.
    expect(container.querySelector('#player-card-p1')).not.toBeNull();
  });

  it('does not strip the ?player= param from the URL (GroupViewContent owns the strip)', () => {
    const players = [makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' })];

    renderRosterAtUrl(makeTier(players), ['/group/DEVTST?tab=roster&player=p1']);

    expect(screen.getByTestId('loc').dataset.search).toContain('player=p1');
  });
});

// A10 void'd-promise sweep: every site below previously void'd a re-throwing
// store action (unhandled rejection → phantom /api/analytics/errors POST), and
// handleCopyUrl toasted "Link copied" before/regardless of the clipboard write.
// Vitest fails the run on genuine unhandled rejections — a free regression guard.
describe("Roster — A10 void'd-promise fixes", () => {
  it('handleCopyUrl: success toast fires only after the clipboard write resolves', async () => {
    let resolveWrite!: () => void;
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(() => new Promise<void>((res) => { resolveWrite = res; })) },
    });
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One' })]));
    fireEvent.click(screen.getByTestId('copy-url-p1'));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    // Write still pending — the old code toasted success synchronously here.
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success')).toBe(false);
    resolveWrite();
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'success' && t.message === 'Link copied to clipboard',
      )).toBe(true);
    });
  });

  it('handleCopyUrl: a rejected clipboard write shows an error toast and never a success toast', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One' })]));
    fireEvent.click(screen.getByTestId('copy-url-p1'));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === "Couldn't copy the link",
      )).toBe(true);
    });
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success')).toBe(false);
  });

  it('handlePastePlayer: a rejected update surfaces an error toast instead of an unhandled rejection', async () => {
    mockClipboardPlayer = makePlayer({ id: 'src', name: 'Source' });
    playerActions.handleUpdatePlayer.mockRejectedValueOnce(new Error('update failed'));
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One' })]));
    fireEvent.click(screen.getByTestId('paste-p1'));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'update failed',
      )).toBe(true);
    });
  });

  // Whole-branch review Finding 2: the PREFERRED fix guards at the SOURCE
  // (this closure), not per-consumer — grep confirmed no consumer of
  // RosterCardActions.onRemove awaits it or depends on its rejection, so a
  // single guard here fixes OpenSeatCard's Remove AND the kebab Remove
  // confirm (useRosterCardActions.tsx) in one place. This test drives the
  // REAL (unstubbed) OpenSeatCard path — the only consumer reachable without
  // also un-stubbing the heavy RosterCard.
  it('onRemove (open seat): a rejected handleRemovePlayer surfaces an error toast instead of an unhandled rejection', async () => {
    playerActions.handleRemovePlayer.mockRejectedValueOnce(new Error('remove failed'));
    renderRoster(makeTier([
      makePlayer({ id: 'p1', name: '', job: '', configured: false, position: 'H1', templateRole: 'pure-healer' }),
    ]));
    fireEvent.click(screen.getByRole('button', { name: 'Remove open seat' }));
    expect(playerActions.handleRemovePlayer).toHaveBeenCalledWith('p1');
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'remove failed',
      )).toBe(true);
    });
  });

  it('mount fetches: rejecting store fetches surface ONE error toast instead of unhandled rejections', async () => {
    const fetchLootLog = vi.fn().mockRejectedValue(new Error('boom'));
    const fetchMaterialLog = vi.fn().mockRejectedValue(new Error('boom'));
    const fetchCurrentWeek = vi.fn().mockRejectedValue(new Error('boom'));
    useLootTrackingStore.setState({ fetchLootLog, fetchMaterialLog, fetchCurrentWeek });
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One' })]));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.filter(
        (t) => t.type === 'error' && t.message === 'Failed to load loot data',
      )).toHaveLength(1);
    });
    // The mount batch fires all three (the material log is what lights the C4
    // tome-weapon jump on a direct roster landing).
    expect(fetchLootLog).toHaveBeenCalledTimes(1);
    expect(fetchMaterialLog).toHaveBeenCalledTimes(1);
    expect(fetchCurrentWeek).toHaveBeenCalledTimes(1);
  });
});
