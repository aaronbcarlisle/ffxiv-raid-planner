/**
 * ProgressMatrix (S2a-2·F3 Task TF5): the matrix over the TF4 model, with FarmRow,
 * ProgressCell and FinishedFarms. Props-driven: the model builds the columns and rows
 * from fixtures, so these tests read exactly what the page would render.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CollectionGoal } from '../../stores/collectionGoalStore';
import type { SnapshotPlayer } from '../../types';
import {
  buildColumns,
  splitFarmRows,
  type ProgressData,
  type ProgressReader,
} from '../../utils/progressModel';
import { goal, row } from './__fixtures__/progressFixtures';
import { ProgressMatrix } from './ProgressMatrix';

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
  players?: SnapshotPlayer[];
  canManage?: boolean;
  finishedLoading?: boolean;
  finishedError?: string | null;
  onExpandFinished?: () => void;
}

function renderMatrix(o: RenderOptions = {}) {
  const goals = o.goals ?? [goal('wings', { title: 'Wings of Resolve' })];
  const data: ProgressData = { goals, participants: o.participants ?? {}, recordOnly: {} };
  const activeData = { ...data, goals: goals.filter((g) => g.status !== 'complete') };
  const columns = buildColumns(o.players ?? PLAYERS, 'standard', activeData);
  const { active, finished } = splitFarmRows(data, columns, o.reader ?? LEAD);
  const onExpandFinished = o.onExpandFinished ?? vi.fn();
  render(
    <ProgressMatrix
      columns={columns}
      active={active}
      finished={finished}
      canManage={o.canManage ?? true}
      finishedLoading={o.finishedLoading ?? false}
      finishedError={o.finishedError ?? null}
      onExpandFinished={onExpandFinished}
    />,
  );
  return { columns, onExpandFinished };
}

const farmRows = () => screen.getAllByTestId('progress-farm-row');
const statusOf = (r: HTMLElement) => within(r).getByTestId('progress-status').textContent;

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
    // Farm, Status, four players, then the two off-roster members.
    expect(headers).toHaveLength(2 + columns.length);
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
    expect(within(wings).getByText('Wings of Resolve · Mount')).toBeInTheDocument();
    expect(within(wings).getByText('Scheduled')).toBeInTheDocument();
    expect(wings.querySelector('svg')).not.toBeNull();
    expect(within(later).getByText('Later Farm · Custom')).toBeInTheDocument();
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
    expect(within(r).getByRole('cell', { name: 'Aya, Wings of Resolve, Need, 62 of 99 Tokens' })).toBeInTheDocument();
    expect(within(r).getByRole('cell', { name: 'Cy, Wings of Resolve, unclaimed' })).toHaveTextContent('');
  });

  it('leaves a claimed column with no status blank', () => {
    renderMatrix({ participants: { wings: [row('wings', 'u1', { state: 'pass' })] } });
    const cell = within(farmRows()[0]).getByRole('cell', { name: 'Bo, Wings of Resolve, no status' });
    expect(cell).toHaveTextContent('');
    expect(within(farmRows()[0]).getByText('– Pass')).toBeInTheDocument();
  });

  it('gives no cell a control: the matrix is read-only', () => {
    renderMatrix({ participants: { wings: [row('wings', 'u1')] } });
    for (const cell of screen.getAllByTestId('progress-cell')) {
      expect(within(cell).queryByRole('button')).not.toBeInTheDocument();
      expect(cell).not.toHaveAttribute('tabindex');
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
    expect(within(r).getByRole('cell', { name: 'Bo, Wings of Resolve, Need' })).toBeInTheDocument();
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
    expect(within(finishedRow).getByRole('cell', { name: 'Aya, new, Have' })).toBeInTheDocument();
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
