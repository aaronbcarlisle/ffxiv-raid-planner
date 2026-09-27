import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HubOverview } from './HubOverview';
import type { PlayerOverview } from './usePlayerOverview';

// R-PH1-fix2: mock only the stores/data YourStaticsCard and HubSideCards read, so both
// render for real — unlike the previous version of this file, which mocked out both
// child components and asserted against strings the mocks themselves hard-coded (unable
// to fail for any implementation).

const staticGroupState = {
  groups: [] as unknown[],
  isLoading: false,
  error: null as string | null,
  errorSource: null as 'load' | 'action' | null,
  fetchGroups: vi.fn(),
  clearError: vi.fn(),
  duplicateGroup: vi.fn(),
  deleteGroup: vi.fn(),
};
vi.mock('../../../stores/staticGroupStore', () => ({
  useStaticGroupStore: (sel?: (s: typeof staticGroupState) => unknown) =>
    sel ? sel(staticGroupState) : staticGroupState,
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: null }) => unknown) => sel({ user: null }),
}));

vi.mock('../../../stores/toastStore', () => ({
  useToastStore: (sel: (s: { addToast: ReturnType<typeof vi.fn> }) => unknown) =>
    sel({ addToast: vi.fn() }),
}));

const availState = { days: [] as { dayOfWeek: string; slots: string[]; timezone: string }[], fetchPersonalAvailability: vi.fn() };
vi.mock('../../../stores/personalAvailabilityStore', () => ({
  usePersonalAvailabilityStore: (sel?: (s: typeof availState) => unknown) =>
    sel ? sel(availState) : availState,
}));

const playerProfileState = { error: null as string | null, fetchProfile: vi.fn() };
vi.mock('../../../stores/playerProfileStore', () => ({
  usePlayerProfileStore: (sel: (s: typeof playerProfileState) => unknown) => sel(playerProfileState),
}));

// R-PH2-N: HubOverview mounts real, so usePlayerOverview must be mocked here
// to avoid an unmocked api.get.
const overviewState = {
  data: null as PlayerOverview | null,
  isLoading: false,
  error: null as string | null,
  retry: vi.fn(),
};
vi.mock('./usePlayerOverview', () => ({
  usePlayerOverview: () => overviewState,
}));

const defaultProps = {
  profile: null,
  gearSnapshots: {},
  staticSuggestions: [],
  onOpenLinkModal: vi.fn(),
  onAddJob: vi.fn(),
  setTab: vi.fn(),
  onCreateStatic: vi.fn(),
};

/** Walks up from `el` to the nearest ancestor whose className contains `substr`. */
function closestWithClass(el: Element, substr: string): Element | null {
  let node: Element | null = el;
  while (node && !node.className?.toString().includes(substr)) {
    node = node.parentElement;
  }
  return node;
}

beforeEach(() => {
  staticGroupState.groups = [];
  overviewState.data = null;
  overviewState.isLoading = false;
  overviewState.error = null;
});

describe('HubOverview', () => {
  it('renders the hub-overview testid', () => {
    render(<MemoryRouter><HubOverview {...defaultProps} /></MemoryRouter>);
    expect(screen.getByTestId('hub-overview')).toBeInTheDocument();
  });

  it('Your statics card spans two columns (col-span-2) and renders its real content', () => {
    render(<MemoryRouter><HubOverview {...defaultProps} /></MemoryRouter>);
    // Real YourStaticsCard, zero groups: renders the L-2 empty state, not a mock stub.
    const heading = screen.getByRole('heading', { name: 'Your statics' });
    const wrapper = closestWithClass(heading, 'col-span-2');
    expect(wrapper).not.toBeNull();
    expect(screen.getByText('No statics yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create a static/i })).toBeInTheDocument();
  });

  it('side stack renders real Characters, Your availability, and Profile setup cards', () => {
    render(<MemoryRouter><HubOverview {...defaultProps} /></MemoryRouter>);
    // Real CharactersCard with no profile: empty state, not hard-coded mock text.
    expect(screen.getByRole('heading', { name: 'Characters' })).toBeInTheDocument();
    expect(screen.getByText('No character linked')).toBeInTheDocument();
    // Real AvailabilityCard with no days configured.
    expect(screen.getByRole('heading', { name: 'Your availability' })).toBeInTheDocument();
    expect(screen.getByText('Not set yet')).toBeInTheDocument();
    // Real ProfileSetupCard, incomplete setup: progress bar present.
    expect(screen.getByRole('heading', { name: 'Profile setup' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('with zero statics, there is no Needs you card (and no Profile status, Raider Snapshot or Activity)', () => {
    render(<MemoryRouter><HubOverview {...defaultProps} /></MemoryRouter>);
    expect(screen.queryByRole('heading', { name: 'Needs you' })).toBeNull();
    expect(screen.queryByText(/profile status/i)).toBeNull();
    expect(screen.queryByText(/raider snapshot/i)).toBeNull();
    expect(screen.queryByText(/^activity$/i)).toBeNull();
  });

  it('with statics, Needs you renders above Your statics (DOM order); the side stack is unchanged', () => {
    staticGroupState.groups = [{ id: 'g1', name: 'Test Static', shareCode: 'ABC123' }];
    overviewState.data = {
      statics: [],
      actionItems: [{
        type: 'rsvp_pending', staticId: 'g1', staticName: 'Test Static',
        title: 'RSVP for Prog Night', detail: 'No response yet',
        href: '/group/ABC123?tab=schedule&sessionId=sess-1', startsAt: '2026-10-03T18:30:00Z',
      }],
    };
    render(<MemoryRouter><HubOverview {...defaultProps} /></MemoryRouter>);

    const needsYou = screen.getByRole('heading', { name: 'Needs you' });
    const yourStatics = screen.getByRole('heading', { name: 'Your statics' });
    expect(needsYou.compareDocumentPosition(yourStatics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // side stack unchanged
    expect(screen.getByRole('heading', { name: 'Characters' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your availability' })).toBeInTheDocument();
  });
});
