/**
 * ProgressMatrix (S2a-2·F3 Task TF5): the matrix over the TF4 model, with FarmRow,
 * ProgressCell and FinishedFarms. Props-driven: the model builds the columns and rows
 * from fixtures, so these tests read exactly what the page would render.
 */
import { useState } from 'react';
import { act, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The open panel loads its drops (S2a-3a·G3); none here.
vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  api: { get: vi.fn().mockResolvedValue([]), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { useCollectionGoalStore, type CollectionGoal } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';
import type { SnapshotPlayer } from '../../types';
import {
  buildColumns,
  splitFarmRows,
  type ProgressCell as ProgressCellModel,
  type ProgressData,
  type ProgressReader,
} from '../../utils/progressModel';
import { goal, row } from './__fixtures__/progressFixtures';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';
import type { CellWriteTarget } from './CellPicker';
import { ProgressMatrix } from './ProgressMatrix';

beforeEach(() => stubCanHover());
afterEach(() => vi.unstubAllGlobals());

// ── Fixtures ────────────────────────────────────────────────────────────────

function player(id: string, overrides: Partial<SnapshotPlayer>): SnapshotPlayer {
  return { id, name: id, job: 'PLD', role: 'tank', position: null, configured: true, isSubstitute: false, sortOrder: 0, userId: null, ...overrides } as unknown as SnapshotPlayer;
}

const PLAYERS = [
  player('p1', { name: 'Aya', job: 'PLD', role: 'tank', position: 'T1', userId: 'u1' }),
  player('p2', { name: 'Bo', job: 'WHM', role: 'healer', position: 'H1', userId: 'u2' }),
  player('p3', { name: 'Cy', job: 'BLM', role: 'caster', position: 'R1', userId: null }),
  player('p4', { name: 'Dee', job: 'NIN', role: 'melee', position: 'M1', userId: 'u4' }),
];

const LEAD: ProgressReader = { currentUserId: 'u1', userRole: 'lead' };
const MEMBER: ProgressReader = { currentUserId: 'u1', userRole: 'member' };

interface RenderOptions {
  goals?: CollectionGoal[];
  participants?: ProgressData['participants'];
  reader?: ProgressReader;
  memberNames?: ReadonlyMap<string, string>;
  players?: SnapshotPlayer[];
  canManage?: boolean;
  finishedLoading?: boolean;
  finishedError?: string | null;
  onExpandFinished?: () => void;
  /** How the reader's own cells write (F5), resolved for own cells only; absent = read-only, as a viewer sees it. */
  edit?: CellWriteTarget;
  /** The row open on the first render (S2a-3a, the page's `?track`). */
  openId?: string | null;
}

/** F5's own-cell rule as a resolver (the page's `cellWriteTarget` is tested in its own file). */
const ownCellsOnly = (target: CellWriteTarget) => (cell: ProgressCellModel) => (cell.own ? target : undefined);

function build(o: RenderOptions) {
  const goals = o.goals ?? [goal('wings', { title: 'Wings of Resolve' })];
  const data: ProgressData = { goals, participants: o.participants ?? {}, recordOnly: {} };
  const activeData = { ...data, goals: goals.filter((g) => g.status !== 'complete') };
  const columns = buildColumns(o.players ?? PLAYERS, 'standard', activeData);
  const { active, finished } = splitFarmRows(data, columns, o.reader ?? LEAD);
  return { columns, active, finished };
}

/** Holds the one open row, as the page does through `?track` (S2a-3a); a toggle on the open one closes it. */
function Harness({ o, onExpandFinished }: { o: RenderOptions; onExpandFinished: () => void }) {
  const [openId, setOpenId] = useState<string | null>(o.openId ?? null);
  const { columns, active, finished } = build(o);
  const reader = o.reader ?? LEAD;
  return (
    <ProgressMatrix
      columns={columns}
      active={active}
      finished={finished}
      canManage={o.canManage ?? true}
      currentUserId={reader.currentUserId}
      memberNames={o.memberNames}
      editFor={o.edit ? ownCellsOnly(o.edit) : undefined}
      finishedLoading={o.finishedLoading ?? false}
      finishedError={o.finishedError ?? null}
      onExpandFinished={onExpandFinished}
      openId={openId}
      onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
      groupId="g1"
      userRole={reader.userRole}
    />
  );
}

function matrixElement(o: RenderOptions, onExpandFinished: () => void) {
  return { columns: build(o).columns, element: <Harness o={o} onExpandFinished={onExpandFinished} /> };
}

function renderMatrix(o: RenderOptions = {}) {
  const onExpandFinished = o.onExpandFinished ?? vi.fn();
  const { columns, element } = matrixElement(o, onExpandFinished);
  const view = render(element, { wrapper: TooltipWrapper });
  /** Re-renders with the same rows rebuilt (new array identities), as a store update would. */
  const rerender = (next: RenderOptions = o) => view.rerender(matrixElement(next, onExpandFinished).element);
  return { columns, onExpandFinished, rerender };
}

const farmRows = () => screen.getAllByTestId('progress-farm-row');
const statusOf = (r: HTMLElement) => within(r).getByTestId('progress-status').textContent;
/** The row's disclosure Button (S2a-3a): the one control in its rowheader. */
const nameButton = (r: HTMLElement) => within(within(r).getByRole('rowheader')).getByRole('button');
/** Every Tab stop inside the grid, whether a cell or the control inside one. */
const gridStops = () => Array.from(screen.getByRole('grid').querySelectorAll<HTMLElement>('[tabindex="0"]'));
/** Buttons inside the cells only (the name buttons are in the rowheaders). */
const cellButtons = () => screen.getAllByTestId('progress-cell').flatMap((c) => within(c).queryAllByRole('button'));

// ── Columns (R-S2-6) ────────────────────────────────────────────────────────

describe('ProgressMatrix columns', () => {
  it('heads each claimed column with its job icon, position and name in the role colour', () => {
    renderMatrix();
    const header = screen.getByRole('columnheader', { name: /Aya/ });
    expect(within(header).getByRole('img', { name: 'PLD' })).toBeInTheDocument();
    expect(within(header).getByText('T1')).toBeInTheDocument();
    expect(within(header).getByText('Aya')).toHaveClass('text-role-tank');
    expect(within(screen.getByRole('columnheader', { name: /Bo/ })).getByText('Bo')).toHaveClass('text-role-healer');
    expect(within(screen.getByRole('columnheader', { name: /Dee/ })).getByText('Dee')).toHaveClass('text-role-melee');
  });

  it('dims an unclaimed column and labels it "Claim to track" as a tag, not a control', () => {
    renderMatrix();
    const header = screen.getByRole('columnheader', { name: /Cy/ });
    expect(within(header).getByText('Cy')).toHaveClass('text-text-muted');
    expect(within(header).getByText('Claim to track')).toBeInTheDocument();
    expect(within(header).queryByRole('button')).not.toBeInTheDocument();
    // A claimed column carries no such label.
    expect(within(screen.getByRole('columnheader', { name: /Aya/ })).queryByText('Claim to track')).not.toBeInTheDocument();
  });

  it('trails a "Not on the roster" column per member with a row and no card, by name', () => {
    const { columns } = renderMatrix({
      participants: { wings: [row('wings', 'u-zed', { displayName: 'Zed' }), row('wings', 'u-abe', { displayName: 'Abe' })] },
    });
    const headers = screen.getAllByRole('columnheader');
    // Farm, Actions (a lead's menu column), Status, four players, then the two off-roster members.
    expect(headers).toHaveLength(3 + columns.length);
    expect(headers.slice(-2).map((h) => h.textContent)).toEqual(['AbeNot on the roster', 'ZedNot on the roster']);
  });

  it('says "Card not set up" for a member whose claimed card is not configured', () => {
    renderMatrix({
      players: [...PLAYERS, player('p5', { name: 'Draft', configured: false, userId: 'u-draft' })],
      participants: { wings: [row('wings', 'u-draft', { displayName: 'Dru' })] },
    });
    const header = screen.getByRole('columnheader', { name: /Dru/ });
    expect(within(header).getByText('Card not set up')).toBeInTheDocument();
    expect(screen.queryByText('Not on the roster')).not.toBeInTheDocument();
  });
});

// ── Rows and cells (R-S2-7, R-S2-8) ─────────────────────────────────────────

describe('ProgressMatrix header alignment', () => {
  it('top-aligns every header and puts the Claim to track tag after the name, so names line up', () => {
    renderMatrix({ participants: { wings: [row('wings', 'u-zed', { displayName: 'Zed' })] } });
    for (const header of screen.getAllByTestId('progress-column')) {
      expect(header).toHaveClass('align-top');
    }
    const cy = screen.getByRole('columnheader', { name: /Cy/ });
    const tag = within(cy).getByText('Claim to track');
    expect(within(cy).getByText('Cy').compareDocumentPosition(tag) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The tag is a sibling row below the name row, not a flex item beside the name.
    expect(within(cy).getByText('Cy').parentElement).not.toContainElement(tag);
    const zed = screen.getByRole('columnheader', { name: /Zed/ });
    expect(within(zed).getByText('Zed').compareDocumentPosition(within(zed).getByText('Not on the roster')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('ProgressMatrix rows and cells', () => {
  it('reads "{title} · {type}" with the type icon, and a Scheduled tag only off Farming', () => {
    renderMatrix({
      goals: [
        goal('wings', { title: 'Wings of Resolve', status: 'scheduled' }),
        goal('plain', { title: 'Plain Farm', status: 'farming' }),
        goal('later', { title: 'Later Farm', status: 'wanted', goalType: 'custom_reward' }),
      ],
    });
    const [wings, later, plain] = ['wings', 'later', 'plain'].map(
      (id) => farmRows().find((r) => r.getAttribute('data-goal-id') === id)!,
    );
    // Since S2a-3a the title is the name Button's text and the type reads beside it.
    expect(nameButton(wings)).toHaveTextContent('Wings of Resolve');
    expect(within(wings).getByText('· Mount')).toBeInTheDocument();
    expect(within(wings).getByText('Scheduled')).toBeInTheDocument();
    expect(wings.querySelector('svg')).not.toBeNull();
    expect(nameButton(later)).toHaveTextContent('Later Farm');
    expect(within(later).getByText('· Custom')).toBeInTheDocument();
    expect(within(later).getByText('Wanted')).toBeInTheDocument();
    expect(within(plain).queryByText(/Wanted|Scheduled/)).not.toBeInTheDocument();
  });

  it('shows the model\'s text in each cell and names it for assistive tech', () => {
    renderMatrix({
      participants: {
        wings: [
          row('wings', 'u1', { state: 'need', tokenCount: 62 }),
          row('wings', 'u2', { state: 'want', tokenCount: 30 }),
          row('wings', 'u4', { state: 'have' }),
        ],
      },
    });
    const r = farmRows()[0];
    expect(within(r).getByText('Need 62/99')).toBeInTheDocument();
    expect(within(r).getByText('★ Want 30/99')).toBeInTheDocument();
    expect(within(r).getByText('✓ Have')).toBeInTheDocument();
    expect(within(r).getByRole('gridcell', { name: 'Aya, Wings of Resolve, Need, 62 of 99 Tokens' })).toBeInTheDocument();
    expect(within(r).getByRole('gridcell', { name: 'Cy, Wings of Resolve, unclaimed' })).toHaveTextContent('');
  });

  it('leaves a claimed column with no status blank', () => {
    renderMatrix({ participants: { wings: [row('wings', 'u1', { state: 'pass' })] } });
    const cell = within(farmRows()[0]).getByRole('gridcell', { name: 'Bo, Wings of Resolve, no status' });
    expect(cell).toHaveTextContent('');
    expect(within(farmRows()[0]).getByText('– Pass')).toBeInTheDocument();
  });

  it('gives no cell a control: the matrix is read-only (the keyboard stop is the cell itself)', () => {
    renderMatrix({ participants: { wings: [row('wings', 'u1')] } });
    for (const cell of screen.getAllByTestId('progress-cell')) {
      expect(within(cell).queryByRole('button')).not.toBeInTheDocument();
    }
  });

  it('orders the farm rows by Need, then Want, then title (Q3)', () => {
    renderMatrix({
      goals: [goal('zulu', { title: 'Zulu' }), goal('alpha', { title: 'Alpha' }), goal('wantish', { title: 'Beta' })],
      participants: {
        zulu: [row('zulu', 'u1', { state: 'need' }), row('zulu', 'u2', { state: 'need' })],
        wantish: [row('wantish', 'u1', { state: 'want' })],
      },
    });
    expect(farmRows().map((r) => r.getAttribute('data-goal-id'))).toEqual(['zulu', 'wantish', 'alpha']);
  });
});

// ── Status column (R-S2-7) ──────────────────────────────────────────────────

describe('ProgressMatrix status column', () => {
  const have = (goalId: string, users: string[]) => users.map((u) => row(goalId, u, { state: 'have' }));

  it('reads "2 of 3 have it" over the claimed columns', () => {
    renderMatrix({ participants: { wings: have('wings', ['u1', 'u2']) } });
    expect(statusOf(farmRows()[0])).toBe('2 of 3 have it');
  });

  it('tells a lead "Everyone has it" at n = m', () => {
    renderMatrix({ participants: { wings: have('wings', ['u1', 'u2', 'u4']) }, reader: LEAD, canManage: true });
    expect(statusOf(farmRows()[0])).toBe('Everyone has it');
  });

  it('tells a member "3 of 3 have it" at n = m', () => {
    renderMatrix({ participants: { wings: have('wings', ['u1', 'u2', 'u4']) }, reader: MEMBER, canManage: false });
    expect(statusOf(farmRows()[0])).toBe('3 of 3 have it');
  });

  it('reads "Nobody to track yet" when no claimed column counts', () => {
    renderMatrix({ players: [PLAYERS[2]] });
    expect(statusOf(farmRows()[0])).toBe('Nobody to track yet');
  });

  it('leaves the unclaimed and off-roster columns out of the tally', () => {
    renderMatrix({ participants: { wings: [...have('wings', ['u1', 'u2', 'u4']), row('wings', 'u-zed', { state: 'need' })] }, canManage: false });
    expect(statusOf(farmRows()[0])).toBe('3 of 3 have it');
  });
});

// ── Counts (R-S2-8; B1) ─────────────────────────────────────────────────────

describe('ProgressMatrix counts', () => {
  it('shows a viewer states only: no count anywhere, their own cell included', () => {
    renderMatrix({
      participants: {
        wings: [row('wings', 'u2', { state: 'need', tokenCount: 62 }), row('wings', 'u4', { state: 'want', tokenCount: 30 })],
      },
      reader: { currentUserId: 'u2', userRole: 'viewer' },
      canManage: false,
    });
    const r = farmRows()[0];
    expect(within(r).getByText('Need')).toBeInTheDocument();
    expect(within(r).getByText('★ Want')).toBeInTheDocument();
    expect(r.textContent).not.toMatch(/\d+\/\d+|62|30/);
    expect(within(r).getByRole('gridcell', { name: 'Bo, Wings of Resolve, Need' })).toBeInTheDocument();
  });
});

// ── Container (R-S2-18) ─────────────────────────────────────────────────────

describe('ProgressMatrix container', () => {
  it('scrolls sideways inside its own overflow-x-auto container, and nothing is sticky', () => {
    renderMatrix({ goals: [goal('wings'), goal('done', { status: 'complete', completedAt: '2026-10-01T00:00:00Z' })] });
    const matrix = screen.getByTestId('progress-matrix');
    expect(matrix).toHaveClass('overflow-x-auto');
    // The sr-only caption is absolutely positioned; without a positioned scroller it lands
    // against <body> and widens the page at phone width.
    expect(matrix).toHaveClass('relative');
    expect(matrix.querySelector('table')).not.toBeNull();
    const sticky = [matrix, ...Array.from(matrix.querySelectorAll('*'))].filter((el) => /(^|\s)(sticky|fixed)(\s|$)|\bsticky:/.test(el.getAttribute('class') ?? ''));
    expect(sticky).toEqual([]);
  });
});

// ── Finished (R-S2-7) ───────────────────────────────────────────────────────

describe('ProgressMatrix Finished', () => {
  const done = (id: string, completedAt: string) => goal(id, { title: id, status: 'complete', completedAt });

  it('puts "Finished (n)" after the active rows, collapsed, with aria-expanded false', () => {
    renderMatrix({ goals: [goal('wings'), done('old', '2026-09-01T00:00:00Z'), done('new', '2026-10-01T00:00:00Z')] });
    const button = screen.getByRole('button', { name: 'Finished (2)' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(farmRows().map((r) => r.getAttribute('data-goal-id'))).toEqual(['wings']);
    expect(farmRows()[0].compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no Finished section when nothing is finished', () => {
    renderMatrix();
    expect(screen.queryByRole('button', { name: /Finished/ })).not.toBeInTheDocument();
  });

  it('asks for the cells on the first expand only, then shows the finished rows newest first, read-only', () => {
    const onExpandFinished = vi.fn();
    renderMatrix({
      goals: [goal('wings'), done('old', '2026-09-01T00:00:00Z'), done('new', '2026-10-01T00:00:00Z')],
      participants: { new: [row('new', 'u1', { state: 'have' })] },
      onExpandFinished,
    });
    const button = screen.getByRole('button', { name: 'Finished (2)' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(onExpandFinished).toHaveBeenCalledTimes(1);
    expect(farmRows().map((r) => r.getAttribute('data-goal-id'))).toEqual(['wings', 'new', 'old']);
    for (const cell of screen.getAllByTestId('progress-cell')) {
      expect(within(cell).queryByRole('button')).not.toBeInTheDocument();
    }
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(onExpandFinished).toHaveBeenCalledTimes(1);
  });

  it('shows a loading line, and no finished row, while their cells are fetched', () => {
    renderMatrix({ goals: [goal('wings'), done('new', '2026-10-01T00:00:00Z')], finishedLoading: true });
    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    expect(screen.getByText('Loading finished farms…')).toBeInTheDocument();
    expect(farmRows().map((r) => r.getAttribute('data-goal-id'))).toEqual(['wings']);
  });

  // The harness builds the columns from the active goals, as the page does; whether the page
  // really does is pinned in ProgressPage.matrix.test.tsx. This pins the rendering: a finished
  // row gets one cell per existing column, and a holder with no column is not shown.
  it('renders one cell per existing column on a finished row and shows no off-roster holder', () => {
    const { columns } = renderMatrix({
      goals: [goal('wings'), done('new', '2026-10-01T00:00:00Z')],
      participants: { new: [row('new', 'u-ghost', { displayName: 'Ghost', state: 'have' }), row('new', 'u1', { state: 'have' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    const finishedRow = farmRows().find((r) => r.getAttribute('data-goal-id') === 'new')!;
    expect(within(finishedRow).getAllByTestId('progress-cell')).toHaveLength(columns.length);
    expect(within(finishedRow).getByRole('gridcell', { name: 'Aya, new, Have' })).toBeInTheDocument();
    expect(screen.queryByText('Ghost')).not.toBeInTheDocument();
  });

  it('shows a finished-fetch failure on its own line with a Retry, and keeps the active rows', () => {
    const onExpandFinished = vi.fn();
    renderMatrix({
      goals: [goal('wings'), done('new', '2026-10-01T00:00:00Z')],
      finishedError: 'boom',
      onExpandFinished,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    const alert = screen.getByTestId('progress-finished-error');
    expect(alert).toHaveTextContent('boom');
    expect(farmRows().map((r) => r.getAttribute('data-goal-id'))).toEqual(['wings']);
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(onExpandFinished).toHaveBeenCalledTimes(2);
  });
});

// ── The roving grid (S2a-2·F4 Task TF6) ─────────────────────────────────────

const EDIT: CellWriteTarget = { groupId: 'g1' };
const cellsOf = (r: HTMLElement) => within(r).getAllByTestId('progress-cell');
const allCells = () => screen.getAllByTestId('progress-cell');
const focusCell = (el: HTMLElement) => act(() => el.focus());
const key = (el: HTMLElement, k: string) => fireEvent.keyDown(el, { key: k });

/** Document-order Tab stops, as a browser's Tab key would visit them. */
const tabStops = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(
    (el) => el.tabIndex >= 0 && !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  );

describe('ProgressMatrix keyboard grid', () => {
  const two = [goal('hot', { title: 'Hot' }), goal('calm', { title: 'Calm' })];
  const needy = { hot: [row('hot', 'u1', { state: 'need' })], calm: [row('calm', 'u1', { state: 'want' })] };

  it('is a grid whose rows and cells carry the grid roles', () => {
    renderMatrix({ goals: two, participants: needy });
    const grid = screen.getByRole('grid');
    expect(within(grid).getAllByRole('row').length).toBeGreaterThanOrEqual(3);
    expect(within(grid).getAllByRole('columnheader').length).toBeGreaterThan(2);
    expect(within(grid).getAllByRole('rowheader')).toHaveLength(2);
    expect(allCells().every((c) => c.getAttribute('role') === 'gridcell')).toBe(true);
  });

  it('makes exactly one stop, the first row\'s name button; every cell, blank and unclaimed included, is -1 (R-S3-4)', () => {
    renderMatrix({ goals: two, participants: needy });
    expect(gridStops()).toEqual([nameButton(farmRows()[0])]);
    expect(nameButton(farmRows()[1])).toHaveAttribute('tabindex', '-1');
    expect(allCells().filter((c) => c.getAttribute('tabindex') === '-1')).toHaveLength(allCells().length);
  });

  it('is one Tab stop for the whole matrix: before, the first name button, after', () => {
    const { element } = matrixElement({ goals: two, participants: needy }, vi.fn());
    render(
      <>
        <button type="button">before</button>
        {element}
        <button type="button">after</button>
      </>,
      { wrapper: TooltipWrapper },
    );
    const stops = tabStops();
    expect(stops).toHaveLength(3);
    expect(stops[0]).toHaveTextContent('before');
    expect(stops[1]).toBe(nameButton(farmRows()[0]));
    expect(stops[1].closest('[role="rowheader"]')).not.toBeNull();
    expect(stops[2]).toHaveTextContent('after');
    // The scroller is not a second stop while the grid has a cell.
    expect(screen.getByTestId('progress-matrix')).not.toHaveAttribute('tabindex');
  });

  it('keeps the scroller itself a stop when the grid has no cell to hold the keyboard', () => {
    renderMatrix({ goals: [goal('done', { status: 'complete', completedAt: '2026-10-01T00:00:00Z' })] });
    expect(screen.queryAllByTestId('progress-cell')).toHaveLength(0);
    expect(screen.getByTestId('progress-matrix')).toHaveAttribute('tabindex', '0');
  });

  it('moves focus with the arrow keys across farm rows and columns, and eats the key', () => {
    renderMatrix({ goals: two, participants: needy });
    const [first, second] = farmRows();
    const a = cellsOf(first);
    const b = cellsOf(second);
    focusCell(a[0]);

    expect(key(a[0], 'ArrowRight')).toBe(false);
    expect(a[1]).toHaveFocus();
    key(a[1], 'ArrowRight');
    expect(a[2]).toHaveFocus();
    key(a[2], 'ArrowDown');
    expect(b[2]).toHaveFocus();
    key(b[2], 'ArrowLeft');
    expect(b[1]).toHaveFocus();
    key(b[1], 'ArrowUp');
    expect(a[1]).toHaveFocus();
  });

  it('jumps to the name and the last cell of the row with Home and End', () => {
    renderMatrix({ goals: two, participants: needy });
    const b = cellsOf(farmRows()[1]);
    focusCell(b[2]);
    key(b[2], 'End');
    expect(b[b.length - 1]).toHaveFocus();
    key(b[b.length - 1], 'Home');
    expect(nameButton(farmRows()[1])).toHaveFocus();
  });

  it('stops at every edge, the name on the left, without wrapping and leaves the key alone', () => {
    renderMatrix({ goals: two, participants: needy });
    const [first, second] = farmRows();
    const name = nameButton(first);
    const b = cellsOf(second);
    const last = b[b.length - 1];
    focusCell(name);
    expect(key(name, 'ArrowLeft')).toBe(true);
    expect(key(name, 'ArrowUp')).toBe(true);
    expect(key(name, 'Home')).toBe(true);
    expect(name).toHaveFocus();
    focusCell(last);
    expect(key(last, 'ArrowRight')).toBe(true);
    expect(key(last, 'ArrowDown')).toBe(true);
    expect(key(last, 'End')).toBe(true);
    expect(last).toHaveFocus();
  });

  it('scrolls the cell it moves to into view, since native focus leaves a half-hidden one cut off', () => {
    renderMatrix({ goals: two, participants: needy });
    const a = cellsOf(farmRows()[0]);
    const spies = a.map((c) => {
      const spy = vi.fn();
      (c as unknown as { scrollIntoView: typeof spy }).scrollIntoView = spy;
      return spy;
    });
    focusCell(a[0]);
    key(a[0], 'ArrowRight');
    expect(spies[1]).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
    expect(spies[0]).not.toHaveBeenCalled();
  });

  it('ignores a modified arrow and any other key', () => {
    renderMatrix({ goals: two, participants: needy });
    const a = cellsOf(farmRows()[0]);
    focusCell(a[0]);
    expect(fireEvent.keyDown(a[0], { key: 'ArrowRight', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(a[0], { key: 'ArrowRight', shiftKey: true })).toBe(true);
    expect(key(a[0], 'a')).toBe(true);
    expect(a[0]).toHaveFocus();
  });

  it('moves the one stop to the last focused cell, and keeps it through a re-render', () => {
    const { rerender } = renderMatrix({ goals: two, participants: needy });
    const target = cellsOf(farmRows()[1])[3];
    focusCell(target);
    expect(allCells().filter((c) => c.tabIndex === 0)).toEqual([target]);

    rerender();
    const after = cellsOf(farmRows()[1])[3];
    expect(allCells().filter((c) => c.tabIndex === 0)).toEqual([after]);
    expect(after.getAttribute('aria-label')).toBe(target.getAttribute('aria-label'));
  });

  it('falls back to the first row\'s name when the stop\'s row is gone', () => {
    const { rerender } = renderMatrix({ goals: two, participants: needy });
    focusCell(cellsOf(farmRows()[1])[1]);
    rerender({ goals: [two[0]], participants: needy });
    expect(gridStops()).toEqual([nameButton(farmRows()[0])]);
  });

  it('keeps Finished rows out of the grid: their name a plain stop, their cells no stop and not an arrow target', () => {
    renderMatrix({
      goals: [goal('wings'), goal('done', { title: 'Done', status: 'complete', completedAt: '2026-10-01T00:00:00Z' })],
      participants: { done: [row('done', 'u1', { state: 'have' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    const doneRow = farmRows().find((r) => r.getAttribute('data-goal-id') === 'done')!;
    for (const c of cellsOf(doneRow)) expect(c).not.toHaveAttribute('tabindex');
    // The finished row's disclosure is a plain tab stop (R-S3-4): no roving tabindex, reachable by Tab.
    expect(nameButton(doneRow)).not.toHaveAttribute('tabindex');
    expect(nameButton(doneRow).tabIndex).toBe(0);
    expect(gridStops()).toEqual([nameButton(farmRows()[0])]);

    const active = cellsOf(farmRows()[0]);
    focusCell(active[0]);
    expect(key(active[0], 'ArrowDown')).toBe(true);
    expect(active[0]).toHaveFocus();
  });
});

// ── The lead's row-menu column (S2a-3a·G4 Task TG7; D-22, R-S3-17) ──

/** A row's ⋯ menu button (a lead's second cell). */
const menuButton = (r: HTMLElement) => within(r).getByRole('button', { name: /^Actions for / });
const hasMenu = (r: HTMLElement) => within(r).queryAllByRole('button', { name: /^Actions for / }).length > 0;

describe('ProgressMatrix row menu column', () => {
  const two = [goal('hot', { title: 'Hot' }), goal('calm', { title: 'Calm' })];
  const needy = { hot: [row('hot', 'u1', { state: 'need' })], calm: [row('calm', 'u1', { state: 'want' })] };
  const done = goal('done', { title: 'Done', status: 'complete', completedAt: '2026-10-01T00:00:00Z' });
  const VIEWER: ProgressReader = { currentUserId: 'u1', userRole: 'viewer' };

  it('gives a lead an "Actions" column and an "Actions for {title}" menu button on every farm row', () => {
    const { columns } = renderMatrix({ goals: two, participants: needy });
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    const [hot, calm] = farmRows();
    expect(menuButton(hot)).toHaveAccessibleName('Actions for Hot');
    expect(menuButton(hot)).toHaveAttribute('aria-haspopup', 'menu');
    expect(menuButton(calm)).toHaveAccessibleName('Actions for Calm');
    // Farm, Actions, Status and one per column.
    expect(screen.getAllByRole('columnheader')).toHaveLength(3 + columns.length);
  });

  it.each([
    ['a member', MEMBER, false],
    ['a viewer', VIEWER, false],
    ['a viewer with manage access', VIEWER, true],
  ] as const)('gives %s no menu column and no button (hidden, not disabled)', (_label, reader, canManage) => {
    const { columns } = renderMatrix({ goals: [...two, done], participants: needy, reader, canManage, openId: 'hot' });
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /^Actions for / })).toHaveLength(0);
    expect(screen.getAllByRole('columnheader')).toHaveLength(2 + columns.length);
    // Their panel spans one column less than a lead's.
    expect((within(panel()!).getByRole('gridcell') as HTMLTableCellElement).colSpan).toBe(columns.length + 2);
    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    expect(screen.queryAllByRole('button', { name: /^Actions for / })).toHaveLength(0);
    for (const r of farmRows()) expect(within(r).queryAllByTestId('progress-menu')).toHaveLength(0);
  });

  it("gives a lead's panel the extra column in its span", () => {
    const { columns } = renderMatrix({ goals: two, participants: needy, openId: 'hot' });
    expect((within(panel()!).getByRole('gridcell') as HTMLTableCellElement).colSpan).toBe(columns.length + 3);
  });

  it('opens Mark finished · Delete on an active row, and Reopen · Delete on a finished one', () => {
    renderMatrix({ goals: [...two, done], participants: { ...needy, done: [row('done', 'u1', { state: 'have' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    const rows = farmRows();
    fireEvent.click(menuButton(rows[0]));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Mark finished', 'Delete']);
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Mark finished' }), { key: 'Escape' });
    fireEvent.click(menuButton(rows[2]));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Reopen', 'Delete']);
  });

  it('reads "Everyone has it" alone in the status cell at n = m, with no link or button in it', () => {
    renderMatrix({ goals: two, participants: { hot: ['u1', 'u2', 'u4'].map((u) => row('hot', u, { state: 'have' })) } });
    const hot = farmRows().find((r) => r.getAttribute('data-goal-id') === 'hot')!;
    const status = within(hot).getByTestId('progress-status');
    expect(status.textContent).toBe('Everyone has it');
    expect(within(status).queryAllByRole('button')).toHaveLength(0);
    expect(within(status).queryAllByRole('link')).toHaveLength(0);
  });

  describe('in the grid (R-S3-17)', () => {
    it("is the lead's second cell: ArrowRight from the name focuses it, again the first player cell", () => {
      renderMatrix({ goals: two, participants: needy });
      const hot = farmRows()[0];
      focusCell(nameButton(hot));
      expect(key(nameButton(hot), 'ArrowRight')).toBe(false);
      expect(menuButton(hot)).toHaveFocus();
      expect(key(menuButton(hot), 'ArrowRight')).toBe(false);
      expect(cellsOf(hot)[0]).toHaveFocus();
    });

    it('is reached back through the menu: ArrowLeft from the first player cell, then the name', () => {
      renderMatrix({ goals: two, participants: needy });
      const hot = farmRows()[0];
      focusCell(cellsOf(hot)[0]);
      expect(key(cellsOf(hot)[0], 'ArrowLeft')).toBe(false);
      expect(menuButton(hot)).toHaveFocus();
      expect(key(menuButton(hot), 'ArrowLeft')).toBe(false);
      expect(nameButton(hot)).toHaveFocus();
    });

    it('lands Home on the name from the menu and from a cell, and moves down the menu column with ArrowDown', () => {
      renderMatrix({ goals: two, participants: needy });
      const [hot, calm] = farmRows();
      focusCell(menuButton(hot));
      expect(key(menuButton(hot), 'ArrowDown')).toBe(false);
      expect(menuButton(calm)).toHaveFocus();
      expect(key(menuButton(calm), 'Home')).toBe(false);
      expect(nameButton(calm)).toHaveFocus();
      focusCell(cellsOf(calm)[2]);
      key(cellsOf(calm)[2], 'Home');
      expect(nameButton(calm)).toHaveFocus();
    });

    it('stays one Tab stop: the name until a cell is focused, every menu button -1', () => {
      renderMatrix({ goals: two, participants: needy });
      const [hot, calm] = farmRows();
      expect(gridStops()).toEqual([nameButton(hot)]);
      expect(menuButton(hot)).toHaveAttribute('tabindex', '-1');
      expect(menuButton(calm)).toHaveAttribute('tabindex', '-1');
      // The stop follows focus onto the menu button, and stays singular.
      focusCell(menuButton(calm));
      expect(gridStops()).toEqual([menuButton(calm)]);
    });

    it("sends a member's name ArrowRight straight to the first player cell", () => {
      renderMatrix({ goals: two, participants: needy, reader: MEMBER, canManage: false });
      const hot = farmRows()[0];
      focusCell(nameButton(hot));
      expect(key(nameButton(hot), 'ArrowRight')).toBe(false);
      expect(cellsOf(hot)[0]).toHaveFocus();
    });

    it("makes a Finished row's menu button a plain tab stop, not an arrow target", () => {
      renderMatrix({ goals: [...two, done], participants: { ...needy, done: [row('done', 'u1', { state: 'have' })] } });
      fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
      const doneRow = farmRows().find((r) => r.getAttribute('data-goal-id') === 'done')!;
      expect(hasMenu(doneRow)).toBe(true);
      expect(menuButton(doneRow)).not.toHaveAttribute('tabindex');
      expect(menuButton(doneRow).tabIndex).toBe(0);
      // The grid is still the one stop, and no arrow from an active row reaches the finished one.
      expect(gridStops()).toEqual([nameButton(farmRows()[0])]);
      const lastMenu = menuButton(farmRows()[1]);
      focusCell(lastMenu);
      expect(key(lastMenu, 'ArrowDown')).toBe(true);
      expect(lastMenu).toHaveFocus();
    });
  });
});

// ── The disclosure, the panel row and the grid (S2a-3a·G2 Task TG3; D-7, R-S3-3, R-S3-4) ──

const panel = () => screen.queryByTestId('progress-expansion');

describe('ProgressMatrix disclosure', () => {
  const two = [goal('hot', { title: 'Hot' }), goal('calm', { title: 'Calm' })];
  const needy = { hot: [row('hot', 'u1', { state: 'need' })], calm: [row('calm', 'u1', { state: 'want' })] };

  it('makes the name cell a Button named "{title}" with a chevron, aria-expanded=false and aria-controls, and no panel', () => {
    renderMatrix({ goals: two, participants: needy });
    const [hot, calm] = farmRows();
    const name = within(hot).getByRole('button', { name: 'Hot' });
    expect(name).toBe(nameButton(hot));
    expect(name).toHaveAttribute('aria-expanded', 'false');
    expect(name).toHaveAttribute('aria-controls', 'progress-expansion-hot');
    // The type icon leads and the chevron trails, both decorative.
    expect(name.querySelectorAll('svg[aria-hidden]')).toHaveLength(2);
    expect(within(calm).getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-expanded', 'false');
    expect(panel()).toBeNull();
  });

  it('opens the panel right after the row on click, one at a time, and a second click closes it', () => {
    renderMatrix({ goals: two, participants: needy });
    const [hot, calm] = farmRows();
    fireEvent.click(nameButton(hot));
    expect(nameButton(hot)).toHaveAttribute('aria-expanded', 'true');
    expect(panel()).not.toBeNull();
    expect(hot.nextElementSibling).toBe(panel());
    expect(panel()).toHaveAttribute('id', 'progress-expansion-hot');
    expect(screen.getAllByTestId('progress-expansion')).toHaveLength(1);

    fireEvent.click(nameButton(calm));
    expect(nameButton(hot)).toHaveAttribute('aria-expanded', 'false');
    expect(nameButton(calm)).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByTestId('progress-expansion')).toHaveLength(1);
    expect(calm.nextElementSibling).toBe(panel());

    fireEvent.click(nameButton(calm));
    expect(nameButton(calm)).toHaveAttribute('aria-expanded', 'false');
    expect(panel()).toBeNull();
  });

  it('opens the row the harness was given, as the page does from ?track', () => {
    renderMatrix({ goals: two, participants: needy, openId: 'calm' });
    expect(nameButton(farmRows()[1])).toHaveAttribute('aria-expanded', 'true');
    expect(farmRows()[1].nextElementSibling).toBe(panel());
  });

  it('never opens the row from a player cell: the own-cell picker opens instead', () => {
    renderMatrix({ goals: two, participants: needy, reader: MEMBER, edit: EDIT });
    const own = screen.getByRole('button', { name: 'Aya, Hot, Need — change your status' });
    fireEvent.click(own);
    expect(screen.getByRole('group', { name: 'Status' })).toBeInTheDocument();
    expect(panel()).toBeNull();
    expect(nameButton(farmRows()[0])).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    // A plain cell's click opens nothing either.
    fireEvent.click(screen.getByRole('gridcell', { name: 'Bo, Hot, no status' }));
    expect(panel()).toBeNull();
  });

  it('renders the panel as a grid row with one gridcell spanning every column, outside the arrow keys\' rows', () => {
    const { columns } = renderMatrix({ goals: two, participants: needy, openId: 'hot' });
    const open = panel()!;
    expect(open).toHaveAttribute('role', 'row');
    const cells = within(open).getAllByRole('gridcell');
    expect(cells).toHaveLength(1);
    // Farm, a lead's Actions, Status and one per column.
    expect((cells[0] as HTMLTableCellElement).colSpan).toBe(columns.length + 3);
    expect(cells[0]).not.toHaveAttribute('tabindex');
    expect(within(open).queryAllByTestId('progress-cell')).toHaveLength(0);
    // The grid's rows are the farm rows alone: ArrowDown from the open row skips the panel.
    const [hot, calm] = farmRows();
    focusCell(nameButton(hot));
    expect(key(nameButton(hot), 'ArrowDown')).toBe(false);
    expect(nameButton(calm)).toHaveFocus();
    key(nameButton(calm), 'ArrowUp');
    expect(nameButton(hot)).toHaveFocus();
    // The panel holds its three columns under their headings, and the action bar with Copy plan.
    expect(within(open).getByRole('heading', { name: 'Next in line' })).toBeInTheDocument();
    expect(within(open).getByRole('heading', { name: 'Last drops' })).toBeInTheDocument();
    expect(within(open).getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(within(within(open).getByTestId('progress-expansion-actions')).getByRole('button', { name: 'Copy plan' })).toBeInTheDocument();
  });

  it('reaches the name with Home, and with ArrowLeft from the first player cell for a member, and moves between names with ArrowDown', () => {
    renderMatrix({ goals: two, participants: needy, reader: MEMBER, canManage: false });
    const [hot, calm] = farmRows();
    const a = cellsOf(hot);
    focusCell(a[2]);
    expect(key(a[2], 'Home')).toBe(false);
    expect(nameButton(hot)).toHaveFocus();
    focusCell(a[0]);
    expect(key(a[0], 'ArrowLeft')).toBe(false);
    expect(nameButton(hot)).toHaveFocus();
    expect(key(nameButton(hot), 'ArrowDown')).toBe(false);
    expect(nameButton(calm)).toHaveFocus();
    expect(gridStops()).toEqual([nameButton(calm)]);
    expect(key(nameButton(calm), 'ArrowRight')).toBe(false);
    expect(cellsOf(calm)[0]).toHaveFocus();
  });

  it('lets Enter and Space through to the native button, so they toggle the row', () => {
    renderMatrix({ goals: two, participants: needy });
    const name = nameButton(farmRows()[0]);
    focusCell(name);
    // The grid hook eats only its navigation keys: an activation key keeps its default.
    expect(fireEvent.keyDown(name, { key: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(name, { key: ' ' })).toBe(true);
    expect(name).toHaveFocus();
    // jsdom does not synthesize the click a real Enter fires on a button; the click is the toggle.
    fireEvent.click(name);
    expect(name).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(name);
    expect(name).toHaveAttribute('aria-expanded', 'false');
  });

  it('puts the panel next in DOM order after the open row, with no roving tabindex of its own', () => {
    renderMatrix({ goals: two, participants: needy, openId: 'hot' });
    const [hot, calm] = farmRows();
    const open = panel()!;
    expect(hot.nextElementSibling).toBe(open);
    expect(open.nextElementSibling).toBe(calm);
    // The panel's controls are plain tab stops: nothing in it joins the grid's roving order.
    expect(open.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  describe('Tab from the open row into the panel (carried from G2)', () => {
    /**
     * One Tab press as a browser does it: the key event first (a handler may take it), then focus
     * moves to the next element in document order that is a tab stop. jsdom has no Tab key, and
     * `@testing-library/user-event` is not a dependency, so this follows the same order.
     */
    const pressTab = () => {
      const from = document.activeElement as HTMLElement;
      if (!fireEvent.keyDown(from, { key: 'Tab' })) return;
      const stops = tabStops();
      stops[stops.indexOf(from) + 1]?.focus();
    };

    it('reaches the panel\'s first control (a lead\'s Log drop for #1, S2a-3a·G3) from the open row\'s roving cell', () => {
      renderMatrix({ goals: two, participants: needy, openId: 'hot' });
      const [hot] = farmRows();
      focusCell(nameButton(hot));
      expect(gridStops()).toEqual([nameButton(hot)]);
      pressTab();
      expect(within(panel()!).getByRole('button', { name: 'Log drop for Aya' })).toHaveFocus();
    });

    it('reaches the open row\'s first control from the first row\'s stop when a later row is open', () => {
      renderMatrix({ goals: two, participants: needy, openId: 'calm' });
      const [hot, calm] = farmRows();
      focusCell(nameButton(hot));
      pressTab();
      expect(calm.nextElementSibling).toBe(panel());
      expect(within(panel()!).getByRole('button', { name: 'Log drop for Aya' })).toHaveFocus();
    });

    it('reaches Copy plan first for a viewer, whose panel has no drop action', () => {
      renderMatrix({ goals: two, participants: needy, openId: 'hot', reader: { currentUserId: 'u1', userRole: 'viewer' }, canManage: false });
      focusCell(nameButton(farmRows()[0]));
      pressTab();
      expect(within(panel()!).getByRole('button', { name: 'Copy plan' })).toHaveFocus();
    });
  });

  it('closes on Escape inside the panel and returns focus to the name button', () => {
    renderMatrix({ goals: two, participants: needy, openId: 'hot' });
    const name = nameButton(farmRows()[0]);
    const heading = within(panel()!).getByRole('heading', { name: 'About' });
    expect(fireEvent.keyDown(heading, { key: 'Escape' })).toBe(false);
    expect(panel()).toBeNull();
    expect(name).toHaveAttribute('aria-expanded', 'false');
    expect(name).toHaveFocus();
    expect(gridStops()).toEqual([name]);
  });

  it('leaves the panel open on an Escape a layer already handled (defaultPrevented), R-S3-4', () => {
    renderMatrix({ goals: two, participants: needy, openId: 'hot' });
    const heading = within(panel()!).getByRole('heading', { name: 'About' });
    const handled = createEvent.keyDown(heading, { key: 'Escape' });
    handled.preventDefault();
    fireEvent(heading, handled);
    expect(panel()).not.toBeNull();
    expect(nameButton(farmRows()[0])).toHaveAttribute('aria-expanded', 'true');
  });

  it('leaves the panel open on an Escape from outside the open row (a cell of another row)', () => {
    renderMatrix({ goals: two, participants: needy, openId: 'hot' });
    const calmCell = cellsOf(farmRows()[1])[1];
    expect(fireEvent.keyDown(calmCell, { key: 'Escape' })).toBe(true);
    expect(panel()).not.toBeNull();
  });
});

// ── The open panel's width (G2b fix) ────────────────────────────────────────

describe('ProgressMatrix open panel width', () => {
  const two = [goal('hot', { title: 'Hot' }), goal('calm', { title: 'Calm' })];
  const needy = { hot: [row('hot', 'u1', { state: 'need' })], calm: [row('calm', 'u1', { state: 'want' })] };
  const TABLE_WIDTH = 1902;
  let scrollerWidth = 1290;
  let notify: (() => void) | null = null;
  const WIDTH_PROPS = ['clientWidth', 'scrollWidth', 'offsetWidth'];
  const originals = WIDTH_PROPS.map((prop) => Object.getOwnPropertyDescriptor(Element.prototype, prop));

  beforeEach(() => {
    scrollerWidth = 1290;
    notify = null;
    // jsdom has no layout: the scroller is 1290 wide, the table inside it (and anything else) 1902.
    for (const prop of WIDTH_PROPS) {
      Object.defineProperty(Element.prototype, prop, {
        configurable: true,
        get(this: Element) {
          return this.getAttribute('data-testid') === 'progress-matrix' ? scrollerWidth : TABLE_WIDTH;
        },
      });
    }
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          notify = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    WIDTH_PROPS.forEach((prop, i) => {
      const descriptor = originals[i];
      if (descriptor) Object.defineProperty(Element.prototype, prop, descriptor);
      else delete (Element.prototype as unknown as Record<string, unknown>)[prop];
    });
  });

  const body = () => within(panel()!).getByTestId('progress-expansion-body');

  it('lays the panel out at the scroller\'s visible width, not the table\'s', () => {
    renderMatrix({ goals: two, participants: needy, openId: 'hot' });
    expect(body()).toHaveStyle({ width: `${scrollerWidth}px` });
    expect(body().style.width).not.toBe(`${TABLE_WIDTH}px`);
  });

  it('follows the scroller when it resizes', () => {
    renderMatrix({ goals: two, participants: needy, openId: 'hot' });
    scrollerWidth = 980;
    act(() => notify?.());
    expect(body()).toHaveStyle({ width: '980px' });
  });

  it('applies to the panel of a row opened after the first render too', () => {
    renderMatrix({ goals: two, participants: needy });
    fireEvent.click(nameButton(farmRows()[1]));
    expect(body()).toHaveStyle({ width: `${scrollerWidth}px` });
  });
});

// ── Provenance tooltips (R-S2-9) ────────────────────────────────────────────

describe('ProgressMatrix provenance tooltip', () => {
  const lead = row('wings', 'u9', { displayName: 'Lead One', memberRole: 'lead', state: 'have' });
  /** Someone other than Aya is looking, so Aya's own writes read "self-reported", not "you". */
  const BO: ProgressReader = { currentUserId: 'u2', userRole: 'member' };
  const aya = () => screen.getByRole('gridcell', { name: /^Aya, Wings of Resolve, Need/ });

  it('opens on keyboard focus with "set by {name}" for a lead\'s correction', async () => {
    renderMatrix({
      participants: { wings: [row('wings', 'u1', { state: 'need', updatedByUserId: 'u9', updatedVia: 'web' }), lead] },
    });
    focusCell(aya());
    expect((await screen.findAllByText('set by Lead One')).length).toBeGreaterThan(0);
  });

  it('names a writer with no column from the member list', async () => {
    // u7 holds no row and no column here (a lead with no claimed card); u2 has a column.
    renderMatrix({
      participants: { wings: [row('wings', 'u1', { state: 'need', updatedByUserId: 'u7', updatedVia: 'web' })] },
      memberNames: new Map([['u7', 'Offstage Lead'], ['u2', 'Not Bo']]),
    });
    focusCell(aya());
    expect((await screen.findAllByText('set by Offstage Lead')).length).toBeGreaterThan(0);
  });

  it('prefers the column name over the member list, and says "another member" with neither', async () => {
    renderMatrix({
      participants: {
        wings: [
          row('wings', 'u1', { state: 'need', updatedByUserId: 'u2', updatedVia: 'web' }),
          row('wings', 'u4', { state: 'need', updatedByUserId: 'u8', updatedVia: 'web' }),
        ],
      },
      memberNames: new Map([['u2', 'Not Bo']]),
    });
    focusCell(aya());
    expect((await screen.findAllByText('set by Bo')).length).toBeGreaterThan(0);
    expect(screen.queryByText('set by Not Bo')).not.toBeInTheDocument();
    act(() => aya().blur());
    focusCell(screen.getByRole('gridcell', { name: /^Dee, Wings of Resolve, Need/ }));
    expect((await screen.findAllByText('set by another member')).length).toBeGreaterThan(0);
  });

  it('opens on hover too', async () => {
    renderMatrix({
      participants: { wings: [row('wings', 'u1', { state: 'need', updatedByUserId: 'u1', updatedVia: 'web' })] },
      reader: BO,
    });
    fireEvent.pointerMove(aya());
    expect((await screen.findAllByText('self-reported', {}, { timeout: 2000 })).length).toBeGreaterThan(0);
  });

  it('says "you" to the writer, as the viewer the matrix was given (View As)', async () => {
    renderMatrix({
      participants: { wings: [row('wings', 'u1', { state: 'need', updatedByUserId: 'u9', updatedVia: 'web' }), lead] },
      reader: { currentUserId: 'u9', userRole: 'lead' },
    });
    focusCell(aya());
    expect((await screen.findAllByText('you')).length).toBeGreaterThan(0);
  });

  it('shows the state line and a count line when the sides differ', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    renderMatrix({
      reader: BO,
      participants: {
        wings: [
          row('wings', 'u1', {
            state: 'need',
            tokenCount: 62,
            updatedByUserId: 'u1',
            updatedVia: 'web',
            countFromRecord: true,
            record: {
              characterId: 'c', ownershipState: 'owned', tokenCount: 62, source: 'plugin', updatedByUserId: null,
              updatedVia: 'api_key', stateChangedAt: null, tokenCountUpdatedAt: threeDaysAgo, lastSyncedAt: null,
            },
          }),
        ],
      },
    });
    focusCell(aya());
    expect((await screen.findAllByText('State: self-reported')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Count: plugin, 3d ago').length).toBeGreaterThan(0);
  });

  it('shows no count line and no count time for a hidden count', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    renderMatrix({
      reader: BO,
      participants: {
        wings: [
          row('wings', 'u1', {
            state: 'need',
            tokenCount: null,
            countHidden: true,
            updatedByUserId: 'u1',
            updatedVia: 'web',
            countFromRecord: true,
            record: {
              characterId: 'c', ownershipState: 'owned', tokenCount: null, source: 'plugin', updatedByUserId: null,
              updatedVia: 'api_key', stateChangedAt: null, tokenCountUpdatedAt: threeDaysAgo, lastSyncedAt: null,
            },
          }),
        ],
      },
    });
    focusCell(screen.getByRole('gridcell', { name: 'Aya, Wings of Resolve, Need' }));
    expect((await screen.findAllByText('self-reported')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Count:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/3d ago/)).not.toBeInTheDocument();
  });

  it('opens nothing for a blank cell, yet the cell is still focusable', () => {
    renderMatrix({ participants: { wings: [row('wings', 'u1')] } });
    const blank = screen.getByRole('gridcell', { name: 'Bo, Wings of Resolve, no status' });
    focusCell(blank);
    expect(blank).toHaveFocus();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

// ── The reader's own cell (S2a-2·F5 Task TF7; R-S2-10) ──────────────────────

const ownButton = (name: RegExp | string) => screen.getByRole('button', { name });

describe('ProgressMatrix own cell', () => {
  it('makes the reader\'s own cells buttons named "…, {state} — change your status", and no one else\'s', () => {
    renderMatrix({
      participants: { wings: [row('wings', 'u1', { state: 'need', tokenCount: 62 }), row('wings', 'u2', { state: 'have' })] },
      reader: MEMBER,
      edit: EDIT,
    });
    const own = ownButton('Aya, Wings of Resolve, Need, 62 of 99 Tokens — change your status');
    expect(own.closest('[role="gridcell"]')).toHaveAttribute('aria-label', 'Aya, Wings of Resolve, Need, 62 of 99 Tokens');
    expect(within(own).getByText('Need 62/99')).toHaveClass('text-status-error');
    for (const cell of allCells()) {
      if (cell.contains(own)) continue;
      expect(within(cell).queryByRole('button')).not.toBeInTheDocument();
    }
    expect(cellButtons()).toEqual([own]);
  });

  it('shows a muted text-xs "Set status" in an own blank cell, named "…, no status — set your status"; another member\'s blank cell stays empty', () => {
    renderMatrix({ participants: { wings: [row('wings', 'u4', { state: 'have' })] }, reader: MEMBER, edit: EDIT });
    const own = ownButton('Aya, Wings of Resolve, no status — set your status');
    const hint = within(own).getByText('Set status');
    expect(hint).toHaveClass('text-xs');
    expect(hint).toHaveClass('text-text-muted');
    expect(screen.getByRole('gridcell', { name: 'Bo, Wings of Resolve, no status' })).toHaveTextContent('');
  });

  it('makes no cell a button when no edit prop is passed', () => {
    renderMatrix({ participants: { wings: [row('wings', 'u1', { state: 'need' })] }, reader: { currentUserId: 'u1', userRole: 'viewer' } });
    expect(cellButtons()).toEqual([]);
  });

  it('makes a Not-on-the-roster own cell a button too, and leaves Finished rows read-only', () => {
    renderMatrix({
      goals: [goal('wings', { title: 'Wings of Resolve' }), goal('done', { title: 'Done', status: 'complete', completedAt: '2026-10-01T00:00:00Z' })],
      participants: { wings: [row('wings', 'u-zed', { displayName: 'Zed', state: 'want' })], done: [row('done', 'u-zed', { displayName: 'Zed', state: 'have' })] },
      reader: { currentUserId: 'u-zed', userRole: 'member' },
      edit: EDIT,
    });
    expect(ownButton('Zed, Wings of Resolve, Want — change your status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    const doneRow = farmRows().find((r) => r.getAttribute('data-goal-id') === 'done')!;
    for (const cell of cellsOf(doneRow)) expect(within(cell).queryByRole('button')).not.toBeInTheDocument();
    expect(within(doneRow).getByRole('gridcell', { name: 'Zed, Done, Have' })).toBeInTheDocument();
  });
});

// ── One roving stop with a control in the cell (TF7 rulings 1 and 2) ─────────

describe('ProgressMatrix keyboard grid with own-cell buttons', () => {
  const two = [goal('hot', { title: 'Hot' }), goal('calm', { title: 'Calm' })];
  const mixed = { hot: [row('hot', 'u1', { state: 'need', tokenCount: 62 }), row('hot', 'u2', { state: 'have' })], calm: [row('calm', 'u1', { state: 'want' })] };
  const realSetCell = useCollectionGoalStore.getState().setCell;

  afterEach(() => {
    useCollectionGoalStore.setState({ setCell: realSetCell });
    useToastStore.getState().clearAll();
  });

  it('has exactly one Tab stop, the own cell\'s button once focused, with the td around it no stop of its own', () => {
    renderMatrix({ goals: two, participants: mixed, reader: MEMBER, edit: EDIT });
    // Before any cell is focused the stop is the first row's name (S2a-3a).
    expect(gridStops()).toEqual([nameButton(farmRows()[0])]);
    const own = ownButton('Aya, Hot, Need, 62 of 99 Tokens — change your status');
    focusCell(own);
    const stops = gridStops();
    expect(stops).toEqual([own]);
    expect(stops[0].closest('td')).not.toHaveAttribute('tabindex');
    // Every other cell is in the grid at -1.
    expect(allCells().filter((c) => c.getAttribute('tabindex') === '-1')).toHaveLength(allCells().length - 2);
  });

  it('moves with the arrows from the button to a plain cell and back onto the button', () => {
    renderMatrix({ goals: two, participants: mixed, reader: MEMBER, edit: EDIT });
    const own = ownButton('Aya, Hot, Need, 62 of 99 Tokens — change your status');
    const bo = screen.getByRole('gridcell', { name: 'Bo, Hot, Have' });
    focusCell(own);

    expect(key(own, 'ArrowRight')).toBe(false);
    expect(bo).toHaveFocus();
    expect(key(bo, 'ArrowLeft')).toBe(false);
    expect(own).toHaveFocus();
    key(own, 'ArrowDown');
    expect(ownButton('Aya, Calm, Want — change your status')).toHaveFocus();
    expect(gridStops()).toEqual([ownButton('Aya, Calm, Want — change your status')]);
  });

  it('keeps focus and the stop on the cell through a pick that moves its row down (review I-1, I-2)', async () => {
    const setCell = vi.fn().mockResolvedValue({ entry: row('hot', 'u1', { state: 'have' }), undoToken: null });
    useCollectionGoalStore.setState({ setCell });
    const { rerender } = renderMatrix({ goals: two, participants: mixed, reader: MEMBER, edit: EDIT });
    expect(farmRows().map((r) => r.getAttribute('data-goal-id'))).toEqual(['hot', 'calm']);
    const own = ownButton('Aya, Hot, Need, 62 of 99 Tokens — change your status');
    focusCell(own);
    fireEvent.click(own);
    fireEvent.click(within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name: '✓ Have' }));
    expect(setCell).toHaveBeenCalledWith('g1', 'hot', { state: 'have' });
    await waitFor(() => expect(own).toHaveFocus());

    // The response merges: Hot has no Need left, so Calm (one Want) sorts above it and React
    // moves the focused row. The DOM's focus fixup drops focus to <body> on that move (jsdom
    // does it too), and React DOM refocuses the moved button in the same commit; the stop
    // must stay on Hot's cell, second row now, not fall back to the first cell.
    const refocus = vi.spyOn(own, 'focus');
    try {
      rerender({
        goals: two,
        participants: { ...mixed, hot: [row('hot', 'u1', { state: 'have' }), row('hot', 'u2', { state: 'have' })] },
        reader: MEMBER,
        edit: EDIT,
      });
      expect(refocus).toHaveBeenCalled();
    } finally {
      refocus.mockRestore();
    }

    expect(farmRows().map((r) => r.getAttribute('data-goal-id'))).toEqual(['calm', 'hot']);
    const after = ownButton('Aya, Hot, Have — change your status');
    expect(after).toBe(own);
    expect(after.closest('tr')).toBe(farmRows()[1]);
    expect(gridStops()).toEqual([after]);
    expect(after).toHaveFocus();
  });

  it('moves focus to the fallback stop when the focused row is gone, where React cannot restore it', () => {
    const { rerender } = renderMatrix({ goals: two, participants: mixed, reader: MEMBER, edit: EDIT });
    const own = ownButton('Aya, Calm, Want — change your status');
    focusCell(own);
    expect(own).toHaveFocus();

    rerender({ goals: [two[0]], participants: mixed, reader: MEMBER, edit: EDIT });

    // The fallback stop is the first row's name button (S2a-3a), and it takes the focus.
    const first = nameButton(farmRows()[0]);
    expect(gridStops()).toEqual([first]);
    expect(first).toHaveFocus();
  });

  it('forgets a tooltip wish the cell could not show, so a later provenance does not open it unprompted (review M-a)', async () => {
    // A blank own cell has no provenance: Radix still asks to open on focus, and, with the
    // controlled value already false, never asks to close.
    const { rerender } = renderMatrix({ participants: {}, reader: MEMBER, edit: EDIT });
    const own = ownButton('Aya, Wings of Resolve, no status — set your status');
    focusCell(own);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => own.blur());

    rerender({
      participants: { wings: [row('wings', 'u1', { state: 'need', updatedByUserId: 'u1', updatedVia: 'web' })] },
      reader: MEMBER,
      edit: EDIT,
    });
    await act(async () => {});
    expect(screen.queryByRole('tooltip')).toBeNull();

    // A fresh focus still opens it.
    focusCell(ownButton('Aya, Wings of Resolve, Need — change your status'));
    expect((await screen.findAllByText('you')).length).toBeGreaterThan(0);
  });

  it('puts the provenance tooltip to sleep while the picker is open, and wakes it after (review M3)', async () => {
    renderMatrix({
      participants: { wings: [row('wings', 'u1', { state: 'need', updatedByUserId: 'u1', updatedVia: 'web' })] },
      reader: MEMBER,
      edit: EDIT,
    });
    const own = ownButton('Aya, Wings of Resolve, Need — change your status');
    focusCell(own);
    expect((await screen.findAllByText('you')).length).toBeGreaterThan(0);

    fireEvent.click(own);
    expect(screen.getByRole('group', { name: 'Status' })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).toBeNull();
    // Focus moving inside the popover bubbles through the Popover root to the cell, and the
    // pointer can cross the cell itself: neither wakes the tooltip while the picker is open.
    focusCell(within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name: '★ Want' }));
    fireEvent.pointerMove(own.closest('td')!);
    await act(async () => {});
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(own).toHaveFocus());
    expect((await screen.findAllByText('you')).length).toBeGreaterThan(0);
  });

  it('never flips the tooltip between controlled and uncontrolled as the picker opens and closes (browser B)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      renderMatrix({
        participants: { wings: [row('wings', 'u1', { state: 'need', updatedByUserId: 'u1', updatedVia: 'web' })] },
        reader: MEMBER,
        edit: EDIT,
      });
      const own = ownButton('Aya, Wings of Resolve, Need — change your status');
      focusCell(own);
      await screen.findAllByText('you');
      fireEvent.click(own);
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      await waitFor(() => expect(own).toHaveFocus());
      await screen.findAllByText('you');

      const flips = [...warn.mock.calls, ...error.mock.calls].filter((c) => c.some((a) => typeof a === 'string' && /controlled/.test(a)));
      expect(flips).toEqual([]);
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it('lets no key typed in the open picker\'s count field move the grid or its stop (the portal leak)', () => {
    renderMatrix({ goals: two, participants: mixed, reader: MEMBER, edit: EDIT });
    const own = ownButton('Aya, Hot, Need, 62 of 99 Tokens — change your status');
    focusCell(own);
    fireEvent.click(own);
    const input = screen.getByLabelText('Tokens');
    act(() => input.focus());

    expect(fireEvent.keyDown(input, { key: 'ArrowDown' })).toBe(true);
    expect(input).toHaveFocus();
    expect(fireEvent.keyDown(input, { key: 'Home' })).toBe(true);
    expect(input).toHaveFocus();
    expect(gridStops()).toEqual([own]);
    // Focus inside the popover did not make another cell the stop either.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(gridStops()).toEqual([own]);
  });
});
