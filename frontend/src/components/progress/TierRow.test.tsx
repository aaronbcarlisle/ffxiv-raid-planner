/**
 * The tier row in the matrix (S2a-3b·H3 Task TH3; design §3.2, D-2, D-4, D-7, E-5, E-6;
 * R-T-3, R-T-12). Props-driven: `ProgressMatrix` gets the `tier` prop the page builds, and
 * `TierBisCellButton` is rendered alone for its name and its bar.
 *
 * Contract hooks these tests read (the spec names the shapes, the tests name the hooks):
 *   - the bar: `data-testid="tier-bis-bar"`, `aria-hidden="true"`, three children marked
 *     `data-segment="done" | "augment" | "togo"` in that order, each sized by `style.flexGrow`
 *     or a `style.width` percentage (either is read, as a share of the three);
 *   - dimmed: an `opacity-*` class on the unclaimed cell or inside it.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The open panel loads its drops; none here.
vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  api: { get: vi.fn().mockResolvedValue([]), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import type { GearSlotStatus, SnapshotPlayer } from '../../types';
import { tierBisCell, type TierBisCell } from '../../utils/tierBis';
import { buildColumns, splitFarmRows, type ProgressColumn, type ProgressData } from '../../utils/progressModel';
import { gearOf, goal, row, SLOTS } from './__fixtures__/progressFixtures';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';
import { ProgressMatrix } from './ProgressMatrix';
import { TierBisCellButton } from './TierBisCellButton';

beforeEach(() => stubCanHover());
afterEach(() => vi.unstubAllGlobals());

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Eleven slots, some had, none with a BiS source. */
const noTargets = (): GearSlotStatus[] =>
  SLOTS.map((slot, i) => ({ slot, bisSource: null, hasItem: i % 2 === 0, isAugmented: false }) as GearSlotStatus);

function player(id: string, overrides: Partial<SnapshotPlayer>): SnapshotPlayer {
  return {
    id, name: id, job: 'WAR', role: 'tank', position: null, configured: true, isSubstitute: false, sortOrder: 0, userId: null,
    gear: gearOf(0, 0), ...overrides,
  } as unknown as SnapshotPlayer;
}

const HEALER = player('p2', { name: 'Healer 1', job: 'WHM', role: 'healer', position: 'H1', userId: 'u2', gear: gearOf(6, 2) });
const PLAYERS = [
  player('p1', { name: 'Aya', job: 'WAR', role: 'tank', position: 'T1', userId: 'u1', gear: gearOf(5, 0) }),
  HEALER,
  player('p3', { name: 'Cy', job: 'BLM', role: 'caster', position: 'R1', userId: null, gear: gearOf(3, 0) }),
  player('p4', { name: 'Dee', job: 'NIN', role: 'melee', position: 'M1', userId: 'u4', gear: noTargets() }),
];

const TIER_NAME = 'AAC Heavyweight';
const STATUS = '14/22 BiS slots · Week 11 · 1 of 4 floors cleared';

const claimedColumn = (p: SnapshotPlayer): ProgressColumn =>
  p.userId
    ? { kind: 'claimed', key: p.id, name: p.name, userId: p.userId, player: p }
    : { kind: 'unclaimed', key: p.id, name: p.name, userId: null, player: p };

interface Opts {
  players?: SnapshotPlayer[];
  /** A member with a farm row and no column: the trailing "Not on the roster" column. */
  offRoster?: boolean;
  lead?: boolean;
  openId?: string | null;
  onOpenBoard?: () => void;
}

function renderMatrix(o: Opts = {}) {
  const goals = [goal('wings', { title: 'Wings of Resolve' })];
  const participants = {
    wings: [row('wings', 'u1'), ...(o.offRoster ? [row('wings', 'u9', { displayName: 'Nia', memberRole: 'member' })] : [])],
  };
  const data: ProgressData = { goals, participants, recordOnly: {} };
  const columns = buildColumns(o.players ?? PLAYERS, 'standard', data);
  const reader = { currentUserId: 'u1', userRole: o.lead === false ? 'member' : 'lead' } as const;
  const { active, finished } = splitFarmRows(data, columns, reader);
  const onOpenBoard = o.onOpenBoard ?? vi.fn();
  const cells = columns.map((c) =>
    c.player ? { cell: tierBisCell(c.player), counted: !c.player.isSubstitute } : { cell: null, counted: false },
  );
  render(
    <ProgressMatrix
      columns={columns}
      active={active}
      finished={finished}
      canManage={o.lead !== false}
      currentUserId="u1"
      finishedLoading={false}
      onExpandFinished={vi.fn()}
      openId={o.openId ?? null}
      onToggle={vi.fn()}
      groupId="g1"
      userRole={reader.userRole}
      tier={{ name: TIER_NAME, cells, statusText: STATUS, onOpenBoard }}
    />,
    { wrapper: TooltipWrapper },
  );
  return { columns, onOpenBoard };
}

const tierRow = () => screen.getByTestId('progress-tier-row');
/** Every cell of the tier row, in order: name, (menu), status, then one per column. */
const tierCells = () => Array.from(tierRow().querySelectorAll(':scope > td, :scope > th')) as HTMLElement[];
const columnCell = (columns: ProgressColumn[], key: string) => {
  const cells = tierCells();
  return cells[cells.length - columns.length + columns.findIndex((c) => c.key === key)];
};

/** A segment's size, from `flex-grow` or a `width` percentage. */
function size(el: Element): number {
  const style = (el as HTMLElement).style;
  if (style.flexGrow) return Number(style.flexGrow);
  if (style.width.endsWith('%')) return Number.parseFloat(style.width);
  throw new Error(`segment ${el.getAttribute('data-segment')} has no flex-grow or % width`);
}

// ── The row in the table ────────────────────────────────────────────────────

describe('TierRow in the matrix (R-T-3)', () => {
  it('is the first row of the matrix body, with the tier name in its rowheader and no "Week" there', () => {
    renderMatrix();
    const matrix = screen.getByTestId('progress-matrix');
    const firstBodyRow = matrix.querySelector('tbody')!.querySelector('tr');
    expect(firstBodyRow).toBe(tierRow());
    expect(tierRow()).toHaveAttribute('role', 'row');
    expect(tierRow().tagName).toBe('TR');
    const header = within(tierRow()).getByRole('rowheader');
    expect(header).toHaveTextContent(TIER_NAME);
    expect(header).not.toHaveTextContent(/Week/);
    // Before every farm row.
    const farm = screen.getAllByTestId('progress-farm-row')[0];
    expect(tierRow().compareDocumentPosition(farm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('heads the first column "Track", names the region "Tracks by player" and captions it "Track progress by player"', () => {
    renderMatrix();
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent(/^Track$/);
    expect(screen.queryByRole('columnheader', { name: 'Farm' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Tracks by player' })).toBe(screen.getByTestId('progress-matrix'));
    expect(screen.getByTestId('progress-matrix').querySelector('caption')).toHaveTextContent('Track progress by player');
  });

  it('has one cell per header cell, so the row lines up under every column', () => {
    renderMatrix();
    expect(tierCells()).toHaveLength(screen.getAllByRole('columnheader').length);
  });

  it('still spans the open farm panel across every column', () => {
    const { columns } = renderMatrix({ openId: 'wings' });
    const spanAll = screen.getAllByRole('columnheader').length;
    expect(spanAll).toBe(columns.length + 3);
    expect(tierCells()).toHaveLength(spanAll);
    const panel = screen.getByTestId('progress-expansion');
    expect((within(panel).getByRole('gridcell') as HTMLTableCellElement).colSpan).toBe(spanAll);
  });
});

describe('TierRow cells (D-2, D-4, D-7)', () => {
  it('names a claimed cell with its numbers and shows "6/11"', () => {
    renderMatrix();
    const cell = screen.getByRole('button', { name: 'Healer 1, AAC Heavyweight, 6 of 11 BiS slots done, 2 need augment' });
    expect(cell).toHaveTextContent('6/11');
    expect(tierRow()).toContainElement(cell);
  });

  it('leaves the "need augment" part out of the name when there is none', () => {
    renderMatrix();
    expect(screen.getByRole('button', { name: 'Aya, AAC Heavyweight, 5 of 11 BiS slots done' })).toHaveTextContent('5/11');
  });

  it('reads "No BiS set" for a player with no targets, named "…, no BiS set"', () => {
    renderMatrix();
    const cell = screen.getByRole('button', { name: 'Dee, AAC Heavyweight, no BiS set' });
    expect(cell).toHaveTextContent('No BiS set');
    expect(cell).not.toHaveTextContent(/\d+\/\d+/);
  });

  it('shows an unclaimed card its own cell, dimmed; a claimed one is not dimmed', () => {
    const { columns } = renderMatrix();
    const unclaimed = columnCell(columns, 'p3');
    expect(within(unclaimed).getByRole('button', { name: 'Cy, AAC Heavyweight, 3 of 11 BiS slots done' })).toHaveTextContent('3/11');
    expect(unclaimed.outerHTML).toMatch(/(?<![\w:-])opacity-\d+/);
    expect(columnCell(columns, 'p2').outerHTML).not.toMatch(/(?<![\w:-])opacity-\d+/);
  });

  it('shows a substitute its own cell (it is the page that leaves it out of the total)', () => {
    const sub = player('p5', { name: 'Sub', job: 'DRG', role: 'melee', userId: 'u5', isSubstitute: true, gear: gearOf(8, 0) });
    renderMatrix({ players: [...PLAYERS, sub] });
    expect(screen.getByRole('button', { name: 'Sub, AAC Heavyweight, 8 of 11 BiS slots done' })).toHaveTextContent('8/11');
  });

  it('leaves a Not-on-the-roster column\'s cell empty, with no button', () => {
    const { columns } = renderMatrix({ offRoster: true });
    const off = columns.find((c) => c.kind === 'notOnRoster')!;
    expect(off.name).toBe('Nia');
    const cell = columnCell(columns, off.key);
    expect(cell).toBeDefined();
    expect(within(cell).queryByRole('button')).not.toBeInTheDocument();
    expect(cell.textContent?.trim()).toBe('');
    expect(screen.queryByRole('button', { name: /^Nia, / })).not.toBeInTheDocument();
  });

  it('leaves a Card-not-set-up column\'s cell empty, with no button', () => {
    const unconfigured = player('p6', { name: 'Ula', userId: 'u9', configured: false });
    // An unconfigured card is no column of its own; its member (u9, with a farm row) trails as "Card not set up".
    const { columns } = renderMatrix({ players: [...PLAYERS, unconfigured], offRoster: true });
    const off = columns.find((c) => c.kind === 'notOnRoster')!;
    expect(off).toMatchObject({ reason: 'unconfigured' });
    expect(screen.queryByRole('button', { name: /^(Ula|Nia), / })).not.toBeInTheDocument();
    const cell = columnCell(columns, off.key);
    expect(within(cell).queryByRole('button')).not.toBeInTheDocument();
    expect(cell.textContent?.trim()).toBe('');
  });
});

describe('TierRow status cell (E-6, R-T-12)', () => {
  it('reads the status text and holds Open board, a button described by it, which opens the board', () => {
    const { onOpenBoard } = renderMatrix();
    const openBoard = within(tierRow()).getByRole('button', { name: 'Open board' });
    expect(openBoard.tagName).toBe('BUTTON');
    const describedBy = openBoard.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const text = document.getElementById(describedBy!);
    expect(text).not.toBeNull();
    expect(text!.textContent).toBe(STATUS);
    expect(tierRow()).toContainElement(text);
    expect(openBoard).toHaveAccessibleDescription(STATUS);
    fireEvent.click(openBoard);
    expect(onOpenBoard).toHaveBeenCalledTimes(1);
  });

  it('keeps the status text and Open board in the same cell, the status column', () => {
    renderMatrix({ lead: false });
    // Members: name, status, then the columns.
    const status = tierCells()[1];
    expect(within(status).getByRole('button', { name: 'Open board' })).toBeInTheDocument();
    expect(status).toHaveTextContent(STATUS);
  });
});

// ── The cell alone ──────────────────────────────────────────────────────────

describe('TierBisCellButton', () => {
  const column = claimedColumn(HEALER);

  function renderCell(cell: TierBisCell | null, col: ProgressColumn = column) {
    return render(<TierBisCellButton column={col} cell={cell} tierName={TIER_NAME} />, { wrapper: TooltipWrapper });
  }

  it('is a button named "{player}, {tier}, {done} of {total} BiS slots done, {n} need augment" reading "6/11"', () => {
    renderCell(tierBisCell(HEALER));
    const button = screen.getByRole('button');
    expect(button).toHaveAccessibleName('Healer 1, AAC Heavyweight, 6 of 11 BiS slots done, 2 need augment');
    expect(button).toHaveTextContent('6/11');
  });

  it('draws a decorative three-part bar sized done : needs augment : to go = 6 : 2 : 3', () => {
    renderCell(tierBisCell(HEALER));
    const bar = screen.getByTestId('tier-bis-bar');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    const segments = Array.from(bar.querySelectorAll('[data-segment]'));
    expect(segments.map((s) => s.getAttribute('data-segment'))).toEqual(['done', 'augment', 'togo']);
    const [done, augment, toGo] = segments.map(size);
    expect(done / toGo).toBeCloseTo(6 / 3, 5);
    expect(augment / toGo).toBeCloseTo(2 / 3, 5);
  });

  it('colours the bar with the role colour\'s classes, never a hex or rgb()', () => {
    renderCell(tierBisCell(HEALER));
    const bar = screen.getByTestId('tier-bis-bar');
    const [done, augment] = Array.from(bar.querySelectorAll('[data-segment]'));
    expect(done.className).toMatch(/\bbg-role-healer\b/);
    expect(augment.className).toMatch(/role-healer/);
    // Needs augment is striped as well as tinted, so it never reads by colour alone; done is solid.
    expect(augment.className).toMatch(/repeating-linear-gradient/);
    expect(done.className).not.toMatch(/repeating-linear-gradient/);
    expect(bar.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(bar.outerHTML).not.toMatch(/role-(tank|melee|ranged|caster)/);
  });

  it('uses the column\'s role, not a fixed one', () => {
    const tank = player('p1', { name: 'Aya', job: 'WAR', role: 'tank', userId: 'u1', gear: gearOf(5, 1) });
    renderCell(tierBisCell(tank), claimedColumn(tank));
    const [done] = Array.from(screen.getByTestId('tier-bis-bar').querySelectorAll('[data-segment]'));
    expect(done.className).toMatch(/\bbg-role-tank\b/);
  });

  it('reads "No BiS set" for an empty gear list (total 11, no targets)', () => {
    const empty = player('p7', { name: 'Ëlise "Q" O\'Brien $1 \\u0041', gear: [], userId: 'u7' });
    renderCell(tierBisCell(empty), claimedColumn(empty));
    const button = screen.getByRole('button');
    expect(button).toHaveAccessibleName('Ëlise "Q" O\'Brien $1 \\u0041, AAC Heavyweight, no BiS set');
    expect(button).toHaveTextContent('No BiS set');
  });

  it('renders no button for a column with no cell', () => {
    const off: ProgressColumn = { kind: 'notOnRoster', key: 'user:u9', name: 'Nia', userId: 'u9', player: null, reason: 'notOnRoster' };
    renderCell(null, off);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/BiS/)).not.toBeInTheDocument();
  });
});
