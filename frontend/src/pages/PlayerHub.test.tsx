/**
 * PlayerHub — tab resolution/URL behavior, keyboard shortcuts, the tab bodies
 * (mocked; the props they receive are asserted) and the page layout.
 */
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { PlayerHub } from './PlayerHub';
import type { PlayerProfile } from '../stores/playerProfileStore';
import type { StaticGroupListItem } from '../types';

type Props = Record<string, unknown>;

const { bodies, syncSeenAt, authState, hubCallbacks } = vi.hoisted(() => ({
  bodies: {} as Record<string, Props>,
  syncSeenAt: [] as string[],
  authState: { user: { id: 'u1', discordUsername: 'disc-user' } as Record<string, unknown> },
  hubCallbacks: {
    wizardOnComplete: null as ((groupId: string, shareCode: string) => void) | null,
    hubOnCreateStatic: null as (() => void) | null,
  },
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (s: typeof authState) => unknown) => selector(authState),
    { getState: () => authState },
  ),
}));

vi.mock('../components/profile/SyncCenterTab', async () => {
  const { useLocation: useLoc } = await import('react-router-dom');
  return {
    SyncCenterTab: (p: Props) => {
      bodies.sync = p;
      syncSeenAt.push(useLoc().search);
      return <div data-testid="body-sync" />;
    },
  };
});
vi.mock('../components/profile/JobsGearTab', () => ({
  JobsGearTab: (p: Props) => { bodies.jobs = p; return <div data-testid="body-jobs" />; },
}));
vi.mock('../components/profile/GoalsTab', () => ({
  GoalsTab: (p: Props) => { bodies.goals = p; return <div data-testid="body-goals" />; },
}));
vi.mock('../components/profile/CollectionsCenterTab', () => ({
  CollectionsCenterTab: (p: Props) => { bodies.collections = p; return <div data-testid="body-collections" />; },
}));
vi.mock('../components/profile/PlayerAvailabilityTab', () => ({
  PlayerAvailabilityTab: (p: Props) => { bodies.availability = p; return <div data-testid="body-availability" />; },
}));
vi.mock('../components/profile/PreviewShareTab', () => ({
  PreviewShareTab: (p: Props) => { bodies.sharing = p; return <div data-testid="body-sharing" />; },
}));
vi.mock('../components/profile/hub/HubOverview', () => ({
  HubOverview: ({ onCreateStatic }: { onCreateStatic?: () => void }) => {
    hubCallbacks.hubOnCreateStatic = onCreateStatic ?? null;
    return <div data-testid="hub-overview"><div data-testid="hub-overview-content" /></div>;
  },
}));
vi.mock('../components/profile/hub/SuggestedFarmsCard', () => ({
  SuggestedFarmsCard: () => <div data-testid="suggested-farms" />,
}));
vi.mock('../components/wizard', () => ({
  SetupWizard: ({ onComplete }: { onComplete?: (groupId: string, shareCode: string) => void }) => {
    hubCallbacks.wizardOnComplete = onComplete ?? null;
    return null;
  },
}));

const profile: PlayerProfile = {
  id: 'p1', userId: 'u1', visibility: 'shareable', shareCode: 'P1', shareEnabled: true, bio: null,
  characters: [{
    id: 'c1', lodestoneId: '1', name: 'Rin Applicant', server: 'Balmung', dataCenter: 'Crystal',
    avatarUrl: null, isMain: true, createdAt: '', updatedAt: '',
  }],
  jobProfiles: [{
    id: 'j1', job: 'BRD', role: 'ranged', priority: 'main', readiness: 'ready', notes: null,
    gearSnapshotId: null, gearSnapshot: null, bisTargets: [], createdAt: '', updatedAt: '',
  }],
  createdAt: '', updatedAt: '',
};
const groups = [
  { id: 'g1', name: 'Weeknight Static', shareCode: 'WKNT01', userRole: 'lead' },
  { id: 'g2', name: 'Weekend Static', shareCode: 'WKND01', userRole: 'member' },
] as StaticGroupListItem[];
const goals = [{ id: 'goal-1' }] as never[];
const gearSnapshots = { c1: [] };

const openers = {
  onOpenLinkModal: vi.fn(),
  onAddJob: vi.fn(),
  onEditJob: vi.fn(),
  onManageBiS: vi.fn(),
};

function LocationProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();
  return <output data-testid="probe" data-search={location.search} data-nav={navigationType} data-path={location.pathname} />;
}

function renderHub(entry = '/profile', hubProfile: PlayerProfile | null = profile) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <PlayerHub
        profile={hubProfile}
        goals={goals}
        gearSnapshots={gearSnapshots}
        collectionSuggestions={[]}
        staticSuggestions={[]}
        groups={groups}
        {...openers}
      />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const probe = () => screen.getByTestId('probe');
const tab = (name: string) => screen.getByRole('tab', { name });

beforeEach(() => {
  for (const key of Object.keys(bodies)) delete bodies[key];
  syncSeenAt.length = 0;
  authState.user = { id: 'u1', discordUsername: 'disc-user' };
  Object.values(openers).forEach((fn) => fn.mockClear());
  hubCallbacks.wizardOnComplete = null;
  hubCallbacks.hubOnCreateStatic = null;
});

describe('PlayerHub — tabs and URL', () => {
  it('renders the five tabs in order under the "Player Hub sections" label', () => {
    renderHub();
    const tablist = screen.getByRole('tablist', { name: 'Player Hub sections' });
    expect(within(tablist).getAllByRole('tab').map((t) => t.textContent)).toEqual(
      ['Overview', 'Characters & gear', 'Availability', 'Tracking', 'Sharing'],
    );
    expect(tab('Overview')).toHaveAttribute('aria-selected', 'true');
  });

  it('a legacy ?tab=sync renders Characters & gear on the first render, then replaces the URL keeping focus', () => {
    renderHub('/profile?tab=sync&focus=x');
    expect(syncSeenAt[0]).toBe('?tab=sync&focus=x');
    expect(screen.queryByTestId('hub-overview')).toBeNull();
    expect(tab('Characters & gear')).toHaveAttribute('aria-selected', 'true');
    expect(probe()).toHaveAttribute('data-search', '?tab=characters&focus=x');
    expect(probe()).toHaveAttribute('data-nav', 'REPLACE');
  });

  it('focus=availability alone lands on Availability; Overview is still reachable from it', () => {
    renderHub('/profile?focus=availability');
    expect(screen.getByTestId('body-availability')).toBeInTheDocument();
    expect(probe()).toHaveAttribute('data-search', '?focus=availability&tab=availability');
    fireEvent.click(tab('Overview'));
    expect(screen.getByTestId('hub-overview')).toBeInTheDocument();
    expect(probe()).toHaveAttribute('data-search', '');
  });

  it('clicking a tab pushes ?tab=…; Overview drops the param', () => {
    renderHub('/profile?x=1');
    fireEvent.click(tab('Tracking'));
    expect(probe()).toHaveAttribute('data-search', '?x=1&tab=tracking');
    expect(probe()).toHaveAttribute('data-nav', 'PUSH');
    fireEvent.click(tab('Overview'));
    expect(probe()).toHaveAttribute('data-search', '?x=1');
    expect(screen.getByTestId('hub-overview')).not.toBeEmptyDOMElement();
  });

  it('clears sub-tab params on a tab switch only when tabs are not remembered', () => {
    const { unmount } = renderHub('/profile?tab=tracking&coll=browse');
    fireEvent.click(tab('Sharing'));
    expect(probe()).toHaveAttribute('data-search', '?tab=sharing&coll=browse');
    unmount();

    authState.user = { id: 'u1', discordUsername: 'disc-user', tabPersistence: 'reset' };
    renderHub('/profile?tab=tracking&coll=browse');
    fireEvent.click(tab('Sharing'));
    expect(probe()).toHaveAttribute('data-search', '?tab=sharing');
  });

  it('keyboard shortcuts: ` 1 2 3 4 select the five tabs', () => {
    renderHub();
    fireEvent.keyDown(window, { key: '2' });
    expect(screen.getByTestId('body-availability')).toBeInTheDocument();
    expect(probe()).toHaveAttribute('data-search', '?tab=availability');
    fireEvent.keyDown(window, { key: '1' });
    expect(probe()).toHaveAttribute('data-search', '?tab=characters');
    fireEvent.keyDown(window, { key: '3' });
    expect(probe()).toHaveAttribute('data-search', '?tab=tracking');
    fireEvent.keyDown(window, { key: '4' });
    expect(probe()).toHaveAttribute('data-search', '?tab=sharing');
    fireEvent.keyDown(window, { key: '`' });
    expect(probe()).toHaveAttribute('data-search', '');
  });
});

describe('PlayerHub — bodies', () => {
  it('Characters & gear stacks Sync then Jobs, with the modal openers reaching JobsGearTab', () => {
    renderHub('/profile?tab=characters');
    const sync = screen.getByTestId('body-sync');
    const jobs = screen.getByTestId('body-jobs');
    expect(sync.compareDocumentPosition(jobs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Jobs' })).toHaveClass('sr-only');

    expect(bodies.sync).toMatchObject({
      profile, goals, gearSnapshots, primaryStatic: groups[0], staticGroups: groups,
      onOpenLinkModal: openers.onOpenLinkModal,
    });
    expect(bodies.jobs).toMatchObject({
      profile, gearSnapshots,
      onAddJob: openers.onAddJob, onEditJob: openers.onEditJob, onOpenLinkModal: openers.onOpenLinkModal,
    });
    act(() => (bodies.jobs.onManageBiS as (id: string) => void)('j1'));
    expect(openers.onManageBiS).toHaveBeenCalledWith({ id: 'j1', job: 'BRD' });
    act(() => (bodies.jobs.onManageBiS as (id: string) => void)('missing'));
    expect(openers.onManageBiS).toHaveBeenCalledTimes(1);
  });

  it("a body's onNavigate to a section on the current tab scrolls it; another tab switches", () => {
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    onTestFinished(() => {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    });
    renderHub('/profile?tab=characters');
    act(() => (bodies.sync.onNavigate as (id: string) => void)('jobs-gear'));
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]).toContainElement(screen.getByTestId('body-jobs'));
    expect(scrolled[0]).not.toContainElement(screen.getByTestId('body-sync'));
    act(() => (bodies.jobs.onNavigate as (id: string) => void)('sync'));
    expect(scrolled[1]).toContainElement(screen.getByTestId('body-sync'));
    expect(probe()).toHaveAttribute('data-search', '?tab=characters');

    act(() => (bodies.sync.onNavigate as (id: string) => void)('availability'));
    expect(scrolled).toHaveLength(2);
    expect(probe()).toHaveAttribute('data-search', '?tab=availability');
  });

  it('Availability renders PlayerAvailabilityTab with the statics', () => {
    renderHub('/profile?tab=availability');
    expect(bodies.availability).toMatchObject({ primaryStatic: groups[0], staticGroups: groups });
  });

  it('Tracking stacks Goals then Collections; coll=browse drives the view', () => {
    renderHub('/profile?tab=tracking&coll=browse');
    const goalsBody = screen.getByTestId('body-goals');
    const collections = screen.getByTestId('body-collections');
    expect(goalsBody.compareDocumentPosition(collections) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bodies.goals).toMatchObject({ goals });
    expect(screen.getByRole('heading', { level: 2, name: 'Goals' })).toHaveClass('sr-only');
    expect(screen.getByRole('heading', { level: 2, name: 'Collections' })).not.toHaveClass('sr-only');
    expect(bodies.collections.view).toBe('browse');
    expect(tab('Browse Catalog')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Browse the full rewards catalog/)).toHaveClass('text-xs');

    fireEvent.click(tab('My Priorities'));
    expect(bodies.collections.view).toBe('priorities');
    expect(probe()).toHaveAttribute('data-search', '?tab=tracking');
    act(() => (bodies.collections.onViewChange as (v: string) => void)('browse'));
    expect(probe()).toHaveAttribute('data-search', '?tab=tracking&coll=browse');
  });

  it('Sharing wraps PreviewShareTab under an sr-only heading', () => {
    renderHub('/profile?tab=sharing');
    expect(bodies.sharing).toMatchObject({ profile, gearSnapshots });
    expect(screen.getByRole('heading', { level: 2, name: 'Sharing' })).toHaveClass('sr-only');
  });

  it('without a profile, the profile-dependent bodies are guarded as in V1', () => {
    const { unmount } = renderHub('/profile?tab=characters', null);
    expect(screen.getByTestId('body-sync')).toBeInTheDocument();
    expect(screen.queryByTestId('body-jobs')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'disc-user' })).toBeInTheDocument();
    unmount();
    renderHub('/profile?tab=sharing', null);
    expect(screen.queryByTestId('body-sharing')).toBeNull();
  });
});

describe('PlayerHub — layout', () => {
  it('one h1, the 120rem cap without mx-auto, no Profile sidebar, an empty Overview region', () => {
    renderHub();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const hub = screen.getByTestId('player-hub');
    expect(hub).toHaveClass('w-full', 'max-w-[120rem]');
    expect(hub.className).not.toMatch(/mx-auto/);
    for (const v1Label of ['Sync & Gear', 'Jobs & Gear', 'My Statics', 'Share']) {
      expect(screen.queryByText(v1Label)).toBeNull();
    }
    expect(screen.getByTestId('hub-overview')).not.toBeEmptyDOMElement();
  });
});

describe('PlayerHub — SetupWizard (I1)', () => {
  it('onComplete closes the wizard and navigates to the new static (R-PH1-E)', () => {
    renderHub();
    // Trigger wizard open via the Overview's onCreateStatic callback
    act(() => { hubCallbacks.hubOnCreateStatic?.(); });
    // Wizard is now open; simulate it completing with a created group
    act(() => { hubCallbacks.wizardOnComplete?.('g-new', 'NEWSC1'); });
    // Should have navigated to the new static
    expect(probe()).toHaveAttribute('data-path', '/group/NEWSC1');
  });
});
