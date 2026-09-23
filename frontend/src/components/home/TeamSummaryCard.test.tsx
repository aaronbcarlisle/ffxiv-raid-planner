import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTierStore } from '../../stores/tierStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useStaticCharacterStore } from '../../stores/staticCharacterStore';
import { getTierById } from '../../gamedata';
import { TeamSummaryCard } from './TeamSummaryCard';
import type {
  GearSlotStatus,
  MaterialBalance,
  PageBalance,
  SnapshotPlayer,
  StaticCharacterRegistration,
  TierSnapshot,
} from '../../types';

// Real stores, seeded per test — no store mocks, so the selectors run for real.

const GROUP_ID = 'g1';
const TIER_ID = 'aac-heavyweight';
const OTHER_TIER_ID = 'anabaseios';

function createGearSlot(overrides: Partial<GearSlotStatus> = {}): GearSlotStatus {
  return { slot: 'body', bisSource: 'raid', hasItem: false, isAugmented: false, ...overrides };
}

function createPlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'player-1',
    tierSnapshotId: 'tier-1',
    name: 'Player',
    job: 'DRG',
    role: 'melee',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createRegistration(overrides: Partial<StaticCharacterRegistration> = {}): StaticCharacterRegistration {
  return {
    id: 'reg-1',
    staticGroupId: GROUP_ID,
    snapshotPlayerId: 'player-1',
    playerCharacterId: null,
    manualCharacterName: null,
    manualWorld: null,
    manualDataCenter: null,
    roleInStatic: 'main',
    job: null,
    isPrimaryForStatic: true,
    source: 'manual',
    lastSyncedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    resolvedName: null,
    resolvedWorld: null,
    resolvedDataCenter: null,
    linkedCharacter: null,
    ...overrides,
  };
}

// Book costs: weapon 8 (IV), body 6 (III), head 4 (II). legs (tome) = 1 twine,
// earring (tome) = 1 glaze. Gear % = complete raid slots / slots.
const TANK_ONE = createPlayer({
  id: 'tank-1', name: 'Tank One', job: 'WAR', role: 'tank',
  gear: [
    createGearSlot({ slot: 'weapon', hasItem: true }),
    createGearSlot({ slot: 'body', hasItem: false }),
  ], // 50 %; needs III 6
});
const HEALER_ONE = createPlayer({
  id: 'healer-1', name: 'Healer One', job: 'WHM', role: 'healer',
  gear: [
    createGearSlot({ slot: 'body', hasItem: false }),
    createGearSlot({ slot: 'legs', bisSource: 'tome' }),
    createGearSlot({ slot: 'earring', bisSource: 'tome' }),
  ], // 0 %; needs III 6, T 1, G 1
});
const MELEE_ONE = createPlayer({
  id: 'melee-1', name: 'Melee One', job: 'DRG', role: 'melee',
  gear: [createGearSlot({ slot: 'weapon', hasItem: true })], // 100 %; needs nothing
});
const CASTER_ONE = createPlayer({
  id: 'caster-1', name: 'Caster One', job: 'BLM', role: 'caster',
  gear: [createGearSlot({ slot: 'head', hasItem: false })], // 0 %; needs II 4
});
const SUB = createPlayer({ id: 'sub-1', name: 'Sub One', role: 'tank', isSubstitute: true });
const UNCONFIGURED = createPlayer({ id: 'bench-1', name: 'Bench One', role: 'ranged', configured: false });

// Shuffled on purpose: the card must order by role, not by input.
const ROSTER = [CASTER_ONE, SUB, MELEE_ONE, UNCONFIGURED, HEALER_ONE, TANK_ONE];

const PAGE_BALANCES: PageBalance[] = [
  { playerId: 'tank-1', playerName: 'Tank One', bookI: 0, bookII: 0, bookIII: 6, bookIV: 0 },
  { playerId: 'healer-1', playerName: 'Healer One', bookI: 0, bookII: 0, bookIII: 2, bookIV: 0 },
  { playerId: 'caster-1', playerName: 'Caster One', bookI: 0, bookII: 1, bookIII: 0, bookIV: 0 },
];
const MATERIAL_BALANCES: MaterialBalance[] = [
  { playerId: 'healer-1', playerName: 'Healer One', twine: 1, glaze: 0, solvent: 0, universalTomestone: 0 },
];
const REGISTRATIONS: Record<string, StaticCharacterRegistration[]> = {
  'tank-1': [createRegistration({ id: 'r1', snapshotPlayerId: 'tank-1', roleInStatic: 'main' })],
  'healer-1': [createRegistration({ id: 'r2', snapshotPlayerId: 'healer-1', roleInStatic: 'alt' })],
  'melee-1': [createRegistration({ id: 'r3', snapshotPlayerId: 'melee-1', roleInStatic: 'substitute' })],
};

interface Seed {
  players?: SnapshotPlayer[];
  pageBalances?: PageBalance[];
  materialBalances?: MaterialBalance[];
  registrations?: Record<string, StaticCharacterRegistration[]>;
  tierId?: string;
}

function seed({ players = ROSTER, pageBalances = PAGE_BALANCES, materialBalances = MATERIAL_BALANCES, registrations, tierId = TIER_ID }: Seed = {}) {
  useTierStore.setState({ currentTier: { tierId, players } as unknown as TierSnapshot });
  useLootTrackingStore.setState({ pageBalances, materialBalances });
  useStaticCharacterStore.setState({ registrationsByGroup: registrations ? { [GROUP_ID]: registrations } : {} });
}

/** `tierId` is passed through as given — `undefined` stays `undefined`. */
function renderCard(tierId: string | undefined) {
  return render(<TeamSummaryCard groupId={GROUP_ID} tierId={tierId} />);
}

/** The body row for a player, by name. */
function rowFor(name: string): HTMLTableRowElement {
  return screen.getByText(name).closest('tr') as HTMLTableRowElement;
}

/** Value cells (I, II, III, IV, T, G, S) of a body row — after Player and Gear. */
function valueCells(row: HTMLTableRowElement): HTMLTableCellElement[] {
  return Array.from(row.querySelectorAll('td')).slice(2);
}

function footerCells(): string[] {
  const footer = screen.getByText('Team Total').closest('tr') as HTMLTableRowElement;
  return Array.from(footer.children).map((cell) => cell.textContent ?? '');
}

function tileValue(label: string): string {
  return screen.getByText(label).nextElementSibling?.textContent ?? '';
}

beforeEach(() => {
  useTierStore.setState({ currentTier: null });
  useLootTrackingStore.setState({
    pageBalances: [],
    materialBalances: [],
    fetchPageBalances: vi.fn().mockResolvedValue(undefined),
    fetchMaterialBalances: vi.fn().mockResolvedValue(undefined),
  });
  useStaticCharacterStore.setState({ registrationsByGroup: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TeamSummaryCard', () => {
  it('renders nothing without a tier, or with an unknown tier id', () => {
    seed();
    const { container: noTier } = renderCard(undefined);
    expect(noTier).toBeEmptyDOMElement();
    const { container: unknownTier } = renderCard('not-a-tier');
    expect(unknownTier).toBeEmptyDOMElement();
  });

  it('shows the "Mains only" toggle only when the static has registrations', () => {
    seed();
    const { unmount } = renderCard(TIER_ID);
    expect(screen.queryByRole('switch', { name: 'Mains only' })).not.toBeInTheDocument();
    unmount();

    seed({ registrations: REGISTRATIONS });
    renderCard(TIER_ID);
    const toggle = screen.getByRole('switch', { name: 'Mains only' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('orders rows by role and drops non-main rows under "Mains only"', () => {
    seed({ registrations: REGISTRATIONS });
    renderCard(TIER_ID);

    const names = () =>
      Array.from(screen.getByRole('table').querySelectorAll('tbody tr')).map(
        (tr) => tr.querySelector('td span')?.textContent,
      );
    expect(names()).toEqual(['Tank One', 'Healer One', 'Melee One', 'Caster One']);

    fireEvent.click(screen.getByRole('switch', { name: 'Mains only' }));
    expect(names()).toEqual(['Tank One']);
    expect(screen.queryByText('Healer One')).not.toBeInTheDocument();
  });

  it('labels rows by registration role with accent / info / muted chips, hidden under "Mains only"', () => {
    seed({ registrations: REGISTRATIONS });
    renderCard(TIER_ID);

    expect(within(rowFor('Tank One')).getByText('Main')).toHaveClass('text-accent-hover');
    expect(within(rowFor('Healer One')).getByText('Alt')).toHaveClass('text-status-info');
    expect(within(rowFor('Melee One')).getByText('Sub')).toHaveClass('text-text-secondary');
    expect(within(rowFor('Caster One')).queryByText(/^(Main|Alt|Sub)$/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Mains only' }));
    expect(screen.queryByText('Main')).not.toBeInTheDocument();
  });

  it('shows "-" when nothing is needed, and green once the balance meets the need', () => {
    seed();
    renderCard(TIER_ID);

    const tank = valueCells(rowFor('Tank One'));
    expect(tank.map((c) => c.textContent)).toEqual(['-', '-', '6/6', '-', '-', '-', '-']);
    expect(tank[0].querySelector('.text-text-muted')).toHaveTextContent('-');
    expect(tank[2].querySelector('.text-status-success')).toHaveTextContent('6');

    const healer = valueCells(rowFor('Healer One'));
    expect(healer.map((c) => c.textContent)).toEqual(['-', '-', '2/6', '-', '1/1', '0/1', '-']);
    expect(healer[2].querySelector('.text-status-success')).toBeNull();
    expect(healer[2].querySelector('.text-floor-3')).toHaveTextContent('2');
    expect(healer[4].querySelector('.text-status-success')).toHaveTextContent('1');
    expect(healer[5].querySelector('.text-material-glaze')).toHaveTextContent('0');
  });

  it('sums the tiles and the Team Total footer over the visible rows', () => {
    seed({ registrations: REGISTRATIONS });
    renderCard(TIER_ID);

    // 4 rows: gear 50/0/100/0 -> mean 37.5 -> 38; books 9/16; mats 1/2.
    expect(tileValue('Players')).toBe('4/8');
    expect(tileValue('Avg BiS progress')).toBe('38%');
    expect(tileValue('Books collected')).toBe('9/16');
    expect(tileValue('Materials received')).toBe('1/2');
    expect(footerCells()).toEqual(['Team Total', '38%', '0/0', '1/4', '8/12', '0/0', '1/1', '0/1', '0/0']);

    fireEvent.click(screen.getByRole('switch', { name: 'Mains only' }));
    expect(tileValue('Players')).toBe('1/8');
    expect(tileValue('Avg BiS progress')).toBe('50%');
    expect(tileValue('Books collected')).toBe('6/6');
    expect(tileValue('Materials received')).toBe('0/0');
    expect(footerCells()).toEqual(['Team Total', '50%', '0/0', '0/0', '6/6', '0/0', '0/0', '0/0', '0/0']);
  });

  it('names floor and material headers from the tier, and the legend uses its material names', () => {
    const tier = getTierById(TIER_ID)!;
    seed();
    const { unmount } = renderCard(TIER_ID);

    for (const [index, floor] of tier.floors.entries()) {
      const header = screen.getByRole('columnheader', { name: floor });
      expect(header).toHaveAttribute('title', floor);
      expect(header).toHaveTextContent(['I', 'II', 'III', 'IV'][index]);
    }
    expect(screen.getByRole('columnheader', { name: tier.upgradeMaterials.twine })).toHaveTextContent('T');
    expect(screen.getByRole('columnheader', { name: tier.upgradeMaterials.glaze })).toHaveTextContent('G');
    expect(screen.getByRole('columnheader', { name: tier.upgradeMaterials.solvent })).toHaveTextContent('S');
    expect(screen.getByText(`T = ${tier.upgradeMaterials.twine}`)).toBeInTheDocument();
    expect(screen.getByText(`G = ${tier.upgradeMaterials.glaze}`)).toBeInTheDocument();
    expect(screen.getByText(`S = ${tier.upgradeMaterials.solvent}`)).toBeInTheDocument();
    expect(screen.getByText('I–IV = Books (Floor 1–4)')).toBeInTheDocument();
    expect(screen.getByText('Green = Complete')).toBeInTheDocument();
    unmount();

    // A different tier id changes the names — they follow the prop, not a constant.
    const other = getTierById(OTHER_TIER_ID)!;
    expect(other.floors[0]).not.toBe(tier.floors[0]);
    seed({ tierId: OTHER_TIER_ID });
    renderCard(OTHER_TIER_ID);
    expect(screen.getByRole('columnheader', { name: other.floors[0] })).toBeInTheDocument();
    expect(screen.getByText(`T = ${other.upgradeMaterials.twine}`)).toBeInTheDocument();
  });

  it('shows the empty state on the unfiltered rows, but an empty table when "Mains only" hides every row', () => {
    seed({ players: [SUB, UNCONFIGURED], registrations: REGISTRATIONS });
    const { unmount } = renderCard(TIER_ID);
    expect(screen.getByText('No configured players')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    unmount();

    // Only an alt is registered: "Mains only" leaves zero rows, not the empty state.
    seed({ registrations: { 'healer-1': REGISTRATIONS['healer-1'] } });
    renderCard(TIER_ID);
    fireEvent.click(screen.getByRole('switch', { name: 'Mains only' }));
    expect(screen.queryByText('No configured players')).not.toBeInTheDocument();
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(0);
    expect(tileValue('Players')).toBe('0/8');
    expect(footerCells()).toEqual(['Team Total', '0%', '0/0', '0/0', '0/0', '0/0', '0/0', '0/0', '0/0']);
  });

  it('exposes each gear bar as a progressbar with aria-valuenow', () => {
    seed();
    renderCard(TIER_ID);
    expect(screen.getByRole('progressbar', { name: 'Tank One BiS progress' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByRole('progressbar', { name: 'Melee One BiS progress' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('progressbar', { name: 'Average BiS progress' })).toHaveAttribute('aria-valuenow', '38');
    expect(within(rowFor('Tank One')).getByText('50%')).toHaveClass('text-accent');
    expect(within(rowFor('Melee One')).getByText('100%')).toHaveClass('text-status-success');
  });

  it('mounts on the real static-character store with no registrations for the group, without looping, and fetches nothing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    seed(); // registrationsByGroup: {} — the selector returns undefined for g1
    expect(useStaticCharacterStore.getState().registrationsByGroup[GROUP_ID]).toBeUndefined();

    renderCard(TIER_ID);

    expect(screen.getByRole('heading', { name: 'Team Summary' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(useLootTrackingStore.getState().fetchPageBalances).not.toHaveBeenCalled();
    expect(useLootTrackingStore.getState().fetchMaterialBalances).not.toHaveBeenCalled();
  });
});
