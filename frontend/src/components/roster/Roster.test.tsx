// `@testing-library/user-event` is not a dependency of this project, so every
// existing test drives interaction via `fireEvent` (see RosterToolbar.test) —
// we follow that convention. This suite mocks the wiring hooks/stores
// (`useGroupViewState`, `usePlayerActions`, `authStore`, `viewAsStore`) so the
// assembly renders purely from fixture players, and stubs the heavy leaf
// components (`RosterCard`, `CharacterManageBridge`) so we assert only the
// Roster assembly's own contract: header + subtitle, a card per player, and the
// once-per-screen gear-source legend.
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { SnapshotPlayer, StaticGroup, TierSnapshot } from '../../types';

// ── Wiring mocks ──────────────────────────────────────────────────────────────
const setGroupView = vi.fn();
const setSubsView = vi.fn();
const setSortPreset = vi.fn();
const setEditingPlayerId = vi.fn();
const setClipboardPlayer = vi.fn();

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
    clipboardPlayer: null,
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

// RosterCard is heavy (kebab, modals, inline edits) — stub it so we only assert
// the assembly's card-per-player contract.
vi.mock('./RosterCard', () => ({
  RosterCard: ({ player }: { player: SnapshotPlayer }) => (
    <div data-testid="roster-card">{player.name}</div>
  ),
}));

// CharacterManageBridge pulls the character panel + its stores — stub it.
vi.mock('./CharacterManageBridge', () => ({
  CharacterManageBridge: () => <div data-testid="char-bridge" />,
}));

import { Roster } from './Roster';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
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

beforeEach(() => {
  window.history.pushState({}, '', '/group/DEVTST?shell=v2&tab=roster');
  // Roster now subscribes to lootTrackingStore and fires two fetch actions on
  // mount (fetchLootLog / fetchCurrentWeek). Stub them via setState so they never
  // fall through to the real api client — unstubbed they reject with
  // ECONNREFUSED in CI (no backend) as an unhandled rejection. Same pattern as
  // Loot.test.tsx.
  useLootTrackingStore.setState({
    lootLog: [], currentWeek: 1,
    fetchLootLog: vi.fn().mockResolvedValue(undefined),
    fetchCurrentWeek: vi.fn().mockResolvedValue(undefined),
  });
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
    window.history.pushState({}, '', '/group/DEVTST?shell=v2&tab=roster&rview=board');
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' })]));
    // Board has a "Player" column header + the Board subtitle names BiS slots.
    expect(screen.getByRole('columnheader', { name: 'Player' })).toBeInTheDocument();
    expect(screen.getByText(/BiS slots obtained/i)).toBeInTheDocument();
  });

  // The Board lights the next-upgrade (●) glyph for the #1 needer of a slot and
  // adds the swatch to the legend; disabling priority in settings removes both.
  it('shows the next-upgrade glyph + legend swatch on the Board when priority is active', () => {
    window.history.pushState({}, '', '/group/DEVTST?shell=v2&tab=roster&rview=board');
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One', role: 'melee', position: 'M1', gear: bodyNeededGear() })]));
    expect(screen.getAllByText('●').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('● next upgrade')).toBeInTheDocument();
  });

  it('renders no next-upgrade glyph on the Board when priority is disabled in settings', () => {
    window.history.pushState({}, '', '/group/DEVTST?shell=v2&tab=roster&rview=board');
    const disabledGroup = { ...group, settings: { priorityMode: 'disabled' } } as unknown as StaticGroup;
    render(
      <BrowserRouter>
        <Roster {...baseProps} group={disabledGroup} tier={makeTier([makePlayer({ id: 'p1', name: 'Tank One', role: 'melee', position: 'M1', gear: bodyNeededGear() })])} />
      </BrowserRouter>,
    );
    expect(screen.queryByText('●')).not.toBeInTheDocument();
  });
});
