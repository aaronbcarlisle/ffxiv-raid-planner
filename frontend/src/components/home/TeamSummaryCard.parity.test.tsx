/**
 * D-42 parity proof: V1's frozen `TeamSummaryEnhanced` and v2's
 * `TeamSummaryCard` render against ONE seeded store and must show the same
 * numbers — every row, the footer, the four tiles, and the chips — with
 * "Mains only" off and on. V1 is imported read-only and never mocked.
 */
import { render, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { useTierStore } from '../../stores/tierStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useStaticCharacterStore } from '../../stores/staticCharacterStore';
import { getTierById } from '../../gamedata';
import { sortPlayersByRole } from '../../utils/calculations';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import { TeamSummaryEnhanced } from '../team/TeamSummaryEnhanced';
import { TeamSummaryCard } from './TeamSummaryCard';
import type {
  GearSlotStatus,
  MaterialBalance,
  PageBalance,
  SnapshotPlayer,
  StaticCharacterRegistration,
  TierSnapshot,
} from '../../types';

const GROUP_ID = 'g1';
const TIER_ID = 'aac-heavyweight';

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

// ─── One fixture for both components ────────────────────────────────────────
// Five configured non-subs with mixed gear, one sub, one unconfigured, partial
// balances, registrations covering main, alt and substitute.
const PLAYERS: SnapshotPlayer[] = [
  createPlayer({
    id: 'caster-1', name: 'Caster One', job: 'BLM', role: 'caster', sortOrder: 4,
    gear: [
      createGearSlot({ slot: 'weapon' }),
      createGearSlot({ slot: 'necklace' }),
      createGearSlot({ slot: 'legs', bisSource: 'tome' }),
      createGearSlot({ slot: 'earring', bisSource: 'tome' }),
    ],
    tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
  }),
  createPlayer({ id: 'bench-1', name: 'Bench One', job: 'BRD', role: 'ranged', configured: false }),
  createPlayer({
    id: 'tank-1', name: 'Tank One', job: 'WAR', role: 'tank', sortOrder: 0,
    gear: [
      createGearSlot({ slot: 'weapon', hasItem: true }),
      createGearSlot({ slot: 'body' }),
      createGearSlot({ slot: 'head' }),
    ],
  }),
  createPlayer({
    id: 'melee-1', name: 'Melee One', job: 'DRG', role: 'melee', sortOrder: 3,
    gear: [
      createGearSlot({ slot: 'weapon', hasItem: true }),
      createGearSlot({ slot: 'head', hasItem: true }),
      createGearSlot({ slot: 'bracelet', bisSource: 'tome' }),
    ],
  }),
  createPlayer({ id: 'sub-1', name: 'Sub One', job: 'GNB', role: 'tank', isSubstitute: true, gear: [createGearSlot({ slot: 'weapon' })] }),
  createPlayer({
    id: 'healer-1', name: 'Healer One', job: 'WHM', role: 'healer', sortOrder: 2,
    gear: [createGearSlot({ slot: 'body' }), createGearSlot({ slot: 'feet', bisSource: 'tome' })],
  }),
  createPlayer({
    id: 'tank-2', name: 'Tank Two', job: 'DRK', role: 'tank', sortOrder: 1,
    gear: [
      createGearSlot({ slot: 'weapon', hasItem: true }),
      createGearSlot({ slot: 'legs', bisSource: 'tome', hasItem: true, isAugmented: true }),
    ],
  }),
];

// bookIII != bookIV on purpose for two players: a swapped key in the row
// builder must change a number.
const PAGE_BALANCES: PageBalance[] = [
  { playerId: 'tank-1', playerName: 'Tank One', bookI: 0, bookII: 4, bookIII: 4, bookIV: 0 },
  { playerId: 'caster-1', playerName: 'Caster One', bookI: 3, bookII: 0, bookIII: 0, bookIV: 2 },
  { playerId: 'sub-1', playerName: 'Sub One', bookI: 9, bookII: 9, bookIII: 9, bookIV: 9 },
];
const MATERIAL_BALANCES: MaterialBalance[] = [
  { playerId: 'tank-2', playerName: 'Tank Two', twine: 1, glaze: 0, solvent: 0, universalTomestone: 0 },
  { playerId: 'caster-1', playerName: 'Caster One', twine: 0, glaze: 1, solvent: 0, universalTomestone: 0 },
];
const REGISTRATIONS: Record<string, StaticCharacterRegistration[]> = {
  'tank-1': [createRegistration({ id: 'r1', snapshotPlayerId: 'tank-1', roleInStatic: 'main' })],
  'tank-2': [createRegistration({ id: 'r2', snapshotPlayerId: 'tank-2', roleInStatic: 'main' })],
  'healer-1': [createRegistration({ id: 'r3', snapshotPlayerId: 'healer-1', roleInStatic: 'alt' })],
  'melee-1': [createRegistration({ id: 'r4', snapshotPlayerId: 'melee-1', roleInStatic: 'substitute' })],
};

// ─── Readers (DOM-level, so they work on both markups) ──────────────────────
interface RowReading {
  player: string;
  gear: string;
  values: string[];
  success: boolean[];
}

interface TableReading {
  rows: RowReading[];
  footer: string[];
}

function readTable(container: HTMLElement): TableReading {
  const table = within(container).getByRole('table');
  const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) => {
    const cells = Array.from(tr.querySelectorAll('td'));
    return {
      player: cells[0].textContent ?? '',
      gear: cells[1].textContent ?? '',
      values: cells.slice(2).map((cell) => cell.textContent ?? ''),
      success: cells.slice(2).map((cell) => cell.querySelector('.text-status-success') !== null),
    };
  });
  const footer = Array.from(table.querySelector('tfoot tr')!.children).map((cell) => cell.textContent ?? '');
  return { rows, footer };
}

/**
 * The value beside a tile label. V1 nests the label in an icon row whose next
 * sibling holds the value; v2's label is a <dt> followed by its <dd>.
 */
function readTile(container: HTMLElement, label: string): string {
  const labelEl = within(container).getByText(label);
  const valueEl = labelEl.tagName === 'DT' ? labelEl.nextElementSibling : labelEl.parentElement?.nextElementSibling;
  return valueEl?.textContent ?? '';
}

function readTiles(container: HTMLElement, labels: { gear: string; books: string; mats: string }) {
  return {
    players: readTile(container, 'Players'),
    gear: readTile(container, labels.gear),
    books: readTile(container, labels.books),
    mats: readTile(container, labels.mats),
  };
}

const V1_TILES = { gear: 'BiS Progress', books: 'Books Collected', mats: 'Materials Received' };
const V2_TILES = { gear: 'Avg BiS progress', books: 'Books collected', mats: 'Materials received' };

function renderBoth() {
  const tier = getTierById(TIER_ID)!;
  const v1Players = sortPlayersByRole(
    PLAYERS.filter((p) => p.configured && !p.isSubstitute),
    DEFAULT_SETTINGS.displayOrder,
    'standard',
  );
  const v1 = render(
    <TeamSummaryEnhanced groupId={GROUP_ID} tierId={TIER_ID} players={v1Players} tierInfo={tier} />,
  ).container;
  const v2 = render(<TeamSummaryCard groupId={GROUP_ID} tierId={TIER_ID} />).container;
  return { v1, v2, tier };
}

function toggleMainsOnly(container: HTMLElement) {
  fireEvent.click(within(container).getByRole('switch', { name: 'Mains only' }));
}

// ─── Setup ──────────────────────────────────────────────────────────────────
beforeEach(() => {
  // V1 reads matchMedia unguarded for its mobile collapse default.
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  localStorage.clear();

  useTierStore.setState({ currentTier: { tierId: TIER_ID, players: PLAYERS } as unknown as TierSnapshot });
  useLootTrackingStore.setState({
    pageBalances: PAGE_BALANCES,
    materialBalances: MATERIAL_BALANCES,
    // V1's mount effect fetches; resolved no-ops keep it off the network.
    fetchPageBalances: vi.fn().mockResolvedValue(undefined),
    fetchMaterialBalances: vi.fn().mockResolvedValue(undefined),
  });
  useStaticCharacterStore.setState({ registrationsByGroup: { [GROUP_ID]: REGISTRATIONS } });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// Hard-coded expectations: role order (tank, healer, melee, ranged, caster),
// then sortOrder; chips follow the primary registration.
const EXPECTED_PLAYERS = ['Tank OneMain', 'Tank TwoMain', 'Healer OneAlt', 'Melee OneSub', 'Caster One'];
const EXPECTED_MAINS = ['Tank One', 'Tank Two'];

// ─── Tile / footer colour thresholds (PR #271 fix) ─────────────────────────
// V1's three gear-% → colour mappings differ per surface (TeamSummaryEnhanced.tsx):
//   row    (:108-113): 100→success, >=75→warning, >=50→accent, else→primary
//   tile   (:444-450, "BiS Progress" stat card): 100→success, >=50→accent, else→primary
//   footer (:529-535, Team Total): 100→success, >=75→warning, else→primary (no accent tier)
// `100 raid slots, N complete` makes calculatePlayerCompletion return exactly N,
// so a single-player totals.gearPercent lands on the boundary value untouched.
function buildGearAtPercent(percent: number): GearSlotStatus[] {
  return Array.from({ length: 100 }, (_, i) => createGearSlot({ hasItem: i < percent }));
}

function renderCardAtPercent(percent: number) {
  const player = createPlayer({ id: 'solo', name: 'Solo', job: 'DRG', role: 'melee', gear: buildGearAtPercent(percent) });
  useTierStore.setState({ currentTier: { tierId: TIER_ID, players: [player] } as unknown as TierSnapshot });
  useLootTrackingStore.setState({ pageBalances: [], materialBalances: [] });
  useStaticCharacterStore.setState({ registrationsByGroup: { [GROUP_ID]: {} } });
  return render(<TeamSummaryCard groupId={GROUP_ID} tierId={TIER_ID} />).container;
}

function tileColorSpan(container: HTMLElement): HTMLElement {
  const dt = within(container).getByText('Avg BiS progress').closest('dt')!;
  return dt.nextElementSibling!.querySelector('span')!;
}

function footerColorSpan(container: HTMLElement): HTMLElement {
  const table = within(container).getByRole('table');
  const footerRow = table.querySelector('tfoot tr')!;
  return footerRow.children[1].querySelector('span')!;
}

const TILE_EXPECTED: Record<number, string> = {
  49: 'text-text-primary',
  50: 'text-accent',
  74: 'text-accent',
  75: 'text-accent',
  99: 'text-accent',
  100: 'text-status-success',
};

const FOOTER_EXPECTED: Record<number, string> = {
  49: 'text-text-primary',
  50: 'text-text-primary',
  74: 'text-text-primary',
  75: 'text-status-warning',
  99: 'text-status-warning',
  100: 'text-status-success',
};

describe('TeamSummaryCard tile and footer colour thresholds (V1 parity, PR #271)', () => {
  it.each([49, 50, 74, 75, 99, 100])('tile at %i%% uses the V1 aggregate-tile colour', (percent) => {
    const container = renderCardAtPercent(percent);
    expect(tileColorSpan(container).className).toContain(TILE_EXPECTED[percent]);
  });

  it.each([49, 50, 74, 75, 99, 100])('footer at %i%% uses the V1 Team Total colour', (percent) => {
    const container = renderCardAtPercent(percent);
    expect(footerColorSpan(container).className).toContain(FOOTER_EXPECTED[percent]);
  });
});

describe('TeamSummaryCard parity with V1 TeamSummaryEnhanced (D-42)', () => {
  it('renders the same heading, toggle and legend', () => {
    const { v1, v2, tier } = renderBoth();

    for (const container of [v1, v2]) {
      expect(within(container).getByRole('heading', { name: 'Team Summary' })).toBeInTheDocument();
      expect(within(container).getByRole('switch', { name: 'Mains only' })).toHaveAttribute('aria-checked', 'false');
      expect(within(container).getByText(`T = ${tier.upgradeMaterials.twine}`)).toBeInTheDocument();
      expect(within(container).getByText(`G = ${tier.upgradeMaterials.glaze}`)).toBeInTheDocument();
      expect(within(container).getByText(`S = ${tier.upgradeMaterials.solvent}`)).toBeInTheDocument();
      expect(within(container).getByText('Green = Complete')).toBeInTheDocument();
    }
    // Same books entry; v2 sets the ranges with en dashes.
    expect(within(v1).getByText('I-IV = Books (Floor 1-4)')).toBeInTheDocument();
    expect(within(v2).getByText('I–IV = Books (Floor 1–4)')).toBeInTheDocument();
  });

  it('shows identical rows, footer, tiles and chips with "Mains only" off', () => {
    const { v1, v2 } = renderBoth();
    const t1 = readTable(v1);
    const t2 = readTable(v2);

    expect(t2.rows).toHaveLength(5);
    expect(t2.rows.map((r) => r.player)).toEqual(EXPECTED_PLAYERS);
    expect(t2.rows).toEqual(t1.rows);
    expect(t2.footer).toEqual(t1.footer);
    expect(t2.footer[0]).toBe('Team Total');

    const tiles1 = readTiles(v1, V1_TILES);
    const tiles2 = readTiles(v2, V2_TILES);
    expect(tiles2).toEqual(tiles1);
    expect(tiles2.players).toBe('5/8');

    // Literal anchors, so a vacuous "both empty" pass is impossible.
    const cells = t2.rows.flatMap((r) => r.values.map((text, i) => ({ text, success: r.success[i], column: i })));
    const fraction = (text: string) => text.split('/').map(Number);
    expect(cells.some((c) => c.text === '-')).toBe(true);
    expect(cells.some((c) => c.success)).toBe(true);
    expect(cells.some((c) => !c.success && /^\d+\/\d+$/.test(c.text) && fraction(c.text)[0] < fraction(c.text)[1])).toBe(true);
    expect(cells.some((c) => c.column < 4 && /^\d+\/\d+$/.test(c.text) && fraction(c.text)[0] > 0)).toBe(true);
    expect(cells.some((c) => c.column >= 4 && /^\d+\/\d+$/.test(c.text) && fraction(c.text)[0] > 0)).toBe(true);
    expect(t2.rows.every((r) => /^\d+%$/.test(r.gear))).toBe(true);
    expect(new Set(t2.rows.map((r) => r.gear)).size).toBeGreaterThan(1);
  });

  it('stays identical with "Mains only" on: rows, footer and tiles', () => {
    const { v1, v2 } = renderBoth();
    toggleMainsOnly(v1);
    toggleMainsOnly(v2);

    const t1 = readTable(v1);
    const t2 = readTable(v2);
    expect(t2.rows.map((r) => r.player)).toEqual(EXPECTED_MAINS);
    expect(t2.rows).toEqual(t1.rows);
    expect(t2.footer).toEqual(t1.footer);

    const tiles1 = readTiles(v1, V1_TILES);
    const tiles2 = readTiles(v2, V2_TILES);
    expect(tiles2).toEqual(tiles1);
    expect(tiles2.players).toBe('2/8');
    expect(within(v1).queryByText('Main')).not.toBeInTheDocument();
    expect(within(v2).queryByText('Main')).not.toBeInTheDocument();
  });
});
