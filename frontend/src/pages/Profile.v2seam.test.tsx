/**
 * Profile — the Stage-3 PH1 seam. Without the V2 chrome provider (every legacy
 * render path) the V1 page renders; with it, the V2 Player Hub renders while
 * Profile keeps the data effects and hosts the modals.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Profile from './Profile';
import { V2ChromeContext } from '../lib/chromeContext';
import type { PlayerProfile } from '../stores/playerProfileStore';

type Props = Record<string, unknown>;

const { bodies, profileState, groupState, authState } = vi.hoisted(() => ({
  bodies: {} as Record<string, Props>,
  profileState: {} as Record<string, unknown>,
  groupState: {} as Record<string, unknown>,
  authState: {} as Record<string, unknown>,
}));

vi.mock('../stores/playerProfileStore', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  usePlayerProfileStore: () => profileState,
}));
vi.mock('../stores/staticGroupStore', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useStaticGroupStore: () => groupState,
}));
vi.mock('../stores/sharedBisStore', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSharedBisStore: () => ({ fetchTargets: vi.fn() }),
}));
vi.mock('../stores/authStore', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAuthStore: Object.assign(
    (selector: (s: typeof authState) => unknown) => selector(authState),
    { getState: () => authState },
  ),
}));

vi.mock('../components/auth', () => ({ UserMenu: () => null }));
vi.mock('../components/profile/ProfileBottomNav', () => ({ ProfileBottomNav: () => null }));
vi.mock('../components/dashboard/MyStaticsPanel', () => ({ MyStaticsPanel: () => null }));
vi.mock('../components/profile/OverviewTab', () => ({ OverviewTab: () => <div data-testid="v1-overview" /> }));
vi.mock('../components/profile/SyncCenterTab', () => ({
  SyncCenterTab: (p: Props) => { bodies.sync = p; return null; },
}));
vi.mock('../components/profile/JobsGearTab', () => ({
  JobsGearTab: (p: Props) => { bodies.jobs = p; return null; },
}));
vi.mock('../components/profile/GoalsTab', () => ({ GoalsTab: () => null }));
vi.mock('../components/profile/CollectionsCenterTab', () => ({ CollectionsCenterTab: () => null }));
vi.mock('../components/profile/PlayerAvailabilityTab', () => ({ PlayerAvailabilityTab: () => null }));
vi.mock('../components/profile/PreviewShareTab', () => ({ PreviewShareTab: () => null }));
vi.mock('../components/profile/CharacterLinkModal', () => ({
  CharacterLinkModal: () => <div data-testid="character-link-modal" />,
}));
vi.mock('../components/profile/JobProfileModal', () => ({ JobProfileModal: () => null }));
vi.mock('../components/profile/ManageBiSModal', () => ({
  ManageBiSModal: (p: Props) => <div data-testid="manage-bis-modal">{String(p.job)}</div>,
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

const fetchProfile = vi.fn();
const fetchGroups = vi.fn();

function Probe() {
  return <output data-testid="probe" data-search={useLocation().search} />;
}

function renderProfile(inV2Chrome: boolean, entry = '/profile') {
  const page = (
    <MemoryRouter initialEntries={[entry]}>
      <Profile />
      <Probe />
    </MemoryRouter>
  );
  return render(inV2Chrome ? <V2ChromeContext.Provider value={true}>{page}</V2ChromeContext.Provider> : page);
}

const search = () => screen.getByTestId('probe').getAttribute('data-search');

beforeEach(() => {
  for (const key of Object.keys(bodies)) delete bodies[key];
  fetchProfile.mockClear();
  fetchGroups.mockClear();
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
  Object.assign(profileState, {
    profile, goals: [], gearSnapshots: {}, collectionSuggestions: [], staticSuggestions: [],
    loading: false, fetchProfile, fetchGoals: vi.fn(), fetchCollectionSuggestions: vi.fn(),
    fetchStaticSuggestions: vi.fn(), fetchGearSnapshots: vi.fn(() => Promise.resolve()),
  });
  Object.assign(groupState, { groups: [], fetchGroups });
  Object.assign(authState, {
    user: { id: 'u1', discordUsername: 'disc-user', displayName: 'Display Name' },
    authInitialized: true,
    isLoading: false,
  });
});

describe('Profile — V2 seam', () => {
  it('without the provider renders the V1 page (sidebar with My Statics), not the Hub', () => {
    renderProfile(false);
    expect(screen.getByText('My Statics')).toBeInTheDocument();
    expect(screen.getByTestId('v1-overview')).toBeInTheDocument();
    expect(screen.queryByTestId('player-hub')).toBeNull();
    expect(fetchProfile).toHaveBeenCalledTimes(1);
    expect(fetchGroups).toHaveBeenCalledTimes(1);
  });

  it('with the provider renders the Hub, not the V1 sidebar, and still fetches once', () => {
    renderProfile(true);
    expect(screen.getByTestId('player-hub')).toBeInTheDocument();
    expect(screen.queryByText('My Statics')).toBeNull();
    expect(screen.queryByTestId('v1-overview')).toBeNull();
    expect(fetchProfile).toHaveBeenCalledTimes(1);
    expect(fetchGroups).toHaveBeenCalledTimes(1);
  });

  it("V1 keeps its own shortcuts: 4 opens Availability, 6 My Statics", () => {
    renderProfile(false);
    fireEvent.keyDown(window, { key: '4' });
    expect(search()).toBe('?tab=availability');
    fireEvent.keyDown(window, { key: '6' });
    expect(search()).toBe('?tab=statics');
  });

  it("under the provider only the Hub's shortcuts run: 4 is Sharing, 6 does nothing", () => {
    // Establish a non-empty known URL state first, then assert 6 doesn't change it.
    // Without this, a V1 '6' → '?tab=statics' would be rewritten to '' by the
    // Hub's canonical rewrite, making the assertion vacuously pass.
    renderProfile(true);
    fireEvent.keyDown(window, { key: '4' });
    expect(search()).toBe('?tab=sharing');
    fireEvent.keyDown(window, { key: '6' });
    // Hub has no shortcut for 6; the URL must remain at sharing
    expect(search()).toBe('?tab=sharing');
  });

  it("the Hub's modal openers open the modals Profile hosts", () => {
    renderProfile(true, '/profile?tab=characters');
    expect(screen.queryByTestId('character-link-modal')).toBeNull();
    act(() => (bodies.sync.onOpenLinkModal as () => void)());
    expect(screen.getByTestId('character-link-modal')).toBeInTheDocument();

    expect(screen.queryByTestId('manage-bis-modal')).toBeNull();
    act(() => (bodies.jobs.onManageBiS as (id: string) => void)('j1'));
    expect(screen.getByTestId('manage-bis-modal')).toHaveTextContent('BRD');
  });

  it('a profile that failed to load still renders the Hub with the user fallback', () => {
    profileState.profile = null;
    renderProfile(true);
    expect(screen.getByTestId('player-hub')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Display Name' })).toBeInTheDocument();
    expect(screen.getByText('No character linked yet')).toBeInTheDocument();
  });
});
