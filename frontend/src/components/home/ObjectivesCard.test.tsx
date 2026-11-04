/**
 * ObjectivesCard (S2a-5a·C2a Task C2-1; R-M-4, O-3, O-5, C-3, C-4), on real stores seeded directly.
 * The card sends nothing (Home fetches), so "hidden" is tested from a card that was showing: each
 * hide case proves the card was there first. What Home's fetches do to it is
 * `Home.objectives.test.tsx`.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../stores/authStore';
import { useObjectiveGoalStore, type StaticObjectiveGoal } from '../../stores/objectiveGoalStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useViewAsStore, type ViewAsUserInfo } from '../../stores/viewAsStore';
import type { StaticGroup } from '../../types';
import { ObjectivesCard } from './ObjectivesCard';

function objective(id: string, overrides: Partial<StaticObjectiveGoal> = {}): StaticObjectiveGoal {
  return {
    id,
    staticGroupId: 'g1',
    createdById: null,
    category: 'savage_bis',
    title: `Title ${id}`,
    description: null,
    priority: 'required',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

const groupWith = (userRole: string | null, extra: Record<string, unknown> = {}) =>
  ({ id: 'g1', name: 'Dev Test Static', shareCode: 'DEVTST', settings: {}, userRole, members: [], ...extra }) as unknown as StaticGroup;

const fetchObjectives = vi.fn();
const LIST = [
  objective('a', { title: 'Clear FRU', category: 'ultimate_clear', description: 'By week eight' }),
  objective('b', { title: 'Farm the mount', category: 'mount_farm', priority: 'optional' }),
];

function seed(objectives: StaticObjectiveGoal[] = LIST) {
  useObjectiveGoalStore.setState({ objectives, loading: false, objectivesError: null, fetchObjectives });
}

function seedGroup(group: StaticGroup | null) {
  useStaticGroupStore.setState({ currentGroup: group as never });
}

interface RenderOptions {
  group?: StaticGroup;
  canManage?: boolean;
  onEdit?: () => void;
  route?: string;
}

function renderCard({ group = groupWith('member'), canManage = false, onEdit, route = '/' }: RenderOptions = {}) {
  seedGroup(group);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ObjectivesCard group={group} canManage={canManage} onEdit={onEdit} />
    </MemoryRouter>,
  );
}

const heading = () => screen.queryByRole('heading', { name: 'Objectives' });
const editButton = () => screen.queryByRole('button', { name: 'Edit objectives' });

beforeEach(() => {
  vi.clearAllMocks();
  useViewAsStore.setState({ viewAsUser: null });
  useAuthStore.setState({ user: { id: 'u1', isAdmin: false } as never });
  seed();
});

describe('the card', () => {
  it('is a div titled "Objectives" with the Target icon', () => {
    const { container } = renderCard();
    expect(heading()).toBeInTheDocument();
    expect((container.firstChild as HTMLElement).tagName).toBe('DIV');
    expect(container.querySelector('svg.lucide-target')).not.toBeNull();
  });

  it('lists every objective in a <ul>, with its title, meta and description', () => {
    renderCard();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Clear FRU')).toBeInTheDocument();
    expect(within(items[0]).getByText('Ultimate — Clear · Required')).toBeInTheDocument();
    expect(within(items[0]).getByText('By week eight')).toBeInTheDocument();
    expect(within(items[1]).getByText('Farm the mount')).toBeInTheDocument();
    expect(within(items[1]).getByText('Mount Farm · Optional')).toBeInTheDocument();
  });

  it('shows no description line, and no "null", when a row has none', () => {
    renderCard();
    const item = within(screen.getByRole('list')).getAllByRole('listitem')[1];
    expect(item.textContent).toBe('Farm the mountMount Farm · Optional');
  });

  it('uses the ruled type: a primary title, secondary meta and description, nothing under 12px', () => {
    renderCard();
    expect(screen.getByText('Clear FRU')).toHaveClass('text-sm', 'font-medium', 'text-text-primary');
    expect(screen.getByText('Ultimate — Clear · Required')).toHaveClass('text-xs', 'text-text-secondary');
    expect(screen.getByText('By week eight')).toHaveClass('text-xs', 'text-text-secondary');
  });

  it('lists every active objective with no cap: eight rows show eight', () => {
    seed(Array.from({ length: 8 }, (_, i) => objective(`o${i}`, { title: `Objective ${i}`, description: `Why ${i}` })));
    renderCard();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(8);
    for (let i = 0; i < 8; i += 1) {
      expect(screen.getByText(`Objective ${i}`)).toBeInTheDocument();
      expect(screen.getByText(`Why ${i}`)).toBeInTheDocument();
    }
  });

  it('shows a long list in full', () => {
    seed(Array.from({ length: 120 }, (_, i) => objective(`o${i}`)));
    renderCard();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(120);
  });

  it('orders the rows Required, Preferred, Optional, unknown (C-1)', () => {
    seed([
      objective('u', { title: 'Unknown one', priority: 'someday' }),
      objective('o', { title: 'Optional one', priority: 'optional' }),
      objective('p', { title: 'Preferred one', priority: 'preferred' }),
      objective('r', { title: 'Required one' }),
    ]);
    renderCard();
    const titles = within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.textContent);
    expect(titles[0]).toContain('Required one');
    expect(titles[1]).toContain('Preferred one');
    expect(titles[2]).toContain('Optional one');
    expect(titles[3]).toContain('Unknown one');
  });

  it('hides a Not Doing row among active ones (O-3)', () => {
    seed([...LIST, objective('n', { title: 'Skipped thing', priority: 'not_doing' })]);
    renderCard();
    expect(screen.getByText('Clear FRU')).toBeInTheDocument();
    expect(screen.queryByText('Skipped thing')).toBeNull();
    expect(screen.queryByText(/not doing/i)).toBeNull();
  });

  it('shows only this static\'s rows when the store holds another\'s too', () => {
    seed([...LIST, objective('x', { title: 'Foreign objective', staticGroupId: 'g2' })]);
    renderCard();
    expect(screen.getByText('Clear FRU')).toBeInTheDocument();
    expect(screen.queryByText('Foreign objective')).toBeNull();
  });

  it('keeps quotes, a backslash, a dollar and markup as plain text', () => {
    const title = `Ifrit's "Wings" \\u0041 $& 100%…`;
    const description = '<b>not bold</b> 絶アレキ 🐉';
    seed([objective('a', { title, description })]);
    const { container } = renderCard();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
  });

  it('sends nothing itself: Home fetches', () => {
    renderCard();
    expect(heading()).toBeInTheDocument();
    expect(fetchObjectives).not.toHaveBeenCalled();
  });
});

describe('when it hides', () => {
  it.each<[string, () => void]>([
    ['there are no objectives', () => seed([])],
    ['every objective is Not Doing', () => seed(LIST.map((o) => ({ ...o, priority: 'not_doing' })))],
    ['every row belongs to another static', () => seed(LIST.map((o) => ({ ...o, staticGroupId: 'g2' })))],
    ['a refetch failed over the warm list', () => useObjectiveGoalStore.setState({ objectivesError: 'boom' })],
    ['the effective role is null', () => seedGroup(groupWith(null))],
    ['there is no current group, so no effective role', () => seedGroup(null)],
    ['a fetch is loading and nothing is held', () => useObjectiveGoalStore.setState({ objectives: [], loading: true })],
  ])('hides a showing card, heading included, when %s', (_case, change) => {
    const { container } = renderCard();
    expect(heading()).toBeInTheDocument();
    act(change);
    expect(heading()).toBeNull();
    expect(screen.queryByText('Clear FRU')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('says nothing about a failure: no line and no Retry (C-4)', () => {
    const { container } = renderCard();
    expect(heading()).toBeInTheDocument();
    act(() => useObjectiveGoalStore.setState({ objectivesError: 'boom' }));
    expect(container.textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('comes back when the next fetch clears the error', () => {
    renderCard();
    act(() => useObjectiveGoalStore.setState({ objectivesError: 'boom' }));
    expect(heading()).toBeNull();
    act(() => useObjectiveGoalStore.setState({ objectivesError: null }));
    expect(heading()).toBeInTheDocument();
    expect(screen.getByText('Clear FRU')).toBeInTheDocument();
  });

  it('keeps a warm list while a fetch runs, so it does not blink on return to Home', () => {
    renderCard();
    act(() => useObjectiveGoalStore.setState({ loading: true }));
    expect(heading()).toBeInTheDocument();
    expect(screen.getByText('Clear FRU')).toBeInTheDocument();
  });
});

describe('the effective role decides', () => {
  it('shows to a viewer, on the read path', () => {
    renderCard({ group: groupWith('viewer') });
    expect(screen.getByText('Clear FRU')).toBeInTheDocument();
  });

  it('shows to an admin in admin mode, whose elevated role stands', () => {
    renderCard({ group: groupWith('owner', { isAdminAccess: true }), route: '/?adminMode=true' });
    expect(heading()).toBeInTheDocument();
  });

  it('gives a masked admin no card, with group.userRole set and the effective role null', () => {
    const { container } = renderCard({ group: groupWith('owner', { isAdminAccess: true }) });
    expect(container.firstChild).toBeNull();
  });

  it('gives an admin viewing as a non-member no card, with group.userRole set', () => {
    useViewAsStore.setState({ viewAsUser: { userId: 'u2', role: null } as unknown as ViewAsUserInfo });
    const { container } = renderCard({ group: groupWith('owner') });
    expect(container.firstChild).toBeNull();
  });

  it('shows to an owner viewing as a viewer', () => {
    useViewAsStore.setState({ viewAsUser: { userId: 'u2', role: 'viewer' } as ViewAsUserInfo });
    renderCard({ group: groupWith('owner') });
    expect(heading()).toBeInTheDocument();
  });
});

describe('the Edit link', () => {
  it('shows with canManage and onEdit, as a button named "Edit objectives" reading "Edit"', () => {
    renderCard({ canManage: true, onEdit: vi.fn() });
    expect(editButton()).toBeInTheDocument();
    expect(editButton()).toHaveTextContent(/^Edit$/);
  });

  it('calls onEdit once per click', () => {
    const onEdit = vi.fn();
    renderCard({ canManage: true, onEdit });
    fireEvent.click(editButton()!);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('sits in the header, not among the rows, and is the card\'s one control (O-5)', () => {
    const { container } = renderCard({ canManage: true, onEdit: vi.fn() });
    expect(within(screen.getByRole('list')).queryByRole('button')).toBeNull();
    expect(within(container).getAllByRole('button')).toHaveLength(1);
    expect(within(container).queryByRole('link')).toBeNull();
  });

  it('is absent without canManage, and the rows still show', () => {
    renderCard({ canManage: false, onEdit: vi.fn() });
    expect(screen.getByText('Clear FRU')).toBeInTheDocument();
    expect(editButton()).toBeNull();
  });

  it('is absent without onEdit, and the rows still show', () => {
    renderCard({ canManage: true });
    expect(screen.getByText('Clear FRU')).toBeInTheDocument();
    expect(editButton()).toBeNull();
  });

  it('does not rescue a hidden card: a manager with nothing active gets no Edit', () => {
    seed([objective('n', { priority: 'not_doing' })]);
    const { container } = renderCard({ group: groupWith('owner'), canManage: true, onEdit: vi.fn() });
    expect(editButton()).toBeNull();
    expect(container.firstChild).toBeNull();
  });
});
