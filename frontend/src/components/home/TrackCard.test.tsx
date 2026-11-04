/**
 * TrackCard (S2a-4b·B1 Task TB1; R-F-10, D-11, D-12, E-9): Home's farm card, on real stores seeded
 * directly. The card sends nothing itself (Home fetches), so "hidden" is tested from a card that
 * was showing: each hide case proves the card was there first. What Home's fetches do to it is
 * `Home.trackCard.test.tsx`.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { goal, row } from '../progress/__fixtures__/progressFixtures';
import { rosterSortPresetKey } from '../roster/useRosterSortPreset';
import { useAuthStore } from '../../stores/authStore';
import { useCollectionGoalStore, type CollectionGoal, type ParticipantStateEntry } from '../../stores/collectionGoalStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useViewAsStore, type ViewAsUserInfo } from '../../stores/viewAsStore';
import type { SnapshotPlayer, SortPreset, StaticGroup, TierSnapshot } from '../../types';
import { buildColumns, splitFarmRows } from '../../utils/progressModel';
import { queueFor } from '../../utils/progressQueue';
import { TrackCard } from './TrackCard';

const TIER_ID = 'aac-cruiserweight';

const player = (id: string, name: string, position: string, role: string, userId: string | null) =>
  ({ id, name, job: 'PLD', role, position, configured: true, isSubstitute: false, sortOrder: 0, userId, gear: [] }) as unknown as SnapshotPlayer;

const tier = {
  id: 't1',
  tierId: TIER_ID,
  players: [
    player('p1', 'Aya', 'T1', 'tank', 'u1'),
    player('p2', 'Bo', 'H1', 'healer', 'u2'),
    player('p3', 'Cy', 'M1', 'melee', 'u3'),
    player('p4', 'Dee', 'R1', 'caster', 'u4'),
    player('p5', 'Eli', 'M2', 'melee', null),
    player('p6', 'Fay', 'H2', 'healer', 'u6'),
    player('p7', 'Gus', 'R2', 'ranged', 'u7'),
  ],
} as unknown as TierSnapshot;

const groupWith = (userRole: string | null) => ({ id: 'g1', name: 'Dev Test Static', shareCode: 'DEVTST', settings: {}, userRole, members: [] }) as unknown as StaticGroup;

const TOP = goal('top', { title: 'Zed Wings' });
const SECOND = goal('second', { title: 'Alpha Whistle' });
const TOP_CELLS: ParticipantStateEntry[] = [
  row('top', 'u1', { tokenCount: 40 }),
  row('top', 'u2', { state: 'want', tokenCount: 10 }),
  row('top', 'u3', { tokenCount: 40 }),
  row('top', 'u4', { state: 'have' }),
  row('top', 'u6', { state: 'pass' }),
];
const FARMS = { goals: [SECOND, TOP], cells: { second: [row('second', 'u1')], top: TOP_CELLS } };

const fetchGoals = vi.fn();
const fetchProgress = vi.fn();

function seed(goals: CollectionGoal[] = FARMS.goals, participants: Record<string, ParticipantStateEntry[]> = FARMS.cells) {
  useCollectionGoalStore.setState({
    goals,
    participants,
    recordOnly: {},
    loadedGroupId: 'g1',
    isLoading: false,
    error: null,
    progressLoading: false,
    progressError: null,
    fetchGoals,
    fetchProgress,
  });
}

function seedRole(userRole: string | null) {
  const group = groupWith(userRole);
  useStaticGroupStore.setState({ currentGroup: group as never });
  return group;
}

function renderCard(userRole: string | null = 'member', tierProp: TierSnapshot | null = tier) {
  const group = seedRole(userRole);
  const onNavigate = vi.fn();
  const ui = (g: StaticGroup) => (
    <MemoryRouter>
      <TrackCard group={g} tier={tierProp} onNavigate={onNavigate} />
    </MemoryRouter>
  );
  const view = render(ui(group));
  return { onNavigate, container: view.container, rerenderAs: (g: StaticGroup) => view.rerender(ui(g)) };
}

const link = (title = 'Zed Wings') => screen.queryByRole('button', { name: title });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useViewAsStore.setState({ viewAsUser: null });
  useAuthStore.setState({ user: { id: 'u1', isAdmin: false } as never });
  seed();
});

describe('the card', () => {
  it('is titled "Farm" and names the farm Progress lists first, with its type', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Farm' })).toBeInTheDocument();
    expect(link()).toBeInTheDocument();
    expect(link('Alpha Whistle')).toBeNull();
    expect(screen.getByText(/·\s*Mount/)).toBeInTheDocument();
  });

  it('shows the tally, leaving out Pass and unclaimed columns', () => {
    renderCard();
    expect(screen.getByText('1 of 5 have it')).toBeInTheDocument();
  });

  it('shows the pips, named by state, in the standard order', () => {
    renderCard();
    expect(screen.getByRole('img', { name: 'Need: Aya, Cy; Want: Bo; Have: Dee; No status: Gus' })).toBeInTheDocument();
    expect(screen.getAllByTestId('farm-pip')).toHaveLength(5);
  });

  it('shows the next line', () => {
    renderCard();
    expect(screen.getByText('Aya is next (40/99)')).toBeInTheDocument();
  });

  it('opens that farm in Progress from the title, the one target on the card', () => {
    const { onNavigate, container } = renderCard();
    expect(within(container).getAllByRole('button')).toHaveLength(1);
    expect(within(container).queryByRole('link')).toBeNull();
    fireEvent.click(link()!);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('goals', { track: 'top' });
  });

  it('keeps a title with quotes, a backslash and a dollar as it is', () => {
    const title = `Ifrit's "Wings" \\u0041 $& 100%…`;
    seed([goal('top', { title })], { top: TOP_CELLS });
    renderCard();
    expect(link(title)).toBeInTheDocument();
  });

  it('still shows the farms with no tier picked: they are the static\'s, not the tier\'s', () => {
    // No roster means no claimed column, so no farm has a Need and Progress falls back to the title.
    renderCard('member', null);
    expect(link('Alpha Whistle')).toBeInTheDocument();
  });

  it('ignores another static\'s goal in the store, however needy', () => {
    const foreign = goal('foreign', { title: 'Foreign Farm', staticGroupId: 'g2' });
    const foreignCells = ['u1', 'u2', 'u3', 'u4', 'u6', 'u7'].map((u) => row('foreign', u));
    seed([...FARMS.goals, foreign], { ...FARMS.cells, foreign: foreignCells });
    renderCard();
    expect(link()).toBeInTheDocument();
    expect(link('Foreign Farm')).toBeNull();
  });
});

describe.each<[SortPreset, string, string]>([
  ['standard', 'Aya is next (40/99)', 'Need: Aya, Cy; Want: Bo; Have: Dee; No status: Gus'],
  ['dps-first', 'Cy is next (40/99)', 'Need: Cy, Aya; Want: Bo; Have: Dee; No status: Gus'],
])('agreement with Progress under %s', (preset, nextLine, pipsName) => {
  beforeEach(() => localStorage.setItem(rosterSortPresetKey(TIER_ID), preset));

  it('takes the preset as Progress takes it, for the tie in the queue and the pip order', async () => {
    renderCard();
    expect(await screen.findByText(nextLine)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: pipsName })).toBeInTheDocument();
  });

  it('says what the real splitFarmRows and queueFor say', async () => {
    const data = { goals: FARMS.goals, participants: FARMS.cells, recordOnly: {} };
    const reader = { currentUserId: 'u1', userRole: 'member' as const };
    const first = splitFarmRows(data, buildColumns(tier.players ?? [], preset, data), reader).active[0];
    const top = queueFor(first, first.goal.priorityMode)[0];
    renderCard();
    expect(link(first.goal.title)).toBeInTheDocument();
    expect(await screen.findByText(`${top.cell.column.name} is next (${top.count}/99)`)).toBeInTheDocument();
  });
});

describe('the next line, by case', () => {
  it('still reads "is next" for a Want at the top', () => {
    seed([TOP], { top: [row('top', 'u2', { state: 'want', tokenCount: 30 })] });
    renderCard();
    expect(screen.getByText('Bo is next (30/99)')).toBeInTheDocument();
  });

  it('has no line under free_roll, and keeps the tally and pips', () => {
    seed([{ ...TOP, priorityMode: 'free_roll' }], { top: TOP_CELLS });
    const { container } = renderCard();
    expect(link()).toBeInTheDocument();
    expect(screen.getByText('1 of 5 have it')).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(container.textContent).not.toContain('is next');
  });

  it('has no bracket when the count is hidden', () => {
    seed([TOP], { top: [row('top', 'u1', { tokenCount: 62, countHidden: true })] });
    const { container } = renderCard();
    expect(screen.getByText('Aya is next')).toBeInTheDocument();
    expect(container.textContent).not.toContain('62');
  });

  it('reads "(62)" with no token cost', () => {
    seed([{ ...TOP, tokenCost: null }], { top: [row('top', 'u1', { tokenCount: 62 })] });
    renderCard();
    expect(screen.getByText('Aya is next (62)')).toBeInTheDocument();
  });

  it('shows a count of zero', () => {
    seed([TOP], { top: [row('top', 'u1', { tokenCount: 0 })] });
    renderCard();
    expect(screen.getByText('Aya is next (0/99)')).toBeInTheDocument();
  });

  it('has no line when the queue is empty', () => {
    seed([TOP], { top: [row('top', 'u1', { state: 'have' })] });
    const { container } = renderCard();
    expect(screen.getByText('1 of 6 have it')).toBeInTheDocument();
    expect(container.textContent).not.toContain('is next');
  });
});

describe('a viewer', () => {
  it('sees the tally and the pips, and no next line or count', () => {
    const { container } = renderCard('viewer');
    expect(screen.getByText('1 of 5 have it')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Need: Aya, Cy; Want: Bo; Have: Dee; No status: Gus' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('is next');
    expect(container.textContent).not.toMatch(/\d\/99/);
  });

  it('is the viewed role under View As: an owner viewing as a viewer gets no next line', () => {
    useViewAsStore.setState({ viewAsUser: { userId: 'u2', role: 'viewer' } as ViewAsUserInfo });
    const { container } = renderCard('owner');
    expect(link()).toBeInTheDocument();
    expect(container.textContent).not.toContain('is next');
  });
});

describe('when it hides', () => {
  it.each<[string, () => void]>([
    ['the goals held belong to another static', () => useCollectionGoalStore.setState({ loadedGroupId: 'g2' })],
    ['progress is loading', () => useCollectionGoalStore.setState({ progressLoading: true })],
    ['the progress fetch failed', () => useCollectionGoalStore.setState({ progressError: 'boom' })],
    ['the goals fetch failed', () => useCollectionGoalStore.setState({ error: 'boom' })],
    ['the goals have landed and their cells have not', () => useCollectionGoalStore.setState({ participants: {} })],
    ['every farm is finished', () => seed([{ ...TOP, status: 'complete' }], FARMS.cells)],
    ['there are no goals', () => seed([], {})],
  ])('hides a showing card when %s', (_case, change) => {
    const { container } = renderCard();
    expect(link()).toBeInTheDocument();
    act(change);
    expect(link()).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('shows again once the fetch that was running has landed', () => {
    renderCard();
    act(() => useCollectionGoalStore.setState({ progressLoading: true }));
    expect(link()).toBeNull();
    act(() => useCollectionGoalStore.setState({ progressLoading: false }));
    expect(link()).toBeInTheDocument();
  });

  it('shows for a farm nobody has a row on yet, once its cells have loaded', () => {
    seed([TOP], { top: [] });
    renderCard();
    expect(link()).toBeInTheDocument();
    expect(screen.getByText('0 of 6 have it')).toBeInTheDocument();
  });

  it('hides for a guest', () => {
    const { rerenderAs, container } = renderCard();
    expect(link()).toBeInTheDocument();
    rerenderAs(seedRole(null));
    expect(container.firstChild).toBeNull();
  });
});
