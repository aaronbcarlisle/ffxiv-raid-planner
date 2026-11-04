/**
 * SettingsPanel.suggestionsOnly (S2a-5a·C3 Task C3-1, R-M-8, C-6): V2's dock tab reads "Suggestions"
 * and holds nothing else. `tabLabels` and `goalsSuggestionsOnly` are host props; V1 passes neither,
 * so "Goals & Farms" and its four sections stay as they are.
 *
 * The panels and the Farms section are the real ones, on seeded stores: "can't mount" is proved by
 * their headings being absent and their fetches not firing. `V2SettingsHost` and `StaticSettingsHost`
 * are real too, and `SettingsPanel` is wrapped only to record the props that reach it.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SettingsPanel, type SettingsTab } from './SettingsPanel';
import { StaticSettingsHost } from './StaticSettingsHost';
import { V2SettingsHost } from '../../pages/V2SettingsHost';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useContentSuggestionStore } from '../../stores/contentSuggestionStore';
import { useObjectiveGoalStore } from '../../stores/objectiveGoalStore';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import type { StaticGroup, SnapshotPlayer } from '../../types';

const recorded = vi.hoisted(() => ({ panelProps: [] as Array<Record<string, unknown>> }));

vi.mock('./SettingsPanel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./SettingsPanel')>();
  const Real = actual.SettingsPanel;
  return {
    ...actual,
    SettingsPanel: (props: Parameters<typeof Real>[0]) => {
      recorded.panelProps.push(props as unknown as Record<string, unknown>);
      return <Real {...props} />;
    },
  };
});
vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: Object.assign(() => 0, { getState: () => ({ fetchGroupRequests: vi.fn() }) }),
}));
vi.mock('../../stores/authStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: (sel?: any) => {
    const s = { user: { id: 'u', tabPersistence: 'remember' }, updatePreferences: vi.fn() };
    return sel ? sel(s) : s;
  },
}));
vi.mock('../../pages/groupActionsContext', () => ({ useGroupAddToRoster: () => vi.fn() }));
vi.mock('../../hooks/useSortedMainRosterPlayers', () => ({ useSortedMainRosterPlayers: () => [] }));

const fetchSuggestions = vi.fn(async () => {});
const fetchObjectives = vi.fn(async () => {});
const fetchGoals = vi.fn(async () => {});

/** Every `search` the router has held; one entry means nothing wrote the URL. */
let searches: string[] = [];

function UrlProbe() {
  const { search } = useLocation();
  if (searches[searches.length - 1] !== search) searches.push(search);
  return null;
}

const ROLES = ['owner', 'lead', 'member', 'viewer'] as const;
type TabRole = (typeof ROLES)[number];
const MANAGERS: readonly TabRole[] = ['owner', 'lead'];
const SUGGESTIONS_LABEL: Partial<Record<SettingsTab, string>> = { goals: 'Suggestions' };
const FOUR_SECTIONS = ['Overview', 'Objectives', 'Farms', 'Suggestions'];
const MANAGER_COPY = /Promote a suggestion to make it an official static goal/;
const MEMBER_COPY = /Leads can promote popular suggestions/;

function group(role: StaticGroup['userRole']): StaticGroup {
  return { id: 'g1', name: 'S', shareCode: 'c', userRole: role, settings: {} } as StaticGroup;
}
const players: SnapshotPlayer[] = [];

interface PanelOptions {
  role?: StaticGroup['userRole'];
  url?: string;
  hiddenTabs?: SettingsTab[];
  isAdmin?: boolean;
  tabLabels?: Partial<Record<SettingsTab, string>>;
  goalsSuggestionsOnly?: boolean;
}

function renderPanel({ role = 'owner', url = '/', ...props }: PanelOptions = {}) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <UrlProbe />
      <SettingsPanel
        isOpen
        container="dock"
        onClose={vi.fn()}
        group={group(role)}
        players={players}
        {...props}
      />
    </MemoryRouter>
  );
}

const renderSuggestionsOnly = (options: PanelOptions = {}) =>
  renderPanel({ tabLabels: SUGGESTIONS_LABEL, goalsSuggestionsOnly: true, ...options });

const tabButton = (name: string) => screen.queryByRole('button', { name });
const suggestionsHeading = () => screen.queryByRole('heading', { name: 'Content Suggestions' });

function expectSuggestionsAlone() {
  expect(suggestionsHeading()).toBeInTheDocument();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.queryAllByRole('tab')).toHaveLength(0);
  // Overview's cards, ObjectiveGoalsPanel, the Farms section.
  expect(screen.queryByText('Open Suggestions')).not.toBeInTheDocument();
  expect(screen.queryByText('Active Farms')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Static Objectives' })).not.toBeInTheDocument();
  expect(screen.queryByText('Collection Goals')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add Farm' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'New Farm' })).not.toBeInTheDocument();
  expect(fetchObjectives).not.toHaveBeenCalled();
  expect(fetchGoals).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
  );
  searches = [];
  recorded.panelProps.length = 0;
  fetchSuggestions.mockClear();
  fetchObjectives.mockClear();
  fetchGoals.mockClear();
  useSettingsPanelStore.setState({ tab: 'goals', isOpen: true } as never);
  useContentSuggestionStore.setState({ suggestions: [], loading: false, error: null, fetchSuggestions } as never);
  useObjectiveGoalStore.setState({ objectives: [], loading: false, objectivesError: null, fetchObjectives } as never);
  useCollectionGoalStore.setState({
    goals: [{ id: 'goal-1', title: 'Alpha Mount', status: 'wanted', currentCount: null, targetCount: null }],
    isLoading: false,
    fetchGoals,
  } as never);
});

describe.each(ROLES)('with the props, as %s', (role) => {
  it('the tab reads "Suggestions" and "Goals & Farms" is absent', () => {
    renderSuggestionsOnly({ role });
    expect(tabButton('Suggestions')).toBeInTheDocument();
    expect(tabButton('Goals & Farms')).not.toBeInTheDocument();
    expect(screen.queryByText('Goals & Farms')).not.toBeInTheDocument();
    // One "Suggestions" on screen: the tab, with no sub-nav item beside it.
    expect(screen.getAllByText('Suggestions')).toHaveLength(1);
  });

  it('shows ContentSuggestionsPanel with no sub-nav, fetching for this static', () => {
    renderSuggestionsOnly({ role });
    expectSuggestionsAlone();
    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    expect(fetchSuggestions).toHaveBeenCalledWith('g1');
  });

  it('hands the panel the role\'s canManage', () => {
    renderSuggestionsOnly({ role });
    expect(screen.getByText(MANAGERS.includes(role) ? MANAGER_COPY : MEMBER_COPY)).toBeInTheDocument();
  });

  it.each(['overview', 'objectives', 'farms'])('a stale ?gsub=%s is ignored and left in the URL', (gsub) => {
    renderSuggestionsOnly({ role, url: `/?gsub=${gsub}` });
    expectSuggestionsAlone();
    expect(searches).toEqual([`?gsub=${gsub}`]);
  });
});

describe('with the props', () => {
  it.each(['suggestions', 'bogus', '', '%22%3E%3Cb%3E', 'farms%20', 'FARMS'])('?gsub=%s changes nothing', (gsub) => {
    renderSuggestionsOnly({ url: `/?gsub=${gsub}` });
    expectSuggestionsAlone();
    expect(searches).toEqual([`?gsub=${gsub}`]);
  });

  it('no ?gsub= is written: the URL stays bare', () => {
    renderSuggestionsOnly();
    expectSuggestionsAlone();
    expect(searches).toEqual(['']);
  });

  it('other params in the URL are untouched', () => {
    renderSuggestionsOnly({ url: '/?tab=overview&gsub=farms&tier=t1&viewAs=u2' });
    expect(suggestionsHeading()).toBeInTheDocument();
    expect(searches).toEqual(['?tab=overview&gsub=farms&tier=t1&viewAs=u2']);
  });

  it('an admin on a member row gets the manager\'s panel', () => {
    renderSuggestionsOnly({ role: 'member', isAdmin: true });
    expect(screen.getByText(MANAGER_COPY)).toBeInTheDocument();
  });

  it('wraps the panel in the Suggestions section\'s scroll container', () => {
    renderSuggestionsOnly();
    const scroller = suggestionsHeading()!.closest('.overflow-y-auto') as HTMLElement | null;
    expect(scroller).not.toBeNull();
    expect(scroller).toHaveClass('flex-1', 'min-h-0');
    expect(scroller!.style.scrollbarGutter).toBe('stable');
  });

  it('leaving the tab and coming back keeps it alone, with a stale ?gsub=farms', () => {
    renderSuggestionsOnly({ url: '/?gsub=farms' });
    fireEvent.click(screen.getByRole('button', { name: 'General' }));
    expect(suggestionsHeading()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suggestions' }));
    expectSuggestionsAlone();
    expect(searches).toEqual(['?gsub=farms']);
  });

  it('a stored tab other than goals opens as itself, and Suggestions is one click away', () => {
    useSettingsPanelStore.setState({ tab: 'general' } as never);
    renderSuggestionsOnly({ url: '/?gsub=farms' });
    expect(suggestionsHeading()).not.toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suggestions' }));
    expectSuggestionsAlone();
  });
});

describe('the props alongside hiddenTabs', () => {
  it('hiddenTabs=[recruitment]: Recruitment is gone, Suggestions is there, the other tabs keep their labels', () => {
    renderSuggestionsOnly({ hiddenTabs: ['recruitment'] });
    expect(tabButton('Recruitment')).not.toBeInTheDocument();
    expect(tabButton('Suggestions')).toBeInTheDocument();
    for (const label of ['General', 'Static', 'Priority', 'Integrations', 'Members']) {
      expect(tabButton(label)).toBeInTheDocument();
    }
    expectSuggestionsAlone();
  });

  it('hiddenTabs=[goals] wins over the label, and a stored goals tab falls back to General', () => {
    renderSuggestionsOnly({ hiddenTabs: ['goals'], url: '/?gsub=farms' });
    expect(tabButton('Suggestions')).not.toBeInTheDocument();
    expect(tabButton('Goals & Farms')).not.toBeInTheDocument();
    expect(suggestionsHeading()).not.toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(fetchSuggestions).not.toHaveBeenCalled();
  });
});

describe('each prop does its own job', () => {
  it('tabLabels alone renames the tab and leaves the four sections', () => {
    renderPanel({ tabLabels: SUGGESTIONS_LABEL });
    expect(tabButton('Suggestions')).toBeInTheDocument();
    expect(tabButton('Goals & Farms')).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(FOUR_SECTIONS);
  });

  it('tabLabels renames only the tab it names, literally', () => {
    const label = 'Sug & "gest" $1 \\u2026 … 提案';
    renderPanel({ tabLabels: { members: label } });
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    expect(tabButton('Members')).not.toBeInTheDocument();
    expect(tabButton('Goals & Farms')).toBeInTheDocument();
    expect(tabButton('General')).toBeInTheDocument();
  });

  it('goalsSuggestionsOnly alone keeps the label and drops the sections', () => {
    renderPanel({ goalsSuggestionsOnly: true, url: '/?gsub=farms' });
    expect(tabButton('Goals & Farms')).toBeInTheDocument();
    expectSuggestionsAlone();
  });
});

// Regression proof: V1 passes neither prop, so these hold before and after C3.
describe.each(ROLES)('without the props, as %s (V1)', (role) => {
  it('the tab reads "Goals & Farms", with all four sections and no "Suggestions" tab button', () => {
    renderPanel({ role });
    expect(tabButton('Goals & Farms')).toBeInTheDocument();
    expect(tabButton('Suggestions')).not.toBeInTheDocument();
    expect(within(screen.getByRole('tablist')).getAllByRole('tab').map((t) => t.textContent)).toEqual(FOUR_SECTIONS);
  });

  it('opens on Overview, and each section shows its own body and writes ?gsub=', () => {
    renderPanel({ role });
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Open Suggestions')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Objectives' }));
    expect(screen.getByRole('heading', { name: 'Static Objectives' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Farms' }));
    expect(screen.getByText('Collection Goals')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Add Farm' })).toHaveLength(MANAGERS.includes(role) ? 1 : 0);

    fireEvent.click(screen.getByRole('tab', { name: 'Suggestions' }));
    expect(suggestionsHeading()).toBeInTheDocument();

    expect(searches).toEqual(['', '?gsub=objectives', '?gsub=farms', '?gsub=suggestions']);
  });

  it.each([
    ['objectives', 'Static Objectives'],
    ['suggestions', 'Content Suggestions'],
  ])('?gsub=%s still deep-links to its section', (gsub, heading) => {
    renderPanel({ role, url: `/?gsub=${gsub}` });
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('?gsub=farms still deep-links to Farms', () => {
    renderPanel({ role, url: '/?gsub=farms' });
    expect(screen.getByRole('tab', { name: 'Farms' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Collection Goals')).toBeInTheDocument();
  });
});

describe('the hosts', () => {
  const renderV2Host = (url = '/') => {
    const tree = () => (
      <MemoryRouter initialEntries={[url]}>
        <UrlProbe />
        <V2SettingsHost />
      </MemoryRouter>
    );
    const view = render(tree());
    return { ...view, renderAgain: () => view.rerender(tree()) };
  };

  beforeEach(() => {
    useStaticGroupStore.setState({ currentGroup: group('owner') } as never);
  });

  it('V2SettingsHost passes both props through StaticSettingsHost, and hiddenTabs still', () => {
    renderV2Host();
    const props = recorded.panelProps[recorded.panelProps.length - 1];
    expect(props.tabLabels).toEqual({ goals: 'Suggestions' });
    expect(props.goalsSuggestionsOnly).toBe(true);
    expect(props.hiddenTabs).toEqual(['recruitment']);
    expect(tabButton('Suggestions')).toBeInTheDocument();
    expectSuggestionsAlone();
  });

  it('V2SettingsHost passes the same tabLabels object across renders (module scope, as RECRUITMENT_HIDDEN)', () => {
    const { renderAgain } = renderV2Host();
    const count = recorded.panelProps.length;
    renderAgain();
    act(() => useStaticGroupStore.setState({ currentGroup: group('member') } as never));
    expect(recorded.panelProps.length).toBeGreaterThan(count);
    expect(recorded.panelProps[0].tabLabels).toBeDefined();
    for (const props of recorded.panelProps) {
      expect(props.tabLabels).toBe(recorded.panelProps[0].tabLabels);
      expect(props.goalsSuggestionsOnly).toBe(true);
    }
  });

  it('review focus 5: the dock on ?gsub=farms shows Suggestions, and the param survives a close and a reopen', () => {
    renderV2Host('/?tab=overview&gsub=farms');
    expectSuggestionsAlone();

    act(() => useSettingsPanelStore.getState().close());
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
    expect(searches).toEqual(['?tab=overview&gsub=farms']);

    act(() => useSettingsPanelStore.getState().open());
    expectSuggestionsAlone();
    expect(searches).toEqual(['?tab=overview&gsub=farms']);
  });

  // Regression proof: nothing changes for V1's host.
  it('StaticSettingsHost with no props gives the panel neither, so V1 keeps Goals & Farms on ?gsub=farms', () => {
    render(
      <MemoryRouter initialEntries={['/?gsub=farms']}>
        <StaticSettingsHost group={group('owner')} players={players} />
      </MemoryRouter>
    );
    const props = recorded.panelProps[recorded.panelProps.length - 1];
    expect(props.tabLabels).toBeUndefined();
    expect(props.goalsSuggestionsOnly).toBeUndefined();
    expect(tabButton('Goals & Farms')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Farms' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Collection Goals')).toBeInTheDocument();
  });
});
