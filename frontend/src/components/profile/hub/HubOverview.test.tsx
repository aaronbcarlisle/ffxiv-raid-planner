import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HubOverview } from './HubOverview';

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

  it('does not render Needs you, Profile status, Raider Snapshot or Activity', () => {
    render(<MemoryRouter><HubOverview {...defaultProps} /></MemoryRouter>);
    expect(screen.queryByText(/needs you/i)).toBeNull();
    expect(screen.queryByText(/profile status/i)).toBeNull();
    expect(screen.queryByText(/raider snapshot/i)).toBeNull();
    expect(screen.queryByText(/^activity$/i)).toBeNull();
  });
});
